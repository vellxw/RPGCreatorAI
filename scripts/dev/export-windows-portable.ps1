<#
.SYNOPSIS
Creates a validated Windows portable game directory from existing build outputs.

.DESCRIPTION
This script never builds, installs, signs, downloads, or overwrites artifacts.
It hashes source files, executes the TypeScript Windows portable release gate,
derives the exact native map/database shard allowlist from data/project.json,
copies only declared files into a unique staging directory, verifies the staged
bytes again, and atomically renames staging into the final directory.

.EXAMPLE
./scripts/dev/export-windows-portable.ps1 `
  -ProjectRoot C:\Games\MyGame `
  -GameBundlePath C:\Games\MyGame\release-input\game-bundle.v1.json `
  -ProvenancePath C:\Games\MyGame\release-input\asset-provenance.v1.json `
  -AssetAllowlistPath C:\Games\MyGame\release-input\asset-allowlist.json `
  -AssetApprovalGatePath C:\Games\MyGame\release-input\asset-approval-gate.v1.json `
  -CompilerWarningsPath C:\Games\MyGame\release-input\compiler-warnings.json
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,

    [Parameter(Mandatory = $true)]
    [string]$GameBundlePath,

    [Parameter(Mandatory = $true)]
    [string]$ProvenancePath,

    [Parameter(Mandatory = $true)]
    [string]$AssetAllowlistPath,

    [Parameter(Mandatory = $true)]
    [string]$AssetApprovalGatePath,

    [Parameter(Mandatory = $true)]
    [string]$CompilerWarningsPath,

    [string]$PackagedExe,
    [string]$RuntimeExe,
    [string[]]$RuntimeLibraryPath = @(),
    [string]$ReadmePath,
    [string]$LicensePath,
    [string]$OutputRoot,
    [string]$ArtifactName,
    [string]$Version,

    [ValidateSet('x64', 'arm64')]
    [string]$Architecture = 'x64',

    [ValidateSet('dev', 'unsigned')]
    [string]$Qualifier = 'dev',

    [switch]$ValidateOnly,
    [switch]$RequireAcceptedHumanReview
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$invocationRoot = (Get-Location).ProviderPath
$maxGameBundleBytes = 64MB
$maxSidecarBytes = 16MB
$maxEvidenceBytes = 4MB
$maxNativeProjectBytes = 16MB
$maxNativeShardBytes = 64MB
$maxNativeDataBytes = 512MB
$maxNativeShardCount = 4096
$runtimeDatabaseKeys = @(
    'items', 'actors', 'classes', 'skills', 'weapons', 'armors', 'states',
    'types', 'terms', 'enemies', 'troops', 'quests', 'shops', 'system',
    'switches', 'variables', 'commonEvents', 'animations', 'tilesets', 'audio'
)

function Assert-LocalFilesystemPath {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Label
    )
    $fullPath = [IO.Path]::GetFullPath($Path)
    if ($fullPath.StartsWith('\\', [StringComparison]::Ordinal) -or $fullPath.StartsWith('//', [StringComparison]::Ordinal)) {
        throw "$Label must be on a local filesystem; UNC and device paths are not accepted: $Path"
    }
    return $fullPath
}

function Assert-NoReparseTraversal {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Label
    )
    $fullPath = Assert-LocalFilesystemPath -Path $Path -Label $Label
    $pathRoot = [IO.Path]::GetPathRoot($fullPath)
    if (-not $pathRoot) { throw "$Label has no filesystem root: $Path" }
    $current = $pathRoot
    $relative = $fullPath.Substring($pathRoot.Length)
    foreach ($segment in [Text.RegularExpressions.Regex]::Split($relative, '[\\/]')) {
        if (-not $segment) { continue }
        $current = Join-Path $current $segment
        if (-not (Test-Path -LiteralPath $current)) { break }
        $item = Get-Item -LiteralPath $current -Force
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "$Label traverses a symlink, junction, cloud placeholder, or other reparse point: $($item.FullName)"
        }
    }
    return $fullPath
}

function Resolve-LocalAppDataPath {
    param([Parameter(Mandatory = $true)][string]$Leaf)
    $localBase = $env:LOCALAPPDATA
    if (-not $localBase) { $localBase = [Environment]::GetFolderPath('LocalApplicationData') }
    if (-not $localBase) { throw 'LOCALAPPDATA could not be resolved for safe out-of-repo release output.' }
    return Join-Path $localBase $Leaf
}

function Resolve-ExistingFile {
    param(
        [Parameter(Mandatory = $true)][string]$Value,
        [Parameter(Mandatory = $true)][string]$Label
    )
    $candidate = $Value
    if (-not [IO.Path]::IsPathRooted($candidate)) { $candidate = Join-Path $invocationRoot $candidate }
    $candidate = Assert-NoReparseTraversal -Path $candidate -Label $Label
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { throw "$Label file does not exist: $candidate" }
    $item = Get-Item -LiteralPath $candidate -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "$Label cannot be a symlink, junction, or other reparse point: $($item.FullName)"
    }
    return $item.FullName
}

function Resolve-ExistingDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$Value,
        [Parameter(Mandatory = $true)][string]$Label
    )
    $candidate = $Value
    if (-not [IO.Path]::IsPathRooted($candidate)) { $candidate = Join-Path $invocationRoot $candidate }
    $candidate = Assert-NoReparseTraversal -Path $candidate -Label $Label
    if (-not (Test-Path -LiteralPath $candidate -PathType Container)) { throw "$Label directory does not exist: $candidate" }
    $item = Get-Item -LiteralPath $candidate -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "$Label cannot be a symlink, junction, or other reparse point: $($item.FullName)"
    }
    return $item.FullName.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
}

function Get-JsonProperty {
    param(
        [Parameter(Mandatory = $true)][object]$Value,
        [Parameter(Mandatory = $true)][string]$Name
    )
    $property = $Value.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    if ($property.Value -is [Array]) {
        Write-Output -NoEnumerate $property.Value
        return
    }
    return $property.Value
}

function Read-JsonDocument {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Label,
        [long]$MaxBytes = $maxSidecarBytes
    )
    try {
        $item = Get-Item -LiteralPath $Path -Force
        if ($item.Length -le 0 -or $item.Length -gt $MaxBytes) {
            throw "$Label must contain between 1 and $MaxBytes bytes."
        }
        $utf8 = [Text.UTF8Encoding]::new($false, $true)
        $jsonCommand = Get-Command ConvertFrom-Json -ErrorAction Stop
        if ($jsonCommand.Parameters.ContainsKey('DateKind')) {
            $parsed = [IO.File]::ReadAllText($item.FullName, $utf8) | ConvertFrom-Json -DateKind String
        } else {
            $parsed = [IO.File]::ReadAllText($item.FullName, $utf8) | ConvertFrom-Json
        }
        if ($parsed -is [Array]) {
            Write-Output -NoEnumerate $parsed
            return
        }
        return $parsed
    } catch {
        throw "$Label is not valid JSON: $($_.Exception.Message)"
    }
}

function Write-JsonDocument {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][object]$Value,
        [switch]$Compress
    )
    $json = if ($Compress) {
        $Value | ConvertTo-Json -Depth 64 -Compress
    } else {
        $Value | ConvertTo-Json -Depth 64
    }
    [IO.File]::WriteAllText($Path, "$json`n", [Text.UTF8Encoding]::new($false))
}

function Test-IsInsideRoot {
    param(
        [Parameter(Mandatory = $true)][string]$Candidate,
        [Parameter(Mandatory = $true)][string]$Root
    )
    $fullCandidate = [IO.Path]::GetFullPath($Candidate)
    $fullRoot = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    $prefix = "$fullRoot$([IO.Path]::DirectorySeparatorChar)"
    return $fullCandidate.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
}

function Assert-SafePortablePath {
    param(
        [Parameter(Mandatory = $true)][string]$Value,
        [Parameter(Mandatory = $true)][string]$Label,
        [switch]$RequireAssetRoot
    )
    if (-not $Value -or $Value -ne $Value.Trim()) { throw "$Label must be non-blank canonical text." }
    if ($Value.Contains('\') -or [IO.Path]::IsPathRooted($Value)) { throw "$Label must use a relative forward-slash path: $Value" }
    if ($Value -match '[\x00-\x1f\x7f<>:"|?*#]' -or $Value -match '%[0-9a-fA-F]{2}' -or $Value -match '^[a-zA-Z][a-zA-Z0-9+.-]*:') {
        throw "$Label contains a reserved, encoded, or URI path form: $Value"
    }
    $reserved = '^(?i:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$'
    foreach ($segment in $Value.Split('/')) {
        if (-not $segment -or $segment -eq '.' -or $segment -eq '..' -or $segment -match '[. ]$' -or $segment -match $reserved) {
            throw "$Label contains an unsafe Windows path segment: $Value"
        }
    }
    if ($RequireAssetRoot -and -not $Value.StartsWith('assets/', [StringComparison]::OrdinalIgnoreCase)) {
        throw "$Label must be below assets/: $Value"
    }
}

function Resolve-ProjectAssetFile {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][string]$AssetId
    )
    Assert-SafePortablePath -Value $RelativePath -Label "Asset $AssetId path" -RequireAssetRoot
    $current = $Root
    foreach ($segment in $RelativePath.Split('/')) {
        $current = Join-Path $current $segment
        if (-not (Test-Path -LiteralPath $current)) { throw "Allowlisted asset $AssetId is missing: $RelativePath" }
        $item = Get-Item -LiteralPath $current -Force
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Allowlisted asset $AssetId traverses a reparse point: $RelativePath"
        }
    }
    if (-not (Test-Path -LiteralPath $current -PathType Leaf)) { throw "Allowlisted asset $AssetId is not a file: $RelativePath" }
    [void](Assert-NoReparseTraversal -Path $current -Label "Allowlisted asset $AssetId")
    $resolved = (Resolve-Path -LiteralPath $current).Path
    if (-not (Test-IsInsideRoot -Candidate $resolved -Root $Root)) { throw "Allowlisted asset $AssetId resolves outside ProjectRoot." }
    return $resolved
}

function Test-NonBlankString {
    param([object]$Value)
    return $Value -is [string] -and -not [string]::IsNullOrWhiteSpace([string]$Value) -and $Value -eq $Value.Trim()
}

function Test-HumanAcceptanceRecord {
    param(
        [object]$Acceptance,
        [Parameter(Mandatory = $true)][string]$TemplateRoot,
        [Parameter(Mandatory = $true)][string]$AssetId,
        [Parameter(Mandatory = $true)][string]$ExpectedHash,
        [switch]$RequireAccepted
    )
    if ($null -eq $Acceptance) { return $false }
    $state = [string](Get-JsonProperty -Value $Acceptance -Name 'state')
    $evidence = [string](Get-JsonProperty -Value $Acceptance -Name 'evidence')
    if ($state -ceq 'pending' -and $evidence -ceq 'not-recorded') { return -not $RequireAccepted }
    if ($state -cne 'accepted' -or $evidence -cne 'release-input/editor-acceptance-evidence.v1.json') { return $false }
    if (-not (Test-NonBlankString (Get-JsonProperty -Value $Acceptance -Name 'reviewer')) -or
        -not (Test-NonBlankString (Get-JsonProperty -Value $Acceptance -Name 'reviewedAt')) -or
        [string](Get-JsonProperty -Value $Acceptance -Name 'evidenceSha256') -notmatch '^[a-f0-9]{64}$') { return $false }
    $evidencePath = Join-Path $TemplateRoot 'release-input\editor-acceptance-evidence.v1.json'
    if (-not (Test-IsInsideRoot -Candidate $evidencePath -Root $TemplateRoot) -or -not (Test-Path -LiteralPath $evidencePath -PathType Leaf)) { return $false }
    if ((Get-FileHash -LiteralPath $evidencePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne [string](Get-JsonProperty -Value $Acceptance -Name 'evidenceSha256')) { return $false }
    try { $evidenceDocument = Read-JsonDocument -Path $evidencePath -Label 'editor acceptance evidence' } catch { return $false }
    if ([string](Get-JsonProperty -Value $evidenceDocument -Name 'status') -cne 'accepted') { return $false }
    $canonicalReviewer = Get-JsonProperty -Value (Get-JsonProperty -Value $evidenceDocument -Name 'reviewer') -Name 'label'
    $canonicalReviewedAt = Get-JsonProperty -Value $evidenceDocument -Name 'reviewedAt'
    if ([string]$canonicalReviewer -cne [string](Get-JsonProperty -Value $Acceptance -Name 'reviewer') -or
        [string]$canonicalReviewedAt -cne [string](Get-JsonProperty -Value $Acceptance -Name 'reviewedAt')) { return $false }
    $decision = @($evidenceDocument.resources | Where-Object { [string]$_.resourceId -ceq $AssetId })
    return @($decision).Count -eq 1 -and [string](Get-JsonProperty -Value $decision[0] -Name 'status') -ceq 'accepted' -and [string](Get-JsonProperty -Value $decision[0] -Name 'sha256') -ceq $ExpectedHash
}

function Assert-G4AcceptanceEvidence {
    param(
        [Parameter(Mandatory = $true)][object]$Evidence,
        [Parameter(Mandatory = $true)][object[]]$BundleAssets,
        [Parameter(Mandatory = $true)][string]$TemplateRoot,
        [Parameter(Mandatory = $true)][string]$GameBundlePath
    )
    if ((Get-JsonProperty -Value $Evidence -Name 'schemaVersion') -ne 1 -or
        [string](Get-JsonProperty -Value $Evidence -Name 'status') -cne 'accepted') {
        throw 'Canonical G4 evidence must use schemaVersion 1 and status accepted.'
    }
    $reviewer = Get-JsonProperty -Value $Evidence -Name 'reviewer'
    $reviewerKind = [string](Get-JsonProperty -Value $reviewer -Name 'kind')
    $reviewerLabel = [string](Get-JsonProperty -Value $reviewer -Name 'label')
    if ($reviewerKind -notin @('human', 'delegated-by-creator') -or -not (Test-NonBlankString $reviewerLabel)) {
        throw 'Canonical G4 evidence must identify a human or explicitly delegated reviewer.'
    }
    $reviewedAt = [DateTimeOffset]::MinValue
    if (-not [DateTimeOffset]::TryParse([string](Get-JsonProperty -Value $Evidence -Name 'reviewedAt'), [ref]$reviewedAt)) {
        throw 'Canonical G4 evidence has an invalid reviewedAt timestamp.'
    }
    $resourcesNode = Get-JsonProperty -Value $Evidence -Name 'resources'
    if ($null -eq $resourcesNode -or -not ($resourcesNode -is [Array])) { throw 'Canonical G4 evidence must contain a resources[] array.' }
    $expectedIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($asset in $BundleAssets) {
        $id = [string](Get-JsonProperty -Value $asset -Name 'id')
        if (-not (Test-NonBlankString $id) -or -not $expectedIds.Add($id)) { throw "GameBundle has duplicate or invalid asset id in G4 evidence check: $id" }
    }
    $seenIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($decision in @($resourcesNode)) {
        $id = [string](Get-JsonProperty -Value $decision -Name 'resourceId')
        if (-not $expectedIds.Contains($id)) { throw "G4 evidence contains an unknown resource: $id" }
        if (-not $seenIds.Add($id)) { throw "G4 evidence contains a duplicate resource: $id" }
        if ([string](Get-JsonProperty -Value $decision -Name 'kind') -cne 'asset' -or
            [string](Get-JsonProperty -Value $decision -Name 'status') -cne 'accepted') {
            throw "G4 evidence decision is not accepted asset evidence: $id"
        }
        $declaredHash = [string](Get-JsonProperty -Value $decision -Name 'sha256')
        if ($declaredHash -notmatch '^[a-f0-9]{64}$') { throw "G4 evidence hash is invalid: $id" }
        $asset = @($BundleAssets | Where-Object { [string](Get-JsonProperty -Value $_ -Name 'id') -ceq $id })[0]
        $runtimePath = [string](Get-JsonProperty -Value $asset -Name 'path')
        $runtimeFile = Resolve-ProjectAssetFile -Root $TemplateRoot -RelativePath $runtimePath -AssetId $id
        $actualHash = (Get-FileHash -LiteralPath $runtimeFile -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($declaredHash -cne $actualHash) { throw "G4 evidence hash does not match runtime bytes: $id" }
    }
    if ($seenIds.Count -ne $expectedIds.Count) { throw "G4 evidence must contain exactly one accepted decision for every GameBundle asset (expected $($expectedIds.Count), found $($seenIds.Count))." }
    $expectedBundleHash = (Get-FileHash -LiteralPath $GameBundlePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ([string](Get-JsonProperty -Value $Evidence -Name 'gameBundleSha256') -cne $expectedBundleHash) { throw 'G4 evidence gameBundleSha256 does not match the current GameBundle.' }
    $assetManifestPath = Join-Path $TemplateRoot 'data\assets\assets-manifest.json'
    if (-not (Test-Path -LiteralPath $assetManifestPath -PathType Leaf)) { throw 'Canonical asset manifest is missing for G4 evidence binding.' }
    $expectedAssetManifestHash = (Get-FileHash -LiteralPath $assetManifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ([string](Get-JsonProperty -Value $Evidence -Name 'assetManifestSha256') -cne $expectedAssetManifestHash) { throw 'G4 evidence assetManifestSha256 does not match the current asset manifest.' }
}

function Resolve-ProjectNativeDataFile {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][ValidateSet('native-project', 'native-map', 'native-database')][string]$Role
    )
    Assert-SafePortablePath -Value $RelativePath -Label "Native data path $RelativePath"
    $expectedPrefix = switch ($Role) {
        'native-project' { 'data/project.json' }
        'native-map' { 'data/maps/' }
        'native-database' { 'data/database/' }
    }
    if ($Role -eq 'native-project') {
        if ($RelativePath -cne $expectedPrefix) {
            throw "Native project must use the canonical data/project.json path: $RelativePath"
        }
    } elseif (-not $RelativePath.StartsWith($expectedPrefix, [StringComparison]::Ordinal) -or
        -not $RelativePath.EndsWith('.json', [StringComparison]::Ordinal)) {
        throw "Native $Role path must be a canonical JSON file below $expectedPrefix`: $RelativePath"
    }

    $current = $Root
    foreach ($segment in $RelativePath.Split('/')) {
        $current = Join-Path $current $segment
        if (-not (Test-Path -LiteralPath $current)) { throw "Referenced native data file is missing: $RelativePath" }
        $item = Get-Item -LiteralPath $current -Force
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Referenced native data file traverses a reparse point: $RelativePath"
        }
    }
    if (-not (Test-Path -LiteralPath $current -PathType Leaf)) { throw "Referenced native data path is not a file: $RelativePath" }
    [void](Assert-NoReparseTraversal -Path $current -Label "Native data $RelativePath")
    $resolved = (Resolve-Path -LiteralPath $current).Path
    if (-not (Test-IsInsideRoot -Candidate $resolved -Root $Root)) { throw "Native data path resolves outside ProjectRoot: $RelativePath" }
    return $resolved
}

function Get-PeMachine {
    param([Parameter(Mandatory = $true)][string]$Path)
    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    $reader = [IO.BinaryReader]::new($stream)
    try {
        if ($stream.Length -lt 64 -or $reader.ReadUInt16() -ne 0x5A4D) { throw "Not a valid PE file: $Path" }
        $stream.Seek(0x3C, [IO.SeekOrigin]::Begin) | Out-Null
        $peOffset = $reader.ReadInt32()
        if ($peOffset -lt 0 -or $peOffset + 6 -gt $stream.Length) { throw "Invalid PE header offset: $Path" }
        $stream.Seek($peOffset, [IO.SeekOrigin]::Begin) | Out-Null
        if ($reader.ReadUInt32() -ne 0x00004550) { throw "Missing PE signature: $Path" }
        return $reader.ReadUInt16()
    } finally {
        $reader.Dispose()
        $stream.Dispose()
    }
}

function Assert-PeArchitecture {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$ExpectedArchitecture,
        [Parameter(Mandatory = $true)][string]$Label
    )
    $expectedMachine = if ($ExpectedArchitecture -eq 'arm64') { 0xAA64 } else { 0x8664 }
    $actualMachine = Get-PeMachine -Path $Path
    if ($actualMachine -ne $expectedMachine) {
        throw ('{0} PE architecture mismatch: expected {1} (0x{2:X4}), got 0x{3:X4}.' -f $Label, $ExpectedArchitecture, $expectedMachine, $actualMachine)
    }
}

function ConvertTo-PortableName {
    param([Parameter(Mandatory = $true)][string]$Value)
    $name = $Value.Normalize([Text.NormalizationForm]::FormKC)
    $name = [Text.RegularExpressions.Regex]::Replace($name, '[^A-Za-z0-9._-]+', '-')
    $name = $name.Trim('-', '.', ' ')
    if (-not $name) { $name = 'RPGCreatorAI-Game' }
    if ($name -match '^(?i:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$') { $name = "Game-$name" }
    if ($name.Length -gt 80) { $name = $name.Substring(0, 80).TrimEnd('-', '.') }
    return $name
}

$resolvedProjectRoot = Resolve-ExistingDirectory -Value $ProjectRoot -Label 'ProjectRoot'
$resolvedGameBundle = Resolve-ExistingFile -Value $GameBundlePath -Label 'GameBundle'
$resolvedProvenance = Resolve-ExistingFile -Value $ProvenancePath -Label 'Provenance'
$resolvedAllowlist = Resolve-ExistingFile -Value $AssetAllowlistPath -Label 'Asset allowlist'
$resolvedApprovalGate = Resolve-ExistingFile -Value $AssetApprovalGatePath -Label 'Asset approval gate'
$resolvedCompilerWarnings = Resolve-ExistingFile -Value $CompilerWarningsPath -Label 'Compiler warnings'
$canonicalApprovalGate = [IO.Path]::GetFullPath((Join-Path $resolvedProjectRoot 'release-input\asset-approval-gate.v1.json'))
if (-not $resolvedApprovalGate.Equals($canonicalApprovalGate, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Asset approval gate must be the canonical ProjectRoot release-input file: $canonicalApprovalGate"
}
$resolvedAcceptanceEvidence = $null
if ($RequireAcceptedHumanReview) {
    $acceptanceCandidate = Join-Path $resolvedProjectRoot 'release-input\editor-acceptance-evidence.v1.json'
    if (-not (Test-Path -LiteralPath $acceptanceCandidate -PathType Leaf)) {
        throw 'RequireAcceptedHumanReview was specified, but canonical editor-acceptance-evidence.v1.json is missing.'
    }
    $resolvedAcceptanceEvidence = Resolve-ExistingFile -Value $acceptanceCandidate -Label 'Editor acceptance evidence'
}
$gameReleaseContractPath = Join-Path $resolvedProjectRoot 'release-input\game-release.v1.json'
$gameReleaseContract = $null
if (Test-Path -LiteralPath $gameReleaseContractPath -PathType Leaf) {
    $gameReleaseContract = Read-JsonDocument -Path $gameReleaseContractPath -Label 'Game release descriptor' -MaxBytes 256KB
    if ((Get-JsonProperty -Value $gameReleaseContract -Name 'schemaVersion') -ne 1 -or
        [string](Get-JsonProperty -Value $gameReleaseContract -Name 'releaseId') -notmatch '\S') {
        throw 'Game release descriptor must use schemaVersion 1 and a non-empty releaseId.'
    }
    $releaseStatus = [string](Get-JsonProperty -Value $gameReleaseContract -Name 'status')
    if ($releaseStatus -notin @('pending', 'locked')) { throw 'Game release descriptor status must be pending or locked.' }
    $releaseVersion = Get-JsonProperty -Value $gameReleaseContract -Name 'version'
    if ($releaseStatus -eq 'pending' -and $null -ne $releaseVersion) { throw 'Pending game release descriptor must keep version null.' }
    if ($releaseStatus -eq 'locked' -and [string]$releaseVersion -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$') { throw 'Locked game release descriptor must contain a semantic version.' }
    if ($RequireAcceptedHumanReview -and $releaseStatus -ne 'locked') {
        throw 'Accepted Windows releases require a locked game-release.v1.json descriptor; no editor/package version is inferred.'
    }
    if ($releaseStatus -eq 'locked') {
        if ($Version -and $Version -cne [string]$releaseVersion) { throw "-Version $Version does not match the locked game release version $releaseVersion." }
        $Version = [string]$releaseVersion
    }
} elseif ($RequireAcceptedHumanReview) {
    throw "Accepted Windows releases require the canonical game release descriptor: $gameReleaseContractPath"
}

$nativeDataAllowlist = [Collections.Generic.List[string]]::new()
$nativeDataSeen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$nativeSourcesByPath = @{}
$nativeRolesByPath = @{}
$nativeDataDocument = [ordered]@{}
$nativeDataBytes = [long]0

function Add-NativeDataReference {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][ValidateSet('native-project', 'native-map', 'native-database')][string]$Role,
        [Parameter(Mandatory = $true)][long]$MaxBytes
    )
    if ($nativeDataAllowlist.Count -ge $maxNativeShardCount) {
        throw "Native data allowlist exceeds the $maxNativeShardCount-file release limit."
    }
    if (-not $nativeDataSeen.Add($RelativePath)) {
        throw "Native data contains a case-insensitive duplicate reference: $RelativePath"
    }
    $source = Resolve-ProjectNativeDataFile -Root $resolvedProjectRoot -RelativePath $RelativePath -Role $Role
    $sourceItem = Get-Item -LiteralPath $source -Force
    if ($sourceItem.Length -le 0 -or $sourceItem.Length -gt $MaxBytes) {
        throw "Native data file $RelativePath must contain between 1 and $MaxBytes bytes."
    }
    $script:nativeDataBytes += [long]$sourceItem.Length
    if ($script:nativeDataBytes -gt $maxNativeDataBytes) {
        throw "Native data exceeds the $maxNativeDataBytes-byte release limit."
    }
    $document = Read-JsonDocument -Path $source -Label "Native data $RelativePath" -MaxBytes $MaxBytes
    $nativeDataAllowlist.Add($RelativePath)
    $nativeSourcesByPath[$RelativePath] = $source
    $nativeRolesByPath[$RelativePath] = $Role
    $nativeDataDocument[$RelativePath] = $document
}

Add-NativeDataReference -RelativePath 'data/project.json' -Role 'native-project' -MaxBytes $maxNativeProjectBytes
$nativeProject = $nativeDataDocument['data/project.json']
$nativeMaps = Get-JsonProperty -Value $nativeProject -Name 'maps'
if ($null -eq $nativeMaps -or -not ($nativeMaps -is [Array]) -or $nativeMaps.Count -eq 0) {
    throw 'Native data/project.json maps must be a non-empty array.'
}
if ($nativeMaps.Count -gt ($maxNativeShardCount - 1)) {
    throw "Native project maps exceed the $($maxNativeShardCount - 1)-entry release limit."
}
$nativeMapIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($mapReference in $nativeMaps) {
    $nativeMapId = Get-JsonProperty -Value $mapReference -Name 'id'
    $nativeMapPath = Get-JsonProperty -Value $mapReference -Name 'path'
    if (-not ($nativeMapId -is [string]) -or $nativeMapId -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$') {
        throw 'Native project map ids must be portable strings of at most 128 characters.'
    }
    if (-not $nativeMapIds.Add($nativeMapId)) { throw "Native project contains a duplicate map id: $nativeMapId" }
    if (-not ($nativeMapPath -is [string])) { throw "Native project map $nativeMapId has no path." }
    Add-NativeDataReference -RelativePath $nativeMapPath -Role 'native-map' -MaxBytes $maxNativeShardBytes
}
$nativeStartMapId = Get-JsonProperty -Value $nativeProject -Name 'startMapId'
if (-not ($nativeStartMapId -is [string]) -or -not $nativeMapIds.Contains($nativeStartMapId)) {
    throw 'Native project startMapId must identify exactly one declared map.'
}

$nativeDatabase = Get-JsonProperty -Value $nativeProject -Name 'database'
if (-not ($nativeDatabase -is [pscustomobject])) { throw 'Native data/project.json database must be an object.' }
$unknownDatabaseKeys = @($nativeDatabase.PSObject.Properties.Name | Where-Object { $_ -cnotin $runtimeDatabaseKeys })
if ($unknownDatabaseKeys.Count -gt 0) {
    throw "Native project declares database keys unknown to this runtime: $($unknownDatabaseKeys -join ', ')"
}
if ($null -eq $nativeDatabase.PSObject.Properties['items']) {
    throw 'Native data/project.json must declare database.items.'
}
foreach ($databaseKey in $runtimeDatabaseKeys) {
    $databaseProperty = $nativeDatabase.PSObject.Properties[$databaseKey]
    if ($null -eq $databaseProperty) { continue }
    $databasePath = $databaseProperty.Value
    if (-not ($databasePath -is [string])) { throw "Native project database.$databaseKey must be a canonical string path." }
    Add-NativeDataReference -RelativePath $databasePath -Role 'native-database' -MaxBytes $maxNativeShardBytes
}

if (-not $ReadmePath) { $ReadmePath = Join-Path $repoRoot 'README.md' }
if (-not $LicensePath) { $LicensePath = Join-Path $repoRoot 'LICENSE' }
$resolvedReadme = Resolve-ExistingFile -Value $ReadmePath -Label 'README'
$resolvedLicense = Resolve-ExistingFile -Value $LicensePath -Label 'License'

$localDebugDir = Resolve-LocalAppDataPath -Leaf 'RPGCreatorAI\tauri-target\debug'
if (-not $PackagedExe) {
    foreach ($candidateName in @('RPGCreatorAI.exe', 'rpgcreator-shell.exe')) {
        $candidate = Join-Path $localDebugDir $candidateName
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { $PackagedExe = $candidate; break }
    }
}
if (-not $PackagedExe) { throw "Packaged launcher was not found under $localDebugDir. Build it separately before export." }
$resolvedPackagedExe = Resolve-ExistingFile -Value $PackagedExe -Label 'Packaged launcher'

if (-not $RuntimeExe) {
    $colocatedRuntime = Join-Path (Split-Path -Parent $resolvedPackagedExe) 'rpg_creator_runtime.exe'
    $nativeRuntime = Resolve-LocalAppDataPath -Leaf 'RPGCreatorAI\build\rpg_creator_runtime.exe'
    if (Test-Path -LiteralPath $colocatedRuntime -PathType Leaf) { $RuntimeExe = $colocatedRuntime }
    elseif (Test-Path -LiteralPath $nativeRuntime -PathType Leaf) { $RuntimeExe = $nativeRuntime }
}
if (-not $RuntimeExe) { throw 'Native runtime was not found. Build it separately before export.' }
$resolvedRuntimeExe = Resolve-ExistingFile -Value $RuntimeExe -Label 'Native runtime'

Assert-PeArchitecture -Path $resolvedPackagedExe -ExpectedArchitecture $Architecture -Label 'Packaged launcher'
Assert-PeArchitecture -Path $resolvedRuntimeExe -ExpectedArchitecture $Architecture -Label 'Native runtime'

$resolvedRuntimeLibraries = @()
foreach ($library in @($RuntimeLibraryPath)) {
    $resolvedLibrary = Resolve-ExistingFile -Value $library -Label 'Runtime library'
    if ([IO.Path]::GetExtension($resolvedLibrary) -ne '.dll') { throw "Runtime library must be a .dll: $resolvedLibrary" }
    Assert-PeArchitecture -Path $resolvedLibrary -ExpectedArchitecture $Architecture -Label 'Runtime library'
    $resolvedRuntimeLibraries += $resolvedLibrary
}

$bundle = Read-JsonDocument -Path $resolvedGameBundle -Label 'GameBundle' -MaxBytes $maxGameBundleBytes
$provenance = Read-JsonDocument -Path $resolvedProvenance -Label 'Provenance' -MaxBytes $maxSidecarBytes
$allowlistDocument = Read-JsonDocument -Path $resolvedAllowlist -Label 'Asset allowlist' -MaxBytes $maxEvidenceBytes
$approvalGate = Read-JsonDocument -Path $resolvedApprovalGate -Label 'Asset approval gate' -MaxBytes $maxEvidenceBytes
[void](Read-JsonDocument -Path $resolvedCompilerWarnings -Label 'Compiler warnings' -MaxBytes $maxEvidenceBytes)

$visualAllowlistNode = $allowlistDocument
if (-not ($visualAllowlistNode -is [Array])) {
    $visualAllowlistNode = Get-JsonProperty -Value $allowlistDocument -Name 'assetAllowlist'
}
if ($null -eq $visualAllowlistNode -or -not ($visualAllowlistNode -is [Array])) {
    throw 'Asset allowlist JSON must be an array or an object with an assetAllowlist array.'
}
$supplementalAudioNode = @()
$supplementalAnimationNode = @()
if (-not ($allowlistDocument -is [Array])) {
    $declaredSupplementalAudio = $allowlistDocument.PSObject.Properties['supplementalAudioAssetAllowlist']
    if ($null -ne $declaredSupplementalAudio) {
        if ($null -eq $declaredSupplementalAudio.Value) { $supplementalAudioNode = @() }
        else { $supplementalAudioNode = @($declaredSupplementalAudio.Value) }
    }
    $declaredSupplementalAnimation = $allowlistDocument.PSObject.Properties['supplementalAnimationAssetAllowlist']
    if ($null -ne $declaredSupplementalAnimation) {
        if ($null -eq $declaredSupplementalAnimation.Value) { $supplementalAnimationNode = @() }
        else { $supplementalAnimationNode = @($declaredSupplementalAnimation.Value) }
    }
}
if (-not ($supplementalAudioNode -is [Array])) { throw 'supplementalAudioAssetAllowlist must be an array when present.' }
if (-not ($supplementalAnimationNode -is [Array])) { throw 'supplementalAnimationAssetAllowlist must be an array when present.' }
if ($visualAllowlistNode.Count + $supplementalAnimationNode.Count + $supplementalAudioNode.Count -gt 10000) { throw 'Combined asset allowlist exceeds the 10000-entry release limit.' }
$allowlist = [Collections.Generic.List[string]]::new()
$allowlistSeen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$visualAllowlist = [Collections.Generic.List[string]]::new()
$supplementalAnimationAllowlist = [Collections.Generic.List[string]]::new()
$supplementalAudioAllowlist = [Collections.Generic.List[string]]::new()
foreach ($idValue in $visualAllowlistNode) {
    if (-not ($idValue -is [string]) -or -not $idValue.Trim() -or $idValue -ne $idValue.Trim()) {
        throw 'Asset allowlist entries must be non-blank canonical strings.'
    }
    if ($idValue -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$') {
        throw "Asset allowlist id is not portable: $idValue"
    }
    if (-not $allowlistSeen.Add($idValue)) { throw "Asset allowlist contains a case-insensitive duplicate: $idValue" }
    $allowlist.Add($idValue)
    $visualAllowlist.Add($idValue)
}
foreach ($idValue in $supplementalAnimationNode) {
    if (-not ($idValue -is [string]) -or -not $idValue.Trim() -or $idValue -ne $idValue.Trim()) {
        throw 'Supplemental animation allowlist entries must be non-blank canonical strings.'
    }
    if ($idValue -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$') {
        throw "Supplemental animation allowlist id is not portable: $idValue"
    }
    if (-not $allowlistSeen.Add($idValue)) { throw "Supplemental animation allowlist overlaps or duplicates an asset id: $idValue" }
    $allowlist.Add($idValue)
    $supplementalAnimationAllowlist.Add($idValue)
}
foreach ($idValue in $supplementalAudioNode) {
    if (-not ($idValue -is [string]) -or -not $idValue.Trim() -or $idValue -ne $idValue.Trim()) {
        throw 'Supplemental audio allowlist entries must be non-blank canonical strings.'
    }
    if ($idValue -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$') {
        throw "Supplemental audio allowlist id is not portable: $idValue"
    }
    if (-not $allowlistSeen.Add($idValue)) { throw "Supplemental audio allowlist overlaps or duplicates an asset id: $idValue" }
    $allowlist.Add($idValue)
    $supplementalAudioAllowlist.Add($idValue)
}

$bundleAssetCatalog = Get-JsonProperty -Value $bundle -Name 'assets'
if ($null -eq $bundleAssetCatalog) {
    $bundleAssetNode = [object[]]@()
} else {
$bundleAssetNode = Get-JsonProperty -Value $bundleAssetCatalog -Name 'assets'
}
if ($null -eq $bundleAssetNode) { $bundleAssetNode = [object[]]@() }
if (-not ($bundleAssetNode -is [Array])) { throw 'GameBundle assets.assets must be an array.' }
if ($bundleAssetNode.Count -gt 10000) { throw 'GameBundle asset catalog exceeds the 10000-entry release limit.' }
$bundleAssetsById = @{}
foreach ($asset in $bundleAssetNode) {
    $assetId = Get-JsonProperty -Value $asset -Name 'id'
    if (-not ($assetId -is [string]) -or -not $assetId.Trim()) { throw 'GameBundle contains an asset without a valid id.' }
    if ($bundleAssetsById.ContainsKey($assetId)) { throw "GameBundle contains a duplicate asset id: $assetId" }
    $bundleAssetsById[$assetId] = $asset
}
foreach ($assetId in $allowlist) {
    if (-not $bundleAssetsById.ContainsKey($assetId)) { throw "Allowlisted asset is missing from GameBundle: $assetId" }
}
foreach ($assetId in $bundleAssetsById.Keys) {
    if (-not $allowlistSeen.Contains([string]$assetId)) { throw "GameBundle asset is not allowlisted: $assetId" }
}
if ($RequireAcceptedHumanReview) {
    $acceptanceDocument = Read-JsonDocument -Path $resolvedAcceptanceEvidence -Label 'Editor acceptance evidence' -MaxBytes $maxEvidenceBytes
    Assert-G4AcceptanceEvidence -Evidence $acceptanceDocument -BundleAssets @($bundleAssetNode) -TemplateRoot $resolvedProjectRoot -GameBundlePath $resolvedGameBundle
}

# The approval gate is editor/review evidence rather than runtime data, so it
# is validated before packaging but deliberately not copied into the portable.
# This prevents a caller from bypassing review by supplying only a fabricated
# allowlist/provenance pair, and prevents fixture-only candidate bytes from
# being promoted under a different filename.
if ((Get-JsonProperty -Value $approvalGate -Name 'schemaVersion') -ne 1) {
    throw 'Asset approval gate must use schemaVersion 1.'
}
if ((Get-JsonProperty -Value $approvalGate -Name 'releaseReady') -ne $true) {
    throw 'Asset approval gate is not release-ready.'
}
$approvalGateBlockersProperty = $approvalGate.PSObject.Properties['blockers']
if ($null -eq $approvalGateBlockersProperty) { throw 'Asset approval gate must declare blockers[].' }
if ($null -eq $approvalGateBlockersProperty.Value) {
    $approvalGateBlockers = [object[]]@()
} else {
    $approvalGateBlockers = @($approvalGateBlockersProperty.Value)
}
if ($approvalGateBlockers.Count -ne 0) { throw 'A release-ready asset approval gate cannot retain blockers.' }

$declaredApprovedProperty = $approvalGate.PSObject.Properties['approvedAssetIds']
if ($null -eq $declaredApprovedProperty) { throw 'Asset approval gate must declare approvedAssetIds[].' }
if ($null -eq $declaredApprovedProperty.Value) {
    $declaredApprovedIds = [object[]]@()
} else {
    $declaredApprovedIds = @($declaredApprovedProperty.Value)
}
$declaredApprovedSeen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($assetIdValue in $declaredApprovedIds) {
    if (-not ($assetIdValue -is [string]) -or $assetIdValue -notmatch '^[a-z0-9][a-z0-9._-]{0,127}$') {
        throw 'Asset approval gate approvedAssetIds must contain lower-case portable identifiers.'
    }
    if (-not $declaredApprovedSeen.Add($assetIdValue)) {
        throw "Asset approval gate contains a case-insensitive duplicate approved id: $assetIdValue"
    }
}

$requiredSlotsProperty = $approvalGate.PSObject.Properties['requiredSlots']
if ($null -eq $requiredSlotsProperty -or $null -eq $requiredSlotsProperty.Value) {
    throw 'Asset approval gate must declare a non-empty requiredSlots array.'
}
$requiredSlots = @($requiredSlotsProperty.Value)
if ($requiredSlots.Count -eq 0) { throw 'Asset approval gate requiredSlots cannot be empty.' }
$fixtureOnlyHashes = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
foreach ($slot in $requiredSlots) {
    $candidate = Get-JsonProperty -Value $slot -Name 'candidate'
    # Legacy fixture candidates remain denylisted when present. New
    # project-owned generated assets may be approved without a fixture
    # candidate, so absence is valid and contributes no denylist hash.
    if ($null -eq $candidate) { continue }
    if ((Get-JsonProperty -Value $candidate -Name 'fixtureOnly') -ne $true) {
        throw 'Any approval-gate candidate evidence must be explicitly fixtureOnly.'
    }
    $candidateHash = Get-JsonProperty -Value $candidate -Name 'sha256'
    if (-not ($candidateHash -is [string]) -or $candidateHash -notmatch '^[a-f0-9]{64}$') {
        throw 'Fixture-only candidate must carry a valid lower-case SHA-256.'
    }
    [void]$fixtureOnlyHashes.Add($candidateHash)
}
$slotSeen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$assetApprovalsById = @{}
foreach ($slot in $requiredSlots) {
    $slotId = Get-JsonProperty -Value $slot -Name 'slotId'
    if (-not ($slotId -is [string]) -or $slotId -notmatch '^[a-z0-9][a-z0-9._-]{0,127}$') {
        throw 'Asset approval gate contains a required slot without a lower-case portable slotId.'
    }
    if (-not $slotSeen.Add($slotId)) { throw "Asset approval gate contains a duplicate slot: $slotId" }
    $reviewState = Get-JsonProperty -Value $slot -Name 'reviewState'
    if ($reviewState -notin @('approved', 'frozen') -or (Get-JsonProperty -Value $slot -Name 'releaseEligible') -ne $true) {
        throw "Asset approval gate slot is not approved/frozen and release-eligible: $slotId"
    }
    $slotBlockersProperty = $slot.PSObject.Properties['blockers']
    if ($null -eq $slotBlockersProperty -or $null -eq $slotBlockersProperty.Value) {
        $slotBlockers = [object[]]@()
    } else {
        $slotBlockers = @($slotBlockersProperty.Value)
    }
    if ($slotBlockers.Count -ne 0) { throw "Approved asset slot retains blockers: $slotId" }
    $approval = Get-JsonProperty -Value $slot -Name 'approval'
    if ($null -eq $approval) { throw "Approved asset slot has no approval record: $slotId" }
    $approvalAssetId = Get-JsonProperty -Value $approval -Name 'assetId'
    if (-not ($approvalAssetId -is [string]) -or $approvalAssetId -cne $slotId) {
        throw "Asset approval id must exactly match its slot id: $slotId"
    }
    $approvalRuntimePath = Get-JsonProperty -Value $approval -Name 'runtimePath'
    if (-not ($approvalRuntimePath -is [string])) { throw "Approved asset has no runtimePath: $slotId" }
    Assert-SafePortablePath -Value $approvalRuntimePath -Label "Approved asset $slotId runtimePath" -RequireAssetRoot
    $approvalSource = Get-JsonProperty -Value $approval -Name 'source'
    if ($approvalSource -notin @('local', 'imported', 'generated')) { throw "Approved asset has an invalid source: $slotId" }
    $approvalHash = Get-JsonProperty -Value $approval -Name 'sha256'
    if (-not ($approvalHash -is [string]) -or $approvalHash -notmatch '^[a-f0-9]{64}$') { throw "Approved asset has an invalid SHA-256: $slotId" }
    $approvalSize = Get-JsonProperty -Value $approval -Name 'sizeBytes'
    if (-not ($approvalSize -is [long] -or $approvalSize -is [int]) -or [long]$approvalSize -le 0) { throw "Approved asset has an invalid byte size: $slotId" }
    foreach ($field in @('licenseNote', 'reviewer', 'decidedAt')) {
        $fieldValue = Get-JsonProperty -Value $approval -Name $field
        if (-not ($fieldValue -is [string]) -or -not $fieldValue.Trim() -or $fieldValue -ne $fieldValue.Trim()) {
            throw "Approved asset is missing canonical $field review evidence: $slotId"
        }
    }
    $decisionTimestamp = [DateTimeOffset]::MinValue
    if (-not [DateTimeOffset]::TryParse([string](Get-JsonProperty -Value $approval -Name 'decidedAt'), [ref]$decisionTimestamp)) {
        throw "Approved asset has an invalid decidedAt timestamp: $slotId"
    }

    if ($fixtureOnlyHashes.Contains($approvalHash)) {
        throw "Fixture-only candidate bytes cannot be promoted into a release: $slotId"
    }
    $assetApprovalsById[$slotId] = $approval
}

if ($declaredApprovedSeen.Count -ne $visualAllowlist.Count -or $slotSeen.Count -ne $visualAllowlist.Count) {
    throw 'Asset approval gate, approvedAssetIds, requiredSlots, and visual assetAllowlist must be exact one-to-one sets.'
}
foreach ($assetId in $visualAllowlist) {
    $exactApprovedIdCount = @($declaredApprovedIds | Where-Object { $_ -is [string] -and $_ -ceq $assetId }).Count
    $exactSlotIdCount = @($requiredSlots | Where-Object { (Get-JsonProperty -Value $_ -Name 'slotId') -ceq $assetId }).Count
    if ($exactApprovedIdCount -ne 1 -or $exactSlotIdCount -ne 1 -or -not $assetApprovalsById.ContainsKey($assetId)) {
        throw "Allowlisted asset is not covered by an approved/frozen gate slot: $assetId"
    }
}
foreach ($assetId in $declaredApprovedIds) {
    if ($assetId -notin $visualAllowlist) { throw "Approved asset is absent from the visual assetAllowlist: $assetId" }
}

# Supplemental audio is intentionally outside the visual approval gate. It is
# still fail-closed: each audio id needs one deterministic provenance record,
# a generated-verified technical review, exact byte hash/size evidence, and
# either pending acceptance or canonical hash-bound acceptance before copying.
$supplementalAudioById = @{}
$supplementalAudioProvenance = Get-JsonProperty -Value $provenance -Name 'supplementalAudio'
if ($null -eq $supplementalAudioProvenance) { $supplementalAudioProvenance = @() }
if (-not ($supplementalAudioProvenance -is [Array])) { throw 'Provenance supplementalAudio must be an array when present.' }
foreach ($entry in $supplementalAudioProvenance) {
    $id = Get-JsonProperty -Value $entry -Name 'assetId'
    if (-not ($id -is [string]) -or -not $id.Trim() -or $id -ne $id.Trim()) { throw 'Supplemental audio provenance entry needs a canonical assetId.' }
    if ($supplementalAudioById.ContainsKey($id)) { throw "Supplemental audio provenance contains a duplicate id: $id" }
    $supplementalAudioById[$id] = $entry
}
foreach ($assetId in $supplementalAudioAllowlist) {
    $asset = $bundleAssetsById[$assetId]
    if ((Get-JsonProperty -Value $asset -Name 'kind') -cne 'audio') { throw "Supplemental allowlist asset must have GameBundle kind audio: $assetId" }
    if (-not $supplementalAudioById.ContainsKey($assetId)) { throw "Supplemental audio asset has no provenance entry: $assetId" }
}
foreach ($assetId in $supplementalAudioById.Keys) {
    if ($assetId -notin $supplementalAudioAllowlist) { throw "Supplemental audio provenance is not allowlisted: $assetId" }
}

# Supplemental animation is intentionally outside the seven visual approval
# slots. It remains fail-closed with explicit spritesheet metadata, exact
# generated byte evidence; acceptance, when present, must be hash-bound.
$supplementalAnimationById = @{}
$supplementalAnimationProvenance = Get-JsonProperty -Value $provenance -Name 'supplementalAnimation'
if ($null -eq $supplementalAnimationProvenance) { $supplementalAnimationProvenance = @() }
if (-not ($supplementalAnimationProvenance -is [Array])) { throw 'Provenance supplementalAnimation must be an array when present.' }
foreach ($entry in $supplementalAnimationProvenance) {
    $id = Get-JsonProperty -Value $entry -Name 'assetId'
    if (-not ($id -is [string]) -or -not $id.Trim() -or $id -ne $id.Trim()) { throw 'Supplemental animation provenance entry needs a canonical assetId.' }
    if ($supplementalAnimationById.ContainsKey($id)) { throw "Supplemental animation provenance contains a duplicate id: $id" }
    $supplementalAnimationById[$id] = $entry
}
foreach ($assetId in $supplementalAnimationAllowlist) {
    if (-not $bundleAssetsById.ContainsKey($assetId)) { throw "Supplemental animation asset is missing from GameBundle: $assetId" }
    $asset = $bundleAssetsById[$assetId]
    if ((Get-JsonProperty -Value $asset -Name 'kind') -cne 'spritesheet') { throw "Supplemental animation asset must have GameBundle kind spritesheet: $assetId" }
    if (-not $supplementalAnimationById.ContainsKey($assetId)) { throw "Supplemental animation asset has no provenance entry: $assetId" }
    $entry = $supplementalAnimationById[$assetId]
    if ((Get-JsonProperty -Value $entry -Name 'runtimePath') -cne (Get-JsonProperty -Value $asset -Name 'path') -or
        (Get-JsonProperty -Value $entry -Name 'source') -cne (Get-JsonProperty -Value $asset -Name 'source')) {
        throw "Supplemental animation runtimePath/source does not match GameBundle: $assetId"
    }
    $generated = Get-JsonProperty -Value $entry -Name 'generated'
    $technicalReview = Get-JsonProperty -Value $entry -Name 'technicalReview'
    $humanAcceptance = Get-JsonProperty -Value $entry -Name 'humanAcceptance'
    if ($null -eq $generated -or [string](Get-JsonProperty -Value $generated -Name 'outputSha256') -notmatch '^[a-f0-9]{64}$' -or
        [long](Get-JsonProperty -Value $generated -Name 'outputSizeBytes') -le 0) {
        throw "Supplemental animation generated hash/size evidence is invalid: $assetId"
    }
    if ($null -eq $technicalReview -or [string](Get-JsonProperty -Value $technicalReview -Name 'state') -cne 'generated-verified') { throw "Supplemental animation lacks generated-verified technical review: $assetId" }
    if (-not (Test-HumanAcceptanceRecord -Acceptance $humanAcceptance -TemplateRoot $resolvedProjectRoot -AssetId $assetId -ExpectedHash ([string](Get-JsonProperty -Value $generated -Name 'outputSha256')) -RequireAccepted:$RequireAcceptedHumanReview)) { throw "Supplemental animation human acceptance is missing or not hash-bound: $assetId" }
}
foreach ($assetId in $supplementalAnimationById.Keys) {
    if ($assetId -notin $supplementalAnimationAllowlist) { throw "Supplemental animation provenance is not allowlisted: $assetId" }
}

if (-not $Version) {
    $packageMetadata = Read-JsonDocument -Path (Join-Path $repoRoot 'package.json') -Label 'package.json'
    $Version = [string](Get-JsonProperty -Value $packageMetadata -Name 'version')
}
if ($Version -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$') { throw "Version must be semantic version text: $Version" }

if (-not $ArtifactName) {
    $projectMetadata = Get-JsonProperty -Value $bundle -Name 'project'
    if ($null -ne $projectMetadata) { $ArtifactName = [string](Get-JsonProperty -Value $projectMetadata -Name 'title') }
}
if (-not $ArtifactName) { $ArtifactName = 'RPGCreatorAI-Game' }
$portableName = ConvertTo-PortableName -Value $ArtifactName
if ($portableName.Equals('rpg_creator_runtime', [StringComparison]::OrdinalIgnoreCase)) { $portableName = "$portableName-game" }
$artifactDirectoryName = "$portableName-v$Version-windows-$Architecture-portable-$Qualifier"

if (-not $OutputRoot) { $OutputRoot = Resolve-LocalAppDataPath -Leaf 'RPGCreatorAI\release-artifacts' }
if (-not [IO.Path]::IsPathRooted($OutputRoot)) { $OutputRoot = Join-Path $invocationRoot $OutputRoot }
$resolvedOutputRoot = (Assert-LocalFilesystemPath -Path $OutputRoot -Label 'OutputRoot').TrimEnd('\', '/')
if ($resolvedOutputRoot.Equals($repoRoot, [StringComparison]::OrdinalIgnoreCase) -or (Test-IsInsideRoot -Candidate $resolvedOutputRoot -Root $repoRoot)) {
    throw 'Portable release output must remain outside the repository.'
}
if (Test-Path -LiteralPath $resolvedOutputRoot -PathType Leaf) { throw "OutputRoot is a file: $resolvedOutputRoot" }
[IO.Directory]::CreateDirectory($resolvedOutputRoot) | Out-Null
[void](Assert-NoReparseTraversal -Path $resolvedOutputRoot -Label 'OutputRoot')
$resolvedOutputRoot = (Get-Item -LiteralPath $resolvedOutputRoot -Force).FullName.TrimEnd('\', '/')
if ($resolvedOutputRoot.Equals($repoRoot, [StringComparison]::OrdinalIgnoreCase) -or (Test-IsInsideRoot -Candidate $resolvedOutputRoot -Root $repoRoot)) {
    throw 'Resolved portable release output must remain outside the repository.'
}

$finalDirectory = Join-Path $resolvedOutputRoot $artifactDirectoryName
$finalManifest = "$finalDirectory.release-manifest.v1.json"
$finalReport = "$finalDirectory.validation-report.json"
foreach ($reservedOutput in @($finalDirectory, $finalManifest, $finalReport)) {
    if (Test-Path -LiteralPath $reservedOutput) { throw "Refusing to overwrite existing release output: $reservedOutput" }
}

$filePlan = [Collections.Generic.List[object]]::new()
$targetPaths = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
function Add-FilePlan {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Target,
        [Parameter(Mandatory = $true)][string]$Role,
        [string]$AssetId
    )
    Assert-SafePortablePath -Value $Target -Label "Release target $Target" -RequireAssetRoot:($Role -eq 'asset')
    if (-not $targetPaths.Add($Target)) { throw "Release target collision: $Target" }
    $filePlan.Add([pscustomobject]@{ Source = $Source; Target = $Target; Role = $Role; AssetId = $AssetId })
}

Add-FilePlan -Source $resolvedPackagedExe -Target "$portableName.exe" -Role 'launcher'
Add-FilePlan -Source $resolvedRuntimeExe -Target 'rpg_creator_runtime.exe' -Role 'runtime'
foreach ($library in $resolvedRuntimeLibraries) {
    Add-FilePlan -Source $library -Target ([IO.Path]::GetFileName($library)) -Role 'runtime-library'
}
foreach ($nativePath in $nativeDataAllowlist) {
    Add-FilePlan -Source $nativeSourcesByPath[$nativePath] -Target $nativePath -Role $nativeRolesByPath[$nativePath]
}
Add-FilePlan -Source $resolvedGameBundle -Target 'data/game-bundle.v1.json' -Role 'game-bundle'
Add-FilePlan -Source $resolvedProvenance -Target 'data/asset-provenance.v1.json' -Role 'provenance'
if ($RequireAcceptedHumanReview) { Add-FilePlan -Source $gameReleaseContractPath -Target 'data/game-release.v1.json' -Role 'release-contract' }
if ($RequireAcceptedHumanReview) { Add-FilePlan -Source $resolvedAcceptanceEvidence -Target 'data/editor-acceptance-evidence.v1.json' -Role 'acceptance-evidence' }
Add-FilePlan -Source $resolvedLicense -Target 'LICENSE.txt' -Role 'license'
Add-FilePlan -Source $resolvedReadme -Target 'README.md' -Role 'readme'

foreach ($assetId in $allowlist) {
    $asset = $bundleAssetsById[$assetId]
    $runtimePath = Get-JsonProperty -Value $asset -Name 'path'
    if (-not ($runtimePath -is [string])) { throw "Allowlisted asset has no runtime path: $assetId" }
    $assetSource = Get-JsonProperty -Value $asset -Name 'source'
    $sourcePath = Resolve-ProjectAssetFile -Root $resolvedProjectRoot -RelativePath $runtimePath -AssetId $assetId
    $sourceItem = Get-Item -LiteralPath $sourcePath -Force
    $sourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($assetId -in $visualAllowlist) {
        $approval = $assetApprovalsById[$assetId]
        if ((Get-JsonProperty -Value $approval -Name 'runtimePath') -cne $runtimePath) {
            throw "Approved runtimePath does not match GameBundle for visual asset: $assetId"
        }
        if ((Get-JsonProperty -Value $approval -Name 'source') -cne $assetSource) {
            throw "Approved source does not match GameBundle for visual asset: $assetId"
        }
        if ([long](Get-JsonProperty -Value $approval -Name 'sizeBytes') -ne [long]$sourceItem.Length -or
            [string](Get-JsonProperty -Value $approval -Name 'sha256') -cne $sourceHash) {
            throw "Approved size/hash does not match local runtime bytes for visual asset: $assetId"
        }
    } elseif ($assetId -in $supplementalAnimationAllowlist) {
        $animationProvenance = $supplementalAnimationById[$assetId]
        if ((Get-JsonProperty -Value $animationProvenance -Name 'runtimePath') -cne $runtimePath -or
            (Get-JsonProperty -Value $animationProvenance -Name 'source') -cne $assetSource) {
            throw "Supplemental animation runtimePath/source does not match GameBundle: $assetId"
        }
        $generation = Get-JsonProperty -Value $animationProvenance -Name 'generated'
        $technicalReview = Get-JsonProperty -Value $animationProvenance -Name 'technicalReview'
        $humanAcceptance = Get-JsonProperty -Value $animationProvenance -Name 'humanAcceptance'
        if ($null -eq $generation -or [string](Get-JsonProperty -Value $generation -Name 'outputSha256') -cne $sourceHash -or
            [long](Get-JsonProperty -Value $generation -Name 'outputSizeBytes') -ne [long]$sourceItem.Length) {
            throw "Supplemental animation generation hash/size does not match local runtime bytes: $assetId"
        }
        if ($null -eq $technicalReview -or [string](Get-JsonProperty -Value $technicalReview -Name 'state') -cne 'generated-verified') { throw "Supplemental animation lacks generated-verified technical review: $assetId" }
        if (-not (Test-HumanAcceptanceRecord -Acceptance $humanAcceptance -TemplateRoot $resolvedProjectRoot -AssetId $assetId -ExpectedHash $sourceHash -RequireAccepted:$RequireAcceptedHumanReview)) { throw "Supplemental animation human acceptance is missing or not hash-bound: $assetId" }
    } else {
        $audioProvenance = $supplementalAudioById[$assetId]
        if ((Get-JsonProperty -Value $audioProvenance -Name 'runtimePath') -cne $runtimePath -or
            (Get-JsonProperty -Value $audioProvenance -Name 'source') -cne $assetSource) {
            throw "Supplemental audio runtimePath/source does not match GameBundle: $assetId"
        }
        $generation = Get-JsonProperty -Value $audioProvenance -Name 'generation'
        $technicalReview = Get-JsonProperty -Value $audioProvenance -Name 'technicalReview'
        $humanAcceptance = Get-JsonProperty -Value $audioProvenance -Name 'humanAcceptance'
        if ($null -eq $generation -or
            [string](Get-JsonProperty -Value $generation -Name 'outputSha256') -cne $sourceHash -or
            [long](Get-JsonProperty -Value $generation -Name 'outputSizeBytes') -ne [long]$sourceItem.Length) {
            throw "Supplemental audio generation hash/size does not match local runtime bytes: $assetId"
        }
        if ($null -eq $technicalReview -or [string](Get-JsonProperty -Value $technicalReview -Name 'state') -cne 'generated-verified') {
            throw "Supplemental audio lacks generated-verified technical review: $assetId"
        }
        if (-not (Test-HumanAcceptanceRecord -Acceptance $humanAcceptance -TemplateRoot $resolvedProjectRoot -AssetId $assetId -ExpectedHash $sourceHash -RequireAccepted:$RequireAcceptedHumanReview)) {
            throw "Supplemental audio human acceptance is missing or not hash-bound: $assetId"
        }
    }
    Add-FilePlan -Source $sourcePath -Target $runtimePath -Role 'asset' -AssetId $assetId
}

$fileEntries = @(
    foreach ($item in ($filePlan | Sort-Object -Property Target)) {
        $sourceItem = Get-Item -LiteralPath $item.Source -Force
        $entry = [ordered]@{
            path = $item.Target
            role = $item.Role
            sizeBytes = [long]$sourceItem.Length
            sha256 = (Get-FileHash -LiteralPath $item.Source -Algorithm SHA256).Hash.ToLowerInvariant()
        }
        if ($item.Role -eq 'asset') { $entry.assetId = $item.AssetId }
        [pscustomobject]$entry
    }
)

$manifest = [ordered]@{
    schemaVersion = 1
    target = 'windows-portable'
    artifact = [ordered]@{
        kind = 'portable-directory'
        name = $artifactDirectoryName
        version = $Version
        architecture = $Architecture
        entryExecutable = "$portableName.exe"
        runtimeExecutable = 'rpg_creator_runtime.exe'
        nativeProjectPath = 'data/project.json'
        gameBundlePath = 'data/game-bundle.v1.json'
        provenancePath = 'data/asset-provenance.v1.json'
    }
    assetAllowlist = @($allowlist.ToArray())
    supplementalAnimationAssetAllowlist = @($supplementalAnimationAllowlist.ToArray())
    supplementalAudioAssetAllowlist = @($supplementalAudioAllowlist.ToArray())
    nativeDataAllowlist = @($nativeDataAllowlist.ToArray())
    files = $fileEntries
}
if ($RequireAcceptedHumanReview) {
    $manifest.artifact.releaseContractPath = 'data/game-release.v1.json'
    $manifest.artifact.acceptanceEvidencePath = 'data/editor-acceptance-evidence.v1.json'
}

$runId = [Guid]::NewGuid().ToString('N')
$candidateManifest = Join-Path $resolvedOutputRoot ".$artifactDirectoryName.$runId.candidate-manifest.json"
$candidateNativeData = Join-Path $resolvedOutputRoot ".$artifactDirectoryName.$runId.native-data.json"
$candidateReport = Join-Path $resolvedOutputRoot ".$artifactDirectoryName.$runId.validation-report.json"
Write-JsonDocument -Path $candidateManifest -Value $manifest
Write-JsonDocument -Path $candidateNativeData -Value $nativeDataDocument -Compress
[void](Assert-NoReparseTraversal -Path $candidateManifest -Label 'Candidate manifest')
[void](Assert-NoReparseTraversal -Path $candidateNativeData -Label 'Candidate native data')

$validatorBootstrap = Join-Path $repoRoot 'scripts\dev\run-windows-portable-validator.mjs'
if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'node_modules\esbuild\package.json') -PathType Leaf)) {
    throw 'The existing esbuild dependency is required to run the TypeScript release gate. The exporter will not install dependencies.'
}
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if ($null -eq $nodeCommand) { throw 'Node.js is required to run the TypeScript release gate.' }

Write-Host '=== WINDOWS PORTABLE RELEASE GATE ==='
Write-Host "Artifact:       $artifactDirectoryName"
Write-Host "Project root:   $resolvedProjectRoot"
Write-Host "Output root:    $resolvedOutputRoot"
Write-Host "Allowlisted:    $($allowlist.Count) assets"
Write-Host "Native data:    $($nativeDataAllowlist.Count) files"

Push-Location $repoRoot
try {
    & $nodeCommand.Source $validatorBootstrap `
        --manifest $candidateManifest `
        --native-data $candidateNativeData `
        --game-bundle $resolvedGameBundle `
        --provenance $resolvedProvenance `
        --compiler-warnings $resolvedCompilerWarnings `
        --report $candidateReport
    $gateExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}
if ($gateExitCode -ne 0) {
    throw "Windows portable release contract failed (exit $gateExitCode). Evidence preserved at $candidateReport and $candidateNativeData"
}

if ($ValidateOnly) {
    Write-Host "Candidate manifest: $candidateManifest"
    Write-Host "Native data input:  $candidateNativeData"
    Write-Host "Validation report:  $candidateReport"
    Write-Host 'WINDOWS PORTABLE PREFLIGHT PASSED'
    exit 0
}

$stagingRoot = Join-Path $resolvedOutputRoot '.staging'
[IO.Directory]::CreateDirectory($stagingRoot) | Out-Null
[void](Assert-NoReparseTraversal -Path $stagingRoot -Label 'Staging root')
$stagingDirectory = Join-Path $stagingRoot "$artifactDirectoryName-$runId"
if (Test-Path -LiteralPath $stagingDirectory) { throw "Unexpected staging collision: $stagingDirectory" }
[IO.Directory]::CreateDirectory($stagingDirectory) | Out-Null
[void](Assert-NoReparseTraversal -Path $stagingDirectory -Label 'Staging directory')

try {
    foreach ($item in $filePlan) {
        [void](Assert-NoReparseTraversal -Path $item.Source -Label "Release source $($item.Target)")
        $destination = Join-Path $stagingDirectory ($item.Target.Replace('/', [IO.Path]::DirectorySeparatorChar))
        if (-not (Test-IsInsideRoot -Candidate $destination -Root $stagingDirectory)) {
            throw "Release destination escaped staging: $($item.Target)"
        }
        $destinationParent = Split-Path -Parent $destination
        [IO.Directory]::CreateDirectory($destinationParent) | Out-Null
        [void](Assert-NoReparseTraversal -Path $destinationParent -Label "Destination parent $($item.Target)")
        Copy-Item -LiteralPath $item.Source -Destination $destination
    }

    $stagedItems = @(Get-ChildItem -LiteralPath $stagingDirectory -Recurse -Force)
    $reparseItem = $stagedItems | Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 } | Select-Object -First 1
    if ($null -ne $reparseItem) { throw "Staging contains a reparse point: $($reparseItem.FullName)" }
    $stagedFiles = @($stagedItems | Where-Object { -not $_.PSIsContainer })
    if ($stagedFiles.Count -ne $fileEntries.Count) {
        throw "Staging file count mismatch: expected $($fileEntries.Count), got $($stagedFiles.Count)."
    }

    $expectedByPath = @{}
    foreach ($entry in $fileEntries) { $expectedByPath[$entry.path] = $entry }
    foreach ($file in $stagedFiles) {
        $relative = $file.FullName.Substring($stagingDirectory.Length).TrimStart('\', '/').Replace('\', '/')
        if (-not $expectedByPath.ContainsKey($relative)) { throw "Undeclared file appeared in staging: $relative" }
        $expected = $expectedByPath[$relative]
        $actualHash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        if ([long]$file.Length -ne [long]$expected.sizeBytes -or $actualHash -ne $expected.sha256) {
            throw "Staged file integrity mismatch: $relative"
        }
    }

    foreach ($reservedOutput in @($finalDirectory, $finalManifest, $finalReport)) {
        if (Test-Path -LiteralPath $reservedOutput) { throw "Refusing to overwrite release output created concurrently: $reservedOutput" }
    }
    [void](Assert-NoReparseTraversal -Path $resolvedOutputRoot -Label 'OutputRoot before publish')
    [void](Assert-NoReparseTraversal -Path $stagingDirectory -Label 'Staging directory before publish')
    [void](Assert-NoReparseTraversal -Path $candidateManifest -Label 'Candidate manifest before publish')
    [void](Assert-NoReparseTraversal -Path $candidateNativeData -Label 'Candidate native data before publish')
    [void](Assert-NoReparseTraversal -Path $candidateReport -Label 'Validation report before publish')
    Remove-Item -LiteralPath $candidateNativeData
    Move-Item -LiteralPath $stagingDirectory -Destination $finalDirectory
    Move-Item -LiteralPath $candidateManifest -Destination $finalManifest
    Move-Item -LiteralPath $candidateReport -Destination $finalReport
} catch {
    Write-Warning "Portable export failed; staging was preserved for inspection: $stagingDirectory"
    throw
}

Write-Host "Portable directory: $finalDirectory"
Write-Host "Release manifest:   $finalManifest"
Write-Host "Validation report:  $finalReport"
Write-Host 'WINDOWS PORTABLE EXPORT PASSED'
