[CmdletBinding()]
param(
    [string]$ToolchainContractPath = '',
    [string]$ProjectRoot = '',
    [Alias('JavaHome')]
    [string]$JavaHomePath = '',
    [string]$AndroidSdkRoot = '',
    [string]$ReportPath = ''
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if ([string]::IsNullOrWhiteSpace($ToolchainContractPath)) {
    $ToolchainContractPath = Join-Path $repoRoot 'src\platform\android\toolchain\android-toolchain.v1.json'
}
if ([string]::IsNullOrWhiteSpace($ReportPath)) {
    $ReportPath = Join-Path $repoRoot 'output\android-toolchain-readiness.v1.json'
}

function Resolve-RepoPath([string]$Path) {
    if ([IO.Path]::IsPathRooted($Path)) { return [IO.Path]::GetFullPath($Path) }
    return [IO.Path]::GetFullPath((Join-Path $repoRoot $Path))
}

function Read-JsonFile([string]$Path, [string]$Label) {
    $full = [IO.Path]::GetFullPath($Path)
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { throw "$Label is missing: $full" }
    try { return [IO.File]::ReadAllText($full) | ConvertFrom-Json } catch { throw "$Label is not valid JSON: $($_.Exception.Message)" }
}

function Get-LowerSha256([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-LowerSha256Text([string]$Value) {
    $hasher = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.UTF8Encoding]::new($false).GetBytes($Value)
        return -join ($hasher.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') })
    } finally { $hasher.Dispose() }
}

function Write-Utf8NoBom([string]$Path, [string]$Value) {
    $parent = Split-Path -Parent $Path
    if ($parent) { [IO.Directory]::CreateDirectory($parent) | Out-Null }
    [IO.File]::WriteAllText($Path, $Value + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}

function Get-JavaReleaseValue([string]$ReleasePath, [string]$Name) {
    $match = [Text.RegularExpressions.Regex]::Match(
        [IO.File]::ReadAllText($ReleasePath),
        ('(?m)^{0}="([^"]*)"\r?$' -f [Text.RegularExpressions.Regex]::Escape($Name))
    )
    if ($match.Success) { return $match.Groups[1].Value }
    return $null
}

function Get-PackageRevision([string]$SourcePropertiesPath) {
    if (-not (Test-Path -LiteralPath $SourcePropertiesPath -PathType Leaf)) { return $null }
    $match = [Text.RegularExpressions.Regex]::Match(
        [IO.File]::ReadAllText($SourcePropertiesPath),
        '(?m)^Pkg\.Revision\s*=\s*(.+?)\s*$'
    )
    if ($match.Success) { return $match.Groups[1].Value }
    return $null
}

$checks = [Collections.Generic.List[object]]::new()
function Add-Check([string]$Id, [bool]$Passed, [string]$Message, [object]$Evidence = $null) {
    $checks.Add([PSCustomObject][ordered]@{
        id = $Id
        status = if ($Passed) { 'ready' } else { 'blocked' }
        message = $Message
        evidence = $Evidence
    })
}

$contractPath = Resolve-RepoPath $ToolchainContractPath
$contract = Read-JsonFile $contractPath 'Android toolchain contract'
if ($contract.schemaVersion -ne 1) { throw 'Android toolchain contract schemaVersion must be 1.' }

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) { $ProjectRoot = Resolve-RepoPath ([string]$contract.canonicalProjectRoot) }
else { $ProjectRoot = [IO.Path]::GetFullPath($ProjectRoot) }

if ([string]::IsNullOrWhiteSpace($JavaHomePath)) { $JavaHomePath = [Environment]::GetEnvironmentVariable('JAVA_HOME') }
$javaObserved = [ordered]@{ home = if ($JavaHomePath) { [IO.Path]::GetFullPath($JavaHomePath) } else { $null }; vendor = $null; runtimeVersion = $null; javaExecutableSha256 = $null; javaReleaseFileSha256 = $null; javaHomeSha256 = $null }
if ([string]::IsNullOrWhiteSpace($JavaHomePath)) {
    Add-Check 'java.home' $false 'JAVA_HOME is unset; an explicit JDK 17 home is required.'
} else {
    $JavaHomePath = [IO.Path]::GetFullPath($JavaHomePath)
    $javaExe = Join-Path $JavaHomePath 'bin\java.exe'
    $javaRelease = Join-Path $JavaHomePath 'release'
    $javaFilesReady = (Test-Path -LiteralPath $javaExe -PathType Leaf) -and (Test-Path -LiteralPath $javaRelease -PathType Leaf)
    Add-Check 'java.files' $javaFilesReady 'JDK home must contain bin/java.exe and release.' ([ordered]@{ java = $javaExe; release = $javaRelease })
    if ($javaFilesReady) {
        $version = Get-JavaReleaseValue $javaRelease 'JAVA_VERSION'
        $vendor = Get-JavaReleaseValue $javaRelease 'IMPLEMENTOR'
        $majorMatch = if ($version) { [Text.RegularExpressions.Regex]::Match($version, '^(?:1\.)?(\d+)') } else { $null }
        $major = if ($majorMatch -and $majorMatch.Success) { [int]$majorMatch.Groups[1].Value } else { -1 }
        $javaObserved.vendor = $vendor
        $javaObserved.runtimeVersion = $version
        $javaObserved.javaExecutableSha256 = Get-LowerSha256 $javaExe
        $javaObserved.javaReleaseFileSha256 = Get-LowerSha256 $javaRelease
        $javaObserved.javaHomeSha256 = Get-LowerSha256Text ("release=$($javaObserved.javaReleaseFileSha256)`njava.exe=$($javaObserved.javaExecutableSha256)")
        Add-Check 'java.version' ($major -eq [int]$contract.java.requiredMajor) "JDK major must be $($contract.java.requiredMajor); observed $version." $javaObserved
    }
}

if ([string]::IsNullOrWhiteSpace($AndroidSdkRoot)) {
    foreach ($name in @($contract.androidSdk.rootEnvironmentVariables)) {
        $candidate = [Environment]::GetEnvironmentVariable([string]$name)
        if (-not [string]::IsNullOrWhiteSpace($candidate)) { $AndroidSdkRoot = $candidate; break }
    }
}
$sdkObserved = [ordered]@{ root = if ($AndroidSdkRoot) { [IO.Path]::GetFullPath($AndroidSdkRoot) } else { $null }; packageRevisions = [ordered]@{}; requiredFileSha256 = [ordered]@{}; sdkRootSha256 = $null }
if ([string]::IsNullOrWhiteSpace($AndroidSdkRoot)) {
    Add-Check 'android-sdk.root' $false 'ANDROID_SDK_ROOT/ANDROID_HOME is unset and no -AndroidSdkRoot was supplied.'
} else {
    $AndroidSdkRoot = [IO.Path]::GetFullPath($AndroidSdkRoot)
    Add-Check 'android-sdk.root' (Test-Path -LiteralPath $AndroidSdkRoot -PathType Container) 'Android SDK root must exist.' $AndroidSdkRoot
    $sdkFingerprintLines = [Collections.Generic.List[string]]::new()
    foreach ($packageId in @($contract.androidSdk.packages)) {
        $segments = ([string]$packageId).Split(';')
        $packageDirectory = Join-Path $AndroidSdkRoot ($segments -join [IO.Path]::DirectorySeparatorChar)
        $revision = Get-PackageRevision (Join-Path $packageDirectory 'source.properties')
        $sdkObserved.packageRevisions[[string]$packageId] = $revision
        Add-Check "android-sdk.package.$packageId" (-not [string]::IsNullOrWhiteSpace($revision)) "Android SDK package $packageId must be installed with source.properties." $revision
        $sdkFingerprintLines.Add("package:$packageId=$revision")
    }
    foreach ($relative in @($contract.androidSdk.requiredFiles)) {
        $normalized = ([string]$relative).Replace('/', [IO.Path]::DirectorySeparatorChar)
        $path = Join-Path $AndroidSdkRoot $normalized
        $present = Test-Path -LiteralPath $path -PathType Leaf
        $sha = if ($present) { Get-LowerSha256 $path } else { $null }
        $sdkObserved.requiredFileSha256[[string]$relative] = $sha
        Add-Check "android-sdk.file.$relative" $present "Required Android SDK file must exist: $relative" $sha
        $sdkFingerprintLines.Add("file:$relative=$sha")
    }
    $sdkObserved.sdkRootSha256 = Get-LowerSha256Text (($sdkFingerprintLines | Sort-Object) -join "`n")
}

$rootBuild = Join-Path $ProjectRoot 'build.gradle.kts'
$appBuild = Join-Path $ProjectRoot 'app\build.gradle.kts'
$manifestPath = Join-Path $ProjectRoot 'app\src\main\AndroidManifest.xml'
$scaffoldFilesReady = (Test-Path -LiteralPath $rootBuild -PathType Leaf) -and (Test-Path -LiteralPath $appBuild -PathType Leaf) -and (Test-Path -LiteralPath $manifestPath -PathType Leaf)
Add-Check 'scaffold.files' $scaffoldFilesReady 'Canonical Android scaffold must contain root/app Gradle files and AndroidManifest.xml.' $ProjectRoot
if ($scaffoldFilesReady) {
    $rootText = [IO.File]::ReadAllText($rootBuild)
    $appText = [IO.File]::ReadAllText($appBuild)
    $manifestText = [IO.File]::ReadAllText($manifestPath)
    $agpPattern = 'version\s+"{0}"' -f [Text.RegularExpressions.Regex]::Escape([string]$contract.androidGradlePlugin.version)
    Add-Check 'scaffold.agp' ($rootText -match $agpPattern) "AGP must be pinned to $($contract.androidGradlePlugin.version)."
    Add-Check 'scaffold.compile-sdk' ($appText -match "compileSdk\s*=\s*$($contract.androidSdk.compileSdk)\b") "compileSdk must be $($contract.androidSdk.compileSdk)."
    Add-Check 'scaffold.target-sdk' ($appText -match "targetSdk\s*=\s*$($contract.androidSdk.targetSdk)\b") "targetSdk must be $($contract.androidSdk.targetSdk)."
    Add-Check 'scaffold.min-sdk' ($appText -match "minSdk\s*=\s*$($contract.androidSdk.minSdk)\b") "minSdk must be $($contract.androidSdk.minSdk)."
    Add-Check 'scaffold.java-source' (($appText -match 'sourceCompatibility\s*=\s*JavaVersion\.VERSION_17') -and ($appText -match 'targetCompatibility\s*=\s*JavaVersion\.VERSION_17')) 'Android Java source and target compatibility must both be VERSION_17.'
    $internetEntries = [Text.RegularExpressions.Regex]::Matches($manifestText, '<uses-permission\b[^>]*android:name\s*=\s*"android\.permission\.INTERNET"[^>]*/?>', 'IgnoreCase')
    $internetFailClosed = $internetEntries.Count -eq 0 -or @($internetEntries | Where-Object { $_.Value -notmatch 'tools:node\s*=\s*"remove"' }).Count -eq 0
    Add-Check 'scaffold.no-internet' $internetFailClosed 'AndroidManifest must not grant INTERNET; a tools:node="remove" guard is allowed.'
    Add-Check 'scaffold.no-cleartext' ($manifestText -match 'android:usesCleartextTraffic\s*=\s*"false"') 'Android application must disable cleartext traffic.'
}

$requiredWrapperFiles = @($contract.gradle.requiredWrapperFiles | ForEach-Object { [string]$_ })
$wrapperPresent = @($requiredWrapperFiles | Where-Object { Test-Path -LiteralPath (Join-Path $ProjectRoot $_.Replace('/', [IO.Path]::DirectorySeparatorChar)) -PathType Leaf })
Add-Check 'gradle-wrapper.complete' ($wrapperPresent.Count -eq $requiredWrapperFiles.Count) "All Gradle $($contract.gradle.version) wrapper files must be present; found $($wrapperPresent.Count)/$($requiredWrapperFiles.Count)." $wrapperPresent
$actualProperties = Join-Path $ProjectRoot 'gradle\wrapper\gradle-wrapper.properties'
$fixturePath = Resolve-RepoPath ([string]$contract.gradle.wrapperPropertiesFixture)
if ((Test-Path -LiteralPath $actualProperties -PathType Leaf) -and (Test-Path -LiteralPath $fixturePath -PathType Leaf)) {
    $fixtureSha = Get-LowerSha256 $fixturePath
    $actualSha = Get-LowerSha256 $actualProperties
    Add-Check 'gradle-wrapper.properties' ($actualSha -eq $fixtureSha) 'Gradle wrapper properties must exactly match the pinned fixture.' ([ordered]@{ expectedSha256 = $fixtureSha; actualSha256 = $actualSha })
} else {
    Add-Check 'gradle-wrapper.properties' $false 'Pinned Gradle wrapper properties or its fixture is missing.'
}

$wrapperInventoryPath = Join-Path $ProjectRoot ([string]$contract.gradle.wrapperInventory).Replace('/', [IO.Path]::DirectorySeparatorChar)
if (Test-Path -LiteralPath $wrapperInventoryPath -PathType Leaf) {
    $wrapperInventory = Read-JsonFile $wrapperInventoryPath 'Gradle wrapper inventory'
    $inventoryErrors = [Collections.Generic.List[string]]::new()
    if ($wrapperInventory.schemaVersion -ne 1 -or [string]$wrapperInventory.gradleVersion -ne [string]$contract.gradle.version) { $inventoryErrors.Add('schemaVersion/gradleVersion mismatch') }
    $records = @($wrapperInventory.files)
    if ($records.Count -ne $requiredWrapperFiles.Count) { $inventoryErrors.Add('inventory must contain exactly the required wrapper files') }
    foreach ($relative in $requiredWrapperFiles) {
        $record = @($records | Where-Object { [string]$_.path -ceq $relative })
        $filePath = Join-Path $ProjectRoot $relative.Replace('/', [IO.Path]::DirectorySeparatorChar)
        if ($record.Count -ne 1 -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) { $inventoryErrors.Add("missing inventory record: $relative"); continue }
        $actualHash = Get-LowerSha256 $filePath
        if ([string]$record[0].sha256 -cne $actualHash -or [long]$record[0].bytes -ne (Get-Item -LiteralPath $filePath).Length) { $inventoryErrors.Add("hash/size mismatch: $relative") }
    }
    Add-Check 'gradle-wrapper.inventory' ($inventoryErrors.Count -eq 0) 'Gradle wrapper inventory must bind every required wrapper file.' @($inventoryErrors)
} else {
    Add-Check 'gradle-wrapper.inventory' $false 'Gradle wrapper SHA-256 inventory is missing.' $wrapperInventoryPath
}

$blocked = @($checks | Where-Object { $_.status -eq 'blocked' })
$report = [ordered]@{
    schemaVersion = 1
    id = 'rpgcreatorai.android-toolchain-readiness'
    generatedAt = [DateTime]::UtcNow.ToString('o')
    status = if ($blocked.Count -eq 0) { 'ready' } else { 'blocked' }
    contract = [ordered]@{ path = $contractPath; sha256 = Get-LowerSha256 $contractPath }
    projectRoot = $ProjectRoot
    observed = [ordered]@{ java = $javaObserved; androidSdk = $sdkObserved; gradleVersion = [string]$contract.gradle.version; androidGradlePluginVersion = [string]$contract.androidGradlePlugin.version }
    checks = @($checks)
    blockers = @($blocked | ForEach-Object { [ordered]@{ id = $_.id; message = $_.message } })
}

$reportPathFull = [IO.Path]::GetFullPath($ReportPath)
Write-Utf8NoBom $reportPathFull ($report | ConvertTo-Json -Depth 12)
Write-Host "Android toolchain report: $reportPathFull"
Write-Host "Status: $($report.status)"
if ($report.status -eq 'ready') { exit 0 }
exit 3
