[CmdletBinding()]
param(
    [string]$TemplateRoot = '',
    [string]$ReleaseRequestPath = '',
    [string]$ToolchainReportPath = '',
    [string]$GateReportPath = '',
    [string]$StagingRoot = '',
    [string]$ApkPath = '',
    [ValidateSet('debug', 'release')][string]$Variant = 'release',
    [string]$QaEvidencePath = '',
    [string]$OutputPath = '',
    [switch]$AllowBlocked
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if ([string]::IsNullOrWhiteSpace($TemplateRoot)) { $TemplateRoot = Join-Path $repoRoot 'templates\horror-bl' }
if ([string]::IsNullOrWhiteSpace($ReleaseRequestPath)) { $ReleaseRequestPath = Join-Path $TemplateRoot 'release-input\android-release-request.v1.json' }
if ([string]::IsNullOrWhiteSpace($ToolchainReportPath)) { $ToolchainReportPath = Join-Path $repoRoot 'output\android-toolchain-readiness.v1.json' }
if ([string]::IsNullOrWhiteSpace($GateReportPath)) { $GateReportPath = Join-Path $repoRoot 'output\android-release-gates.v1.json' }
if ([string]::IsNullOrWhiteSpace($StagingRoot)) { $StagingRoot = Join-Path $repoRoot 'output\android-webview' }
if ([string]::IsNullOrWhiteSpace($OutputPath)) { $OutputPath = Join-Path $repoRoot 'output\android-release-manifest.v1.json' }
$TemplateRoot = [IO.Path]::GetFullPath($TemplateRoot)
$ReleaseRequestPath = [IO.Path]::GetFullPath($ReleaseRequestPath)
$ToolchainReportPath = [IO.Path]::GetFullPath($ToolchainReportPath)
$GateReportPath = [IO.Path]::GetFullPath($GateReportPath)
$StagingRoot = [IO.Path]::GetFullPath($StagingRoot)
$OutputPath = [IO.Path]::GetFullPath($OutputPath)

function Read-JsonFile([string]$Path, [string]$Label) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "$Label is missing: $Path" }
    try { return [IO.File]::ReadAllText($Path) | ConvertFrom-Json } catch { throw "$Label is invalid JSON: $($_.Exception.Message)" }
}

function Get-LowerSha256([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Write-Utf8NoBom([string]$Path, [string]$Value) {
    $parent = Split-Path -Parent $Path
    if ($parent) { [IO.Directory]::CreateDirectory($parent) | Out-Null }
    [IO.File]::WriteAllText($Path, $Value + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}

function Resolve-TemplatePath([string]$Path) {
    if ([IO.Path]::IsPathRooted($Path)) { return [IO.Path]::GetFullPath($Path) }
    return [IO.Path]::GetFullPath((Join-Path $TemplateRoot $Path))
}

function New-HashEvidence([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Required release input is missing: $Path" }
    return [ordered]@{ path = [IO.Path]::GetFullPath($Path); sha256 = Get-LowerSha256 $Path }
}

$request = Read-JsonFile $ReleaseRequestPath 'Android release request'
$toolchain = Read-JsonFile $ToolchainReportPath 'Android toolchain readiness report'
$gates = Read-JsonFile $GateReportPath 'Android release gate report'
if ($request.schemaVersion -ne 1 -or $toolchain.schemaVersion -ne 1 -or $gates.schemaVersion -ne 1) { throw 'Release request and reports must use schemaVersion 1.' }
$gameBundlePath = Resolve-TemplatePath ([string]$request.gameBundlePath)
$gameReleaseRelativePath = if ($null -ne $request.PSObject.Properties['gameReleasePath']) { [string]$request.gameReleasePath } else { 'release-input/game-release.v1.json' }
$gameReleasePath = Resolve-TemplatePath $gameReleaseRelativePath
$assetManifestPath = Resolve-TemplatePath ([string]$request.assetManifestPath)
$assetAllowlistPath = Resolve-TemplatePath ([string]$request.assetAllowlistPath)
$assetProvenancePath = Resolve-TemplatePath ([string]$request.assetProvenancePath)
$assetApprovalGatePath = Resolve-TemplatePath ([string]$request.assetApprovalGatePath)
$acceptanceEvidencePath = Join-Path $TemplateRoot 'release-input\editor-acceptance-evidence.v1.json'
$gameReleaseHash = if (Test-Path -LiteralPath $gameReleasePath -PathType Leaf) { Get-LowerSha256 $gameReleasePath } else { '' }
$inventoryPath = Join-Path $StagingRoot 'package-files.sha256.json'

$gitHead = $null
$worktreeClean = $null
try {
    # Materialize native output before inspecting LASTEXITCODE. Piping through
    # Select-Object can mask the exit code on Windows PowerShell and would
    # silently erase the source revision from an otherwise valid manifest.
    $gitHeadLines = @(& git -C $repoRoot rev-parse HEAD 2>$null)
    $gitHeadValue = if ($gitHeadLines.Count -gt 0) { [string]$gitHeadLines[0] } else { '' }
    $gitHeadExitCode = $LASTEXITCODE
    if ($gitHeadExitCode -eq 0 -and $gitHeadValue -match '^[a-fA-F0-9]{40,64}$') {
        $gitHead = $gitHeadValue.ToLowerInvariant()
        $gitStatus = @(& git -C $repoRoot status --porcelain --untracked-files=normal 2>$null)
        if ($LASTEXITCODE -eq 0) { $worktreeClean = $gitStatus.Count -eq 0 }
    }
} catch {
    $gitHead = $null
    $worktreeClean = $null
}

$blockers = [Collections.Generic.List[string]]::new()
if ([string]$toolchain.status -cne 'ready') {
    foreach ($item in @($toolchain.blockers)) { $blockers.Add("toolchain:$([string]$item.id) - $([string]$item.message)") }
    if (@($toolchain.blockers).Count -eq 0) { $blockers.Add('toolchain report is not ready') }
}
if ([string]$gates.status -cne 'ready') {
    foreach ($gateProperty in $gates.gates.PSObject.Properties) {
        foreach ($item in @($gateProperty.Value.blockers)) { $blockers.Add("$($gateProperty.Name):$([string]$item.id) - $([string]$item.message)") }
    }
    if (@($gates.gates.PSObject.Properties | Where-Object { [string]$_.Value.status -eq 'blocked' }).Count -eq 0) { $blockers.Add('release gate report is not ready') }
}
if ($blockers.Count -gt 0 -and -not $AllowBlocked) {
    throw "Release manifest refused because prerequisites are blocked. Use -AllowBlocked only to emit a diagnostic manifest. First blocker: $($blockers[0])"
}

$artifact = $null
$artifactHash = $null
if (-not [string]::IsNullOrWhiteSpace($ApkPath)) {
    $ApkPath = [IO.Path]::GetFullPath($ApkPath)
    if (-not (Test-Path -LiteralPath $ApkPath -PathType Leaf)) { throw "APK does not exist: $ApkPath" }
    $artifactHash = Get-LowerSha256 $ApkPath
    $artifact = [ordered]@{ path = $ApkPath; bytes = (Get-Item -LiteralPath $ApkPath).Length; sha256 = $artifactHash; variant = $Variant }
}

$qaSignature = 'missing'
$qaCertificateSha256 = $null
$qaOffline = 'missing'
$qaEvidenceFull = $null
$qaEvidenceHash = $null
if (-not [string]::IsNullOrWhiteSpace($QaEvidencePath)) {
    $qaEvidenceFull = [IO.Path]::GetFullPath($QaEvidencePath)
    $qa = Read-JsonFile $qaEvidenceFull 'Android release QA evidence'
    $qaEvidenceHash = Get-LowerSha256 $qaEvidenceFull
    $canonicalAcceptanceHash = if (Test-Path -LiteralPath $acceptanceEvidencePath -PathType Leaf) { Get-LowerSha256 $acceptanceEvidencePath } else { '' }
    $qaReady = $qa.schemaVersion -eq 1 -and [string]$qa.status -ceq 'verified' -and [string]$qa.variant -ceq 'release' -and [string]$qa.applicationId -ceq [string]$request.applicationId -and [string]$qa.versionName -ceq [string]$request.versionName -and [int]$qa.versionCode -eq [int]$request.versionCode -and [string]$qa.gameReleaseSha256 -ceq $gameReleaseHash -and [string]$qa.editorAcceptanceEvidenceSha256 -ceq $canonicalAcceptanceHash -and $qa.signatureVerified -eq $true -and [string]$qa.signingCertificateSha256 -match '^[a-f0-9]{64}$' -and [string]$qa.artifactSha256 -ceq [string]$artifactHash -and [string]$qa.offlineDevice.status -ceq 'passed'
    if ($qaReady) { $qaSignature = 'verified'; $qaCertificateSha256 = [string]$qa.signingCertificateSha256; $qaOffline = 'passed' }
    else { $blockers.Add('QA evidence does not bind a release APK with verified signature and passed offline-device checks') }
}

$status = 'blocked'
if ($blockers.Count -eq 0) {
    if ($worktreeClean -ne $true) {
        $status = 'candidate'
        $blockers.Add('release requires a clean Git worktree and a recorded source revision')
    } elseif ($null -eq $artifact) {
        $status = 'candidate'
        $blockers.Add('release APK artifact has not been supplied')
    } elseif ($Variant -cne 'release') {
        $status = 'candidate'
        $blockers.Add('debug APKs are candidates, never release artifacts')
    } elseif ($qaSignature -cne 'verified' -or $qaOffline -cne 'passed') {
        $status = 'candidate'
        $blockers.Add('release QA evidence is missing')
    } else { $status = 'release' }
}

$manifest = [ordered]@{
    schemaVersion = 1
    id = "$($request.id).manifest"
    generatedAt = [DateTime]::UtcNow.ToString('o')
    status = $status
    application = [ordered]@{
        applicationId = [string]$request.applicationId
        versionCode = [int]$request.versionCode
        versionName = [string]$request.versionName
        title = [string]$request.title
    }
    source = [ordered]@{ gitHead = $gitHead; worktreeClean = $worktreeClean }
    inputs = [ordered]@{
        releaseRequest = New-HashEvidence $ReleaseRequestPath
        gameBundle = New-HashEvidence $gameBundlePath
        assetManifest = New-HashEvidence $assetManifestPath
        assetAllowlist = New-HashEvidence $assetAllowlistPath
        assetProvenance = New-HashEvidence $assetProvenancePath
        assetApprovalGate = New-HashEvidence $assetApprovalGatePath
        gameRelease = New-HashEvidence $gameReleasePath
    }
    toolchain = [ordered]@{
        path = $ToolchainReportPath
        sha256 = Get-LowerSha256 $ToolchainReportPath
        status = [string]$toolchain.status
        java = [ordered]@{
            vendor = $toolchain.observed.java.vendor
            runtimeVersion = $toolchain.observed.java.runtimeVersion
            javaHomeSha256 = $toolchain.observed.java.javaHomeSha256
        }
        androidSdk = [ordered]@{
            sdkRootSha256 = $toolchain.observed.androidSdk.sdkRootSha256
            packageRevisions = $toolchain.observed.androidSdk.packageRevisions
        }
        gradleVersion = [string]$toolchain.observed.gradleVersion
        androidGradlePluginVersion = [string]$toolchain.observed.androidGradlePluginVersion
    }
    gates = [ordered]@{ path = $GateReportPath; sha256 = Get-LowerSha256 $GateReportPath; status = [string]$gates.status }
    staging = New-HashEvidence $inventoryPath
    artifact = $artifact
    qa = [ordered]@{ signature = $qaSignature; signingCertificateSha256 = $qaCertificateSha256; offlineDevice = $qaOffline; evidencePath = $qaEvidenceFull; evidenceSha256 = $qaEvidenceHash }
    blockers = @($blockers)
}
if (Test-Path -LiteralPath $acceptanceEvidencePath -PathType Leaf) {
    $manifest.inputs.editorAcceptanceEvidence = New-HashEvidence $acceptanceEvidencePath
}
Write-Utf8NoBom $OutputPath ($manifest | ConvertTo-Json -Depth 12)
Write-Host "Android release manifest: $OutputPath"
Write-Host "Status: $status"
if ($status -eq 'release') { exit 0 }
exit 3
