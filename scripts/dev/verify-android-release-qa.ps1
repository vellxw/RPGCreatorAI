[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ApkPath,
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedCertificateSha256,
    [Parameter(Mandatory = $true)][string]$ExpectedVersionName,
    [Parameter(Mandatory = $true)][int]$ExpectedVersionCode,
    [string]$ReleaseRequestPath = '',
    [string]$OutputPath = '',
    [string]$SdkRoot = '',
    [string]$StagingRoot = '',
    [string]$DeviceSerial = ''
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if ([string]::IsNullOrWhiteSpace($OutputPath)) { $OutputPath = Join-Path $repoRoot 'output\android-release-qa-evidence.v1.json' }
if ([string]::IsNullOrWhiteSpace($SdkRoot)) {
    $SdkRoot = if (-not [string]::IsNullOrWhiteSpace($env:ANDROID_SDK_ROOT)) { $env:ANDROID_SDK_ROOT }
        elseif (-not [string]::IsNullOrWhiteSpace($env:ANDROID_HOME)) { $env:ANDROID_HOME }
        elseif (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { Join-Path $env:LOCALAPPDATA 'RPGCreatorAI\android-sdk' }
        else { '' }
}
$ApkPath = [IO.Path]::GetFullPath($ApkPath)
$OutputPath = [IO.Path]::GetFullPath($OutputPath)
$SdkRoot = if ($SdkRoot) { [IO.Path]::GetFullPath($SdkRoot) } else { '' }
if ([string]::IsNullOrWhiteSpace($StagingRoot)) { $StagingRoot = Join-Path $repoRoot 'output\android-webview' }
$StagingRoot = [IO.Path]::GetFullPath($StagingRoot)
$ReleaseRequestPath = if ([string]::IsNullOrWhiteSpace($ReleaseRequestPath)) { Join-Path $repoRoot 'templates\horror-bl\release-input\android-release-request.v1.json' } else { [IO.Path]::GetFullPath($ReleaseRequestPath) }
$ExpectedCertificateSha256 = $ExpectedCertificateSha256.ToLowerInvariant()
if ([string]::IsNullOrWhiteSpace($ExpectedVersionName) -or $ExpectedVersionCode -lt 1) { Fail 'Expected Android version name/code must be supplied for release QA.' }

function Get-LowerSha256([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Invoke-Captured([string]$Executable, [string[]]$Arguments) {
    $lines = @(& $Executable @Arguments 2>&1 | ForEach-Object { [string]$_ })
    return [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = ($lines -join "`n") }
}

function Fail([string]$Message) {
    throw $Message
}

if (-not (Test-Path -LiteralPath $ReleaseRequestPath -PathType Leaf)) { Fail "Android release request is missing: $ReleaseRequestPath" }
try { $releaseRequest = [IO.File]::ReadAllText($ReleaseRequestPath) | ConvertFrom-Json } catch { Fail "Android release request is invalid JSON: $($_.Exception.Message)" }
if ($releaseRequest.schemaVersion -ne 1 -or [string]::IsNullOrWhiteSpace([string]$releaseRequest.applicationId) -or [string]::IsNullOrWhiteSpace([string]$releaseRequest.versionName) -or [int]$releaseRequest.versionCode -lt 1) { Fail 'Android release request must be schemaVersion 1 with applicationId, versionName, and versionCode.' }
if ([string]$releaseRequest.versionName -cne $ExpectedVersionName -or [int]$releaseRequest.versionCode -ne $ExpectedVersionCode) {
    Fail 'Expected APK version arguments do not match the canonical Android release request.'
}
$gameReleaseRelativePath = if ($null -ne $releaseRequest.PSObject.Properties['gameReleasePath']) { [string]$releaseRequest.gameReleasePath } else { 'release-input/game-release.v1.json' }
$releaseTemplateRoot = Split-Path (Split-Path -Parent $ReleaseRequestPath) -Parent
$gameReleasePath = [IO.Path]::GetFullPath((Join-Path $releaseTemplateRoot $gameReleaseRelativePath.Replace('/', [IO.Path]::DirectorySeparatorChar)))
if (-not (Test-Path -LiteralPath $gameReleasePath -PathType Leaf)) { Fail "Canonical game release descriptor is missing: $gameReleasePath" }
try { $gameRelease = [IO.File]::ReadAllText($gameReleasePath) | ConvertFrom-Json } catch { Fail "Game release descriptor is invalid JSON: $($_.Exception.Message)" }
if ($gameRelease.schemaVersion -ne 1 -or [string]$gameRelease.status -cne 'locked' -or [string]$gameRelease.version -cne [string]$releaseRequest.versionName) {
    Fail 'Android release QA requires a locked game-release.v1.json whose version matches versionName.'
}
$gameReleaseSha256 = Get-LowerSha256 $gameReleasePath
$expectedApplicationId = [string]$releaseRequest.applicationId

if (-not (Test-Path -LiteralPath $ApkPath -PathType Leaf)) { Fail "APK does not exist: $ApkPath" }
$apkItem = Get-Item -LiteralPath $ApkPath -Force
if ($apkItem.Length -le 0) { Fail "APK is empty: $ApkPath" }
if (-not $SdkRoot -or -not (Test-Path -LiteralPath $SdkRoot -PathType Container)) { Fail 'Android SDK root is missing; pass -SdkRoot or set ANDROID_SDK_ROOT.' }

$buildTools = Join-Path $SdkRoot 'build-tools\35.0.0'
$apksigner = Join-Path $buildTools 'apksigner.bat'
$aapt2 = Join-Path $buildTools 'aapt2.exe'
$adb = Join-Path $SdkRoot 'platform-tools\adb.exe'
foreach ($tool in @(@{ Path = $apksigner; Label = 'apksigner' }, @{ Path = $aapt2; Label = 'aapt2' }, @{ Path = $adb; Label = 'adb' })) {
    if (-not (Test-Path -LiteralPath $tool.Path -PathType Leaf)) { Fail "Required Android tool is missing ($($tool.Label)): $($tool.Path)" }
}

$signature = Invoke-Captured $apksigner @('verify', '--verbose', '--print-certs', $ApkPath)
if ($signature.ExitCode -ne 0) { Fail "apksigner verification failed: $($signature.Output)" }
$certificateMatch = [regex]::Match($signature.Output, '(?im)certificate SHA-256 digest:\s*([0-9a-fA-F:]{64,95})')
if (-not $certificateMatch.Success) { Fail 'apksigner output did not expose a certificate SHA-256 digest.' }
$certificateSha256 = $certificateMatch.Groups[1].Value.Replace(':', '').ToLowerInvariant()
if ($certificateSha256 -notmatch '^[a-f0-9]{64}$') { Fail 'apksigner certificate digest is not a 64-character SHA-256.' }
if ($certificateSha256 -cne $ExpectedCertificateSha256) { Fail "APK certificate fingerprint does not match the expected release certificate: $certificateSha256" }

$badging = Invoke-Captured $aapt2 @('dump', 'badging', $ApkPath)
if ($badging.ExitCode -ne 0) { Fail "aapt2 badging failed: $($badging.Output)" }
$packageMatch = [regex]::Match($badging.Output, "(?m)^package: name='([^']+)'(?: versionCode='([^']+)')?(?: versionName='([^']+)')?")
if (-not $packageMatch.Success -or $packageMatch.Groups[1].Value -cne $expectedApplicationId) { Fail 'APK package id does not match the canonical Android release request.' }
if (-not $packageMatch.Groups[2].Success -or [int]$packageMatch.Groups[2].Value -ne $ExpectedVersionCode) { Fail 'APK versionCode does not match the expected release request.' }
if (-not $packageMatch.Groups[3].Success -or $packageMatch.Groups[3].Value -cne $ExpectedVersionName) { Fail 'APK versionName does not match the expected release request.' }
if ($badging.Output -match '(?im)^application-debuggable$') { Fail 'APK is marked debuggable; release QA requires a non-debuggable artifact.' }

$permissions = Invoke-Captured $aapt2 @('dump', 'permissions', $ApkPath)
if ($permissions.ExitCode -ne 0) { Fail "aapt2 permissions failed: $($permissions.Output)" }
if ($permissions.Output -match '(?i)android\.permission\.INTERNET') { Fail 'Release APK declares INTERNET permission; offline release is blocked.' }

if (-not (Test-Path -LiteralPath $StagingRoot -PathType Container)) { Fail "Android staging root is missing: $StagingRoot" }
$stagedBundlePath = Join-Path $StagingRoot 'app\src\main\assets\www\data\game-bundle.v1.json'
$stagedAllowlistPath = Join-Path $StagingRoot 'app\src\main\assets\www\data\package-allowlist.json'
$stagedAcceptancePath = Join-Path $StagingRoot 'app\src\main\assets\www\data\editor-acceptance-evidence.v1.json'
$stagedInventoryPath = Join-Path $StagingRoot 'package-files.sha256.json'
foreach ($stagedPath in @($stagedBundlePath, $stagedAllowlistPath, $stagedAcceptancePath, $stagedInventoryPath)) {
    if (-not (Test-Path -LiteralPath $stagedPath -PathType Leaf)) { Fail "Android staging evidence is missing: $stagedPath" }
}
$canonicalAcceptancePath = Join-Path (Split-Path -Parent $ReleaseRequestPath) 'editor-acceptance-evidence.v1.json'
if (-not (Test-Path -LiteralPath $canonicalAcceptancePath -PathType Leaf)) { Fail "Canonical G4 acceptance evidence is missing: $canonicalAcceptancePath" }
$canonicalAcceptanceSha256 = Get-LowerSha256 $canonicalAcceptancePath
if ((Get-LowerSha256 $stagedAcceptancePath) -cne $canonicalAcceptanceSha256) { Fail 'Staged G4 acceptance evidence does not match the canonical evidence hash.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$inventory = $null
try { $inventory = [IO.File]::ReadAllText($stagedInventoryPath) | ConvertFrom-Json } catch { Fail "Android staging inventory is invalid JSON: $($_.Exception.Message)" }
if ($inventory.schemaVersion -ne 1 -or $null -eq $inventory.files) { Fail 'Android staging inventory must expose schemaVersion 1 and files.' }
$apkZip = [IO.Compression.ZipFile]::OpenRead($ApkPath)
try {
    $requiredEntries = @(
        [pscustomobject]@{ EntryName = 'assets/www/data/game-bundle.v1.json'; SourcePath = $stagedBundlePath },
        [pscustomobject]@{ EntryName = 'assets/www/data/package-allowlist.json'; SourcePath = $stagedAllowlistPath },
        [pscustomobject]@{ EntryName = 'assets/www/data/editor-acceptance-evidence.v1.json'; SourcePath = $stagedAcceptancePath }
    )
    $wwwRecords = @($inventory.files | Where-Object { [string]$_.path -like 'app/src/main/assets/www/*' })
    foreach ($record in $wwwRecords) {
        $relative = ([string]$record.path).Substring('app/src/main/'.Length).Replace('\\', '/')
        $sourcePath = Join-Path $StagingRoot ([string]$record.path).Replace('/', [IO.Path]::DirectorySeparatorChar)
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) { Fail "Staged inventory file is missing: $($record.path)" }
        $requiredEntries += [pscustomobject]@{ EntryName = $relative; SourcePath = $sourcePath }
    }
    $seenEntries = @{}
    foreach ($required in $requiredEntries) {
        $entryName = [string]$required.EntryName
        if ($seenEntries.ContainsKey($entryName)) { continue }
        $seenEntries[$entryName] = $true
        $entry = $apkZip.GetEntry($entryName)
        if ($null -eq $entry) { Fail "APK is missing required offline asset: $entryName" }
        $entryStream = $entry.Open()
        try {
            $hash = [Security.Cryptography.SHA256]::Create()
            try { $entryHash = -join ($hash.ComputeHash($entryStream) | ForEach-Object { $_.ToString('x2') }) } finally { $hash.Dispose() }
        } finally { $entryStream.Dispose() }
        if ($entryHash -cne (Get-LowerSha256 ([string]$required.SourcePath))) { Fail "APK offline asset does not match staging: $entryName" }
    }
} finally { $apkZip.Dispose() }

$deviceList = Invoke-Captured $adb @('devices')
if ($deviceList.ExitCode -ne 0) { Fail "adb devices failed: $($deviceList.Output)" }
if ([string]::IsNullOrWhiteSpace($DeviceSerial)) {
    $DeviceSerial = @($deviceList.Output -split "`r?`n" | ForEach-Object {
        if ($_ -match '^([^\s]+)\s+device\s*$') { $Matches[1] }
    } | Select-Object -First 1)
}
if ([string]::IsNullOrWhiteSpace($DeviceSerial)) { Fail 'No online Android device/AVD is available for the required offline smoke test.' }

$state = Invoke-Captured $adb @('-s', $DeviceSerial, 'get-state')
if ($state.ExitCode -ne 0 -or $state.Output.Trim() -cne 'device') { Fail "ADB device is not online: $DeviceSerial ($($state.Output))" }
$api = Invoke-Captured $adb @('-s', $DeviceSerial, 'shell', 'getprop', 'ro.build.version.sdk')
if ($api.ExitCode -ne 0 -or $api.Output.Trim() -notmatch '^\d+$' -or [int]$api.Output.Trim() -lt 24) { Fail "Unable to prove a supported Android API on ${DeviceSerial}: $($api.Output)" }
$install = Invoke-Captured $adb @('-s', $DeviceSerial, 'install', '-r', $ApkPath)
if ($install.ExitCode -ne 0) { Fail "ADB APK installation failed: $($install.Output)" }
[void](Invoke-Captured $adb @('-s', $DeviceSerial, 'shell', 'am', 'force-stop', $expectedApplicationId))
$launch = Invoke-Captured $adb @('-s', $DeviceSerial, 'shell', 'monkey', '-p', $expectedApplicationId, '1')
if ($launch.ExitCode -ne 0) { Fail "ADB launch failed: $($launch.Output)" }
Start-Sleep -Seconds 2
$pidProbe = Invoke-Captured $adb @('-s', $DeviceSerial, 'shell', 'pidof', $expectedApplicationId)
if ($pidProbe.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($pidProbe.Output.Trim())) {
    $activityProbe = Invoke-Captured $adb @('-s', $DeviceSerial, 'shell', 'dumpsys', 'activity', 'activities')
    if ($activityProbe.ExitCode -ne 0 -or $activityProbe.Output -notmatch [regex]::Escape($expectedApplicationId)) { Fail 'Android process did not remain alive after launch.' }
}

if (Test-Path -LiteralPath $OutputPath) { Fail "Refusing to overwrite existing QA evidence: $OutputPath" }
$outputParent = Split-Path -Parent $OutputPath
if ($outputParent) { [IO.Directory]::CreateDirectory($outputParent) | Out-Null }
$evidence = [ordered]@{
    schemaVersion = 1
    status = 'verified'
    variant = 'release'
    applicationId = $expectedApplicationId
    versionName = $ExpectedVersionName
    versionCode = $ExpectedVersionCode
    gameReleaseSha256 = $gameReleaseSha256
    editorAcceptanceEvidenceSha256 = $canonicalAcceptanceSha256
    artifactSha256 = Get-LowerSha256 $ApkPath
    signatureVerified = $true
    signingCertificateSha256 = $certificateSha256
    verifiedAt = [DateTime]::UtcNow.ToString('o')
    offlineDevice = [ordered]@{
        status = 'passed'
        device = $DeviceSerial
        androidApi = [int]$api.Output.Trim()
        checks = @('apksigner verify --verbose --print-certs with expected release certificate', 'aapt2 dump badging/package/version/non-debuggable bound to android-release-request.v1.json', 'aapt2 dump permissions (no INTERNET)', 'APK GameBundle/package allowlist match staged hashes', 'adb install -r', 'offline launcher process remained alive')
    }
}
[IO.File]::WriteAllText($OutputPath, ($evidence | ConvertTo-Json -Depth 8) + "`n", [Text.UTF8Encoding]::new($false))
Write-Host "Android release QA evidence: $OutputPath"
Write-Host 'ANDROID RELEASE QA VERIFIED'
