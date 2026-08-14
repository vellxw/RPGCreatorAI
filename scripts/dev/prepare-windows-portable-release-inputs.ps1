<#
.SYNOPSIS
Produces a deterministic readiness report for the horror/BL Windows release inputs.

.DESCRIPTION
This is a read-only preflight unless -OutputPath is supplied. It never builds,
copies a release, installs dependencies, deletes files, or overwrites a report.
It also reports Android WebView staging readiness without staging or building
anything. Exit code 0 means the selected target is ready; exit code 3 means the
machine-readable report contains blockers that must be resolved first.
#>

[CmdletBinding()]
param(
    [string]$PlanPath,
    [string]$ProjectRoot,
    [string]$RuntimeExe,
    [string]$BlueprintPath,
    [string]$AssetManifestPath,
    [string]$AndroidWebDistPath,
    [string]$AndroidStagingPath,
    [ValidateSet('WindowsPortable', 'AndroidWebView', 'All')]
    [string]$Target = 'WindowsPortable',
    [switch]$RequireAcceptedHumanReview,
    [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$invocationRoot = (Get-Location).ProviderPath

function Resolve-ConfiguredPath {
    param(
        [Parameter(Mandatory = $true)][string]$Value,
        [Parameter(Mandatory = $true)][string]$Base
    )
    if ([IO.Path]::IsPathRooted($Value)) { return [IO.Path]::GetFullPath($Value) }
    return [IO.Path]::GetFullPath((Join-Path $Base $Value.Replace('/', [IO.Path]::DirectorySeparatorChar)))
}

function Read-JsonDocument {
    param([Parameter(Mandatory = $true)][string]$Path)
    $jsonCommand = Get-Command ConvertFrom-Json -ErrorAction Stop
    if ($jsonCommand.Parameters.ContainsKey('DateKind')) {
        return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json -DateKind String
    }
    return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Test-IsInsideRoot {
    param(
        [Parameter(Mandatory = $true)][string]$Candidate,
        [Parameter(Mandatory = $true)][string]$Root
    )
    $candidateFull = [IO.Path]::GetFullPath($Candidate)
    $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    return $candidateFull.Equals($rootFull, [StringComparison]::OrdinalIgnoreCase) -or
        $candidateFull.StartsWith("$rootFull$([IO.Path]::DirectorySeparatorChar)", [StringComparison]::OrdinalIgnoreCase)
}

function Resolve-ProjectFile {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][string]$Root
    )
    if ([string]::IsNullOrWhiteSpace($RelativePath) -or [IO.Path]::IsPathRooted($RelativePath) -or $RelativePath.Contains(':')) {
        return $null
    }
    $candidate = [IO.Path]::GetFullPath((Join-Path $Root $RelativePath.Replace('/', [IO.Path]::DirectorySeparatorChar)))
    if (-not (Test-IsInsideRoot -Candidate $candidate -Root $Root)) { return $null }
    return $candidate
}

function Get-LowerSha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Test-NonBlankString {
    param([object]$Value)
    return $Value -is [string] -and -not [string]::IsNullOrWhiteSpace([string]$Value) -and $Value -eq $Value.Trim()
}

function Test-EqualStringSet {
    param(
        [string[]]$Left = @(),
        [string[]]$Right = @()
    )
    $leftSet = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $rightSet = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($value in @($Left)) { if ($null -ne $value) { [void]$leftSet.Add([string]$value) } }
    foreach ($value in @($Right)) { if ($null -ne $value) { [void]$rightSet.Add([string]$value) } }
    return $leftSet.SetEquals($rightSet)
}

function Get-JsonProperty {
    param(
        [Parameter(Mandatory = $true)][object]$Value,
        [Parameter(Mandatory = $true)][string]$Name
    )
    $property = $Value.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
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
        -not ([string](Get-JsonProperty -Value $Acceptance -Name 'evidenceSha256') -match '^[a-f0-9]{64}$')) { return $false }
    $evidencePath = Resolve-ProjectFile -RelativePath $evidence -Root $TemplateRoot
    if (-not $evidencePath -or -not (Test-Path -LiteralPath $evidencePath -PathType Leaf)) { return $false }
    if ((Get-LowerSha256 -Path $evidencePath) -cne [string](Get-JsonProperty -Value $Acceptance -Name 'evidenceSha256')) { return $false }
    try { $evidenceDocument = Read-JsonDocument -Path $evidencePath } catch { return $false }
    if ([string](Get-JsonProperty -Value $evidenceDocument -Name 'status') -cne 'accepted') { return $false }
    $canonicalReviewer = Get-JsonProperty -Value (Get-JsonProperty -Value $evidenceDocument -Name 'reviewer') -Name 'label'
    $canonicalReviewedAt = Get-JsonProperty -Value $evidenceDocument -Name 'reviewedAt'
    if ([string]$canonicalReviewer -cne [string](Get-JsonProperty -Value $Acceptance -Name 'reviewer') -or
        [string]$canonicalReviewedAt -cne [string](Get-JsonProperty -Value $Acceptance -Name 'reviewedAt')) { return $false }
    $decision = @($evidenceDocument.resources | Where-Object { [string]$_.resourceId -ceq $AssetId })
    return @($decision).Count -eq 1 -and [string](Get-JsonProperty -Value $decision[0] -Name 'status') -ceq 'accepted' -and [string](Get-JsonProperty -Value $decision[0] -Name 'sha256') -ceq $ExpectedHash
}

function Get-G4AcceptanceEvidenceProblems {
    param(
        [Parameter(Mandatory = $true)][object]$Evidence,
        [Parameter(Mandatory = $true)][object[]]$BundleAssets,
        [Parameter(Mandatory = $true)][string]$TemplateRoot,
        [Parameter(Mandatory = $true)][string]$GameBundlePath
    )
    $problems = [Collections.Generic.List[string]]::new()
    try {
        if ((Get-JsonProperty -Value $Evidence -Name 'schemaVersion') -ne 1 -or
            [string](Get-JsonProperty -Value $Evidence -Name 'status') -cne 'accepted') {
            throw 'canonical evidence must use schemaVersion 1 and status accepted'
        }
        $reviewer = Get-JsonProperty -Value $Evidence -Name 'reviewer'
        $reviewerKind = [string](Get-JsonProperty -Value $reviewer -Name 'kind')
        $reviewerLabel = [string](Get-JsonProperty -Value $reviewer -Name 'label')
        if ($reviewerKind -notin @('human', 'delegated-by-creator') -or -not (Test-NonBlankString $reviewerLabel)) {
            throw 'canonical evidence reviewer must be human or delegated-by-creator with a label'
        }
        $reviewedAt = [DateTimeOffset]::MinValue
        if (-not [DateTimeOffset]::TryParse([string](Get-JsonProperty -Value $Evidence -Name 'reviewedAt'), [ref]$reviewedAt)) {
            throw 'canonical evidence reviewedAt is invalid'
        }
        $resourcesNode = Get-JsonProperty -Value $Evidence -Name 'resources'
        if ($null -eq $resourcesNode -or -not ($resourcesNode -is [Array])) { throw 'canonical evidence resources[] is missing' }
        $expectedIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        foreach ($asset in $BundleAssets) {
            $id = [string](Get-JsonProperty -Value $asset -Name 'id')
            if (-not (Test-NonBlankString $id) -or -not $expectedIds.Add($id)) { throw "GameBundle asset id is duplicate or invalid: $id" }
        }
        $seenIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        foreach ($decision in @($resourcesNode)) {
            $id = [string](Get-JsonProperty -Value $decision -Name 'resourceId')
            if (-not $expectedIds.Contains($id)) { throw "canonical evidence contains unknown resource: $id" }
            if (-not $seenIds.Add($id)) { throw "canonical evidence contains duplicate resource: $id" }
            if ([string](Get-JsonProperty -Value $decision -Name 'kind') -cne 'asset' -or
                [string](Get-JsonProperty -Value $decision -Name 'status') -cne 'accepted') { throw "canonical evidence decision is not accepted asset evidence: $id" }
            $declaredHash = [string](Get-JsonProperty -Value $decision -Name 'sha256')
            if ($declaredHash -notmatch '^[a-f0-9]{64}$') { throw "canonical evidence hash is invalid: $id" }
            $asset = @($BundleAssets | Where-Object { [string](Get-JsonProperty -Value $_ -Name 'id') -ceq $id })[0]
            $runtimePath = [string](Get-JsonProperty -Value $asset -Name 'path')
            if (-not $runtimePath.StartsWith('assets/', [StringComparison]::Ordinal)) { throw "canonical evidence runtime path is outside assets/: $id" }
            $runtimeFile = Resolve-ProjectFile -RelativePath $runtimePath -Root $TemplateRoot
            if (-not $runtimeFile -or -not (Test-Path -LiteralPath $runtimeFile -PathType Leaf)) { throw "canonical evidence runtime bytes are missing: $id" }
            if ((Get-LowerSha256 -Path $runtimeFile) -cne $declaredHash) { throw "canonical evidence hash does not match runtime bytes: $id" }
        }
        if ($seenIds.Count -ne $expectedIds.Count) { throw "canonical evidence must cover every GameBundle asset (expected $($expectedIds.Count), found $($seenIds.Count))" }
        if ([string](Get-JsonProperty -Value $Evidence -Name 'gameBundleSha256') -cne (Get-LowerSha256 -Path $GameBundlePath)) { throw 'canonical evidence gameBundleSha256 does not match the current GameBundle' }
        $assetManifestPath = Join-Path $TemplateRoot 'data\assets\assets-manifest.json'
        if (-not (Test-Path -LiteralPath $assetManifestPath -PathType Leaf)) { throw 'canonical asset manifest is missing for G4 evidence binding' }
        if ([string](Get-JsonProperty -Value $Evidence -Name 'assetManifestSha256') -cne (Get-LowerSha256 -Path $assetManifestPath)) { throw 'canonical evidence assetManifestSha256 does not match the current asset manifest' }
    } catch {
        $problems.Add($_.Exception.Message)
    }
    return @($problems)
}

function Get-PeMachine {
    param([Parameter(Mandatory = $true)][string]$Path)
    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    $reader = [IO.BinaryReader]::new($stream)
    try {
        if ($stream.Length -lt 64 -or $reader.ReadUInt16() -ne 0x5A4D) { return $null }
        $stream.Seek(0x3C, [IO.SeekOrigin]::Begin) | Out-Null
        $offset = $reader.ReadInt32()
        if ($offset -lt 0 -or $offset + 6 -gt $stream.Length) { return $null }
        $stream.Seek($offset, [IO.SeekOrigin]::Begin) | Out-Null
        if ($reader.ReadUInt32() -ne 0x00004550) { return $null }
        return ('0x{0:X4}' -f $reader.ReadUInt16())
    } finally {
        $reader.Dispose()
        $stream.Dispose()
    }
}

if (-not $PlanPath) {
    $PlanPath = Join-Path $repoRoot 'scripts\docs\fixtures\windows-portable\horror-bl-release-input.v1.json'
} else {
    $PlanPath = Resolve-ConfiguredPath -Value $PlanPath -Base $invocationRoot
}
if (-not (Test-Path -LiteralPath $PlanPath -PathType Leaf)) { throw "Release input plan not found: $PlanPath" }
$plan = Read-JsonDocument -Path $PlanPath

if (-not $ProjectRoot) { $ProjectRoot = [string]$plan.template.root }
$resolvedProjectRoot = Resolve-ConfiguredPath -Value $ProjectRoot -Base $repoRoot
if (-not $RuntimeExe) { $RuntimeExe = [string]$plan.runtime.executable }
$resolvedRuntime = Resolve-ConfiguredPath -Value $RuntimeExe -Base $repoRoot

if (-not $BlueprintPath) {
    $materializedBlueprint = Join-Path $resolvedProjectRoot 'data\content\vertical-slice.json'
    $BlueprintPath = if (Test-Path -LiteralPath $materializedBlueprint -PathType Leaf) {
        $materializedBlueprint
    } else {
        Resolve-ConfiguredPath -Value ([string]$plan.template.blueprint) -Base $repoRoot
    }
} else {
    $BlueprintPath = Resolve-ConfiguredPath -Value $BlueprintPath -Base $invocationRoot
}
if (-not $AssetManifestPath) {
    $materializedAssets = Join-Path $resolvedProjectRoot 'data\assets\assets-manifest.json'
    $AssetManifestPath = if (Test-Path -LiteralPath $materializedAssets -PathType Leaf) {
        $materializedAssets
    } else {
        Resolve-ConfiguredPath -Value ([string]$plan.template.assetManifest) -Base $repoRoot
    }
} else {
    $AssetManifestPath = Resolve-ConfiguredPath -Value $AssetManifestPath -Base $invocationRoot
}
if (-not $AndroidWebDistPath) {
    $AndroidWebDistPath = Join-Path $repoRoot 'output\android-web-runtime'
} else {
    $AndroidWebDistPath = Resolve-ConfiguredPath -Value $AndroidWebDistPath -Base $invocationRoot
}
if (-not $AndroidStagingPath) {
    $AndroidStagingPath = Join-Path $repoRoot 'output\android-webview'
} else {
    $AndroidStagingPath = Resolve-ConfiguredPath -Value $AndroidStagingPath -Base $invocationRoot
}

$checks = [Collections.Generic.List[object]]::new()
function Add-Check {
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [Parameter(Mandatory = $true)][string]$Gate,
        [Parameter(Mandatory = $true)][bool]$Ok,
        [Parameter(Mandatory = $true)][string]$Evidence,
        [Parameter(Mandatory = $true)][string]$Message,
        [Parameter(Mandatory = $true)][string]$Action,
        [string[]]$BlocksTargets = @('WindowsPortable'),
        [string]$Command = '',
        [string[]]$Missing = @()
    )
    $checks.Add([pscustomobject][ordered]@{
        id = $Id
        gate = $Gate
        status = if ($Ok) { 'ready' } else { 'blocked' }
        blocksTargets = @($BlocksTargets)
        evidence = $Evidence
        message = if ($Ok) { 'Gate passed.' } else { $Message }
        action = if ($Ok) { $null } else { $Action }
        command = if ($Ok -or [string]::IsNullOrWhiteSpace($Command)) { $null } else { $Command }
        missing = @($Missing | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
    })
}

$runtimeExists = Test-Path -LiteralPath $resolvedRuntime -PathType Leaf
$runtimeMachine = $null
$runtimeHash = $null
$runtimeLength = $null
if ($runtimeExists) {
    $runtimeItem = Get-Item -LiteralPath $resolvedRuntime -Force
    $runtimeLength = [long]$runtimeItem.Length
    $runtimeMachine = Get-PeMachine -Path $resolvedRuntime
    $runtimeHash = Get-LowerSha256 -Path $resolvedRuntime
}
$runtimeReady = $runtimeExists -and $runtimeMachine -eq [string]$plan.runtime.expectedPeMachine
Add-Check -Id 'RLS-000-runtime-binary' -Gate 'windows-runtime' -Ok $runtimeReady `
    -Evidence "path=$resolvedRuntime; exists=$runtimeExists; machine=$runtimeMachine; expected=$($plan.runtime.expectedPeMachine)" `
    -Message 'The reusable native runtime is missing or has the wrong PE architecture.' `
    -Action "Produce or select a $($plan.runtime.expectedPeMachine) runtime executable, then pass it with -RuntimeExe." `
    -Command ".\scripts\dev\prepare-windows-portable-release-inputs.ps1 -RuntimeExe '$resolvedRuntime' -Target WindowsPortable" `
    -Missing $(if ($runtimeReady) { @() } else { @([string]$plan.runtime.executable) })

$blueprint = $null
$blueprintMapIds = @()
$derivedAssetSlots = @()
$requiredAssetSlots = @($plan.requiredAssetSlots | ForEach-Object { [string]$_ } | Where-Object { $_ })
$missingBlueprintMaps = @($plan.requiredBlueprintMapIds)
$blueprintError = ''
$blueprintReady = $false
if (Test-Path -LiteralPath $BlueprintPath -PathType Leaf) {
    try {
        $blueprint = Read-JsonDocument -Path $BlueprintPath
        $blueprintMapIds = @($blueprint.maps | ForEach-Object { [string]$_.id } | Where-Object { $_ } | Sort-Object -Unique)
        $derivedAssetSlots = @(
            @($blueprint.characters | ForEach-Object { [string]$_.portraitSlot }) +
            @($blueprint.threats | ForEach-Object { [string]$_.assetSlot }) |
                Where-Object { $_ } | Sort-Object -Unique
        )
        $requiredAssetSlots = @($requiredAssetSlots + $derivedAssetSlots | Sort-Object -Unique)
        $missingBlueprintMaps = @($plan.requiredBlueprintMapIds | Where-Object { $_ -notin $blueprintMapIds })
        $blueprintReady = $blueprint.schemaVersion -eq 1 -and $blueprint.audience -eq 'adults-only' -and $missingBlueprintMaps.Count -eq 0
        if (-not $blueprintReady) { $blueprintError = 'schemaVersion, audience, or required map ids do not match the release plan' }
    } catch {
        $blueprintError = $_.Exception.Message
    }
} else {
    $blueprintError = 'file does not exist'
}
Add-Check -Id 'RLS-010-blueprint' -Gate 'chapter-blueprint' -Ok $blueprintReady `
    -Evidence "path=$BlueprintPath; maps=$($blueprintMapIds -join ','); error=$blueprintError" `
    -Message 'The chapter blueprint is absent, invalid, or does not declare every required release map.' `
    -Action 'Fix the blueprint JSON so schemaVersion is 1, audience is adults-only, and every required map id is declared.' `
    -Missing $(if ($blueprintReady) { @() } else { @($missingBlueprintMaps) }) `
    -BlocksTargets @('WindowsPortable', 'AndroidWebView')

$approvedAssetIds = @()
$missingAssetSlots = @($requiredAssetSlots)
$unmaterializedAssetSlots = @()
$assetManifestError = ''
$assetManifestReady = $false
if (Test-Path -LiteralPath $AssetManifestPath -PathType Leaf) {
    try {
        $assetManifest = Read-JsonDocument -Path $AssetManifestPath
        $approvedAssets = @($assetManifest.assets | Where-Object { $_.status -in @('approved', 'frozen') })
        $approvedAssetIds = @($approvedAssets | ForEach-Object { [string]$_.id } | Where-Object { $_ } | Sort-Object -Unique)
        $missingAssetSlots = @($requiredAssetSlots | Where-Object { $_ -notin $approvedAssetIds })
        foreach ($asset in $approvedAssets) {
            $assetId = [string]$asset.id
            if ($assetId -notin $requiredAssetSlots) { continue }
            $runtimePathNode = Get-JsonProperty -Value $asset -Name 'runtimePath'
            $pathNode = Get-JsonProperty -Value $asset -Name 'path'
            $runtimePath = if (Test-NonBlankString $runtimePathNode) { [string]$runtimePathNode } elseif (Test-NonBlankString $pathNode) { [string]$pathNode } else { '' }
            $resolvedAssetFile = if ($runtimePath) { Resolve-ProjectFile -RelativePath $runtimePath -Root $resolvedProjectRoot } else { $null }
            if (-not $resolvedAssetFile -or -not (Test-Path -LiteralPath $resolvedAssetFile -PathType Leaf)) {
                $unmaterializedAssetSlots += $assetId
            }
        }
        $assetManifestReady = $requiredAssetSlots.Count -gt 0 -and $missingAssetSlots.Count -eq 0 -and $unmaterializedAssetSlots.Count -eq 0
    } catch {
        $assetManifestError = $_.Exception.Message
        $missingAssetSlots = @($requiredAssetSlots)
    }
} else {
    $assetManifestError = 'file does not exist'
}
$assetManifestMissing = @($missingAssetSlots + $unmaterializedAssetSlots | Sort-Object -Unique)
Add-Check -Id 'RLS-020-approved-assets' -Gate 'asset-materialization' -Ok $assetManifestReady `
    -Evidence "path=$AssetManifestPath; approved=$($approvedAssetIds.Count); required=$($requiredAssetSlots.Count); missing=$($missingAssetSlots -join ','); withoutBytes=$($unmaterializedAssetSlots -join ','); error=$assetManifestError" `
    -Message 'One or more required visual slots are not approved/frozen or do not resolve to local runtime bytes.' `
    -Action 'Approve or freeze each required slot, give it a project-relative runtimePath/path, and materialize that file below the project root.' `
    -Missing $assetManifestMissing -BlocksTargets @('WindowsPortable', 'AndroidWebView')

$projectPath = Join-Path $resolvedProjectRoot 'data\project.json'
$nativeProject = $null
$nativeMapIds = @()
$nativeStartMapId = ''
$missingProjectArtifacts = @()
$invalidProjectReferences = @()
foreach ($relativePath in $plan.requiredProjectArtifacts) {
    $candidate = Resolve-ProjectFile -RelativePath ([string]$relativePath) -Root $resolvedProjectRoot
    if (-not $candidate -or -not (Test-Path -LiteralPath $candidate -PathType Leaf)) { $missingProjectArtifacts += [string]$relativePath }
}
if (Test-Path -LiteralPath $projectPath -PathType Leaf) {
    try {
        $nativeProject = Read-JsonDocument -Path $projectPath
        $nativeStartMapNode = Get-JsonProperty -Value $nativeProject -Name 'startMapId'
        if ($nativeStartMapNode -is [string]) { $nativeStartMapId = [string]$nativeStartMapNode }
        $nativeMapIds = @($nativeProject.maps | ForEach-Object { [string]$_.id } | Where-Object { $_ } | Sort-Object -Unique)
        foreach ($mapReference in @($nativeProject.maps)) {
            $declaredPath = [string]$mapReference.path
            $resolvedReference = Resolve-ProjectFile -RelativePath $declaredPath -Root $resolvedProjectRoot
            if (-not $resolvedReference -or -not (Test-Path -LiteralPath $resolvedReference -PathType Leaf)) { $invalidProjectReferences += $declaredPath }
        }
        if ($null -ne $nativeProject.database) {
            foreach ($property in $nativeProject.database.PSObject.Properties) {
                $declaredPath = [string]$property.Value
                $resolvedReference = Resolve-ProjectFile -RelativePath $declaredPath -Root $resolvedProjectRoot
                if (-not $resolvedReference -or -not (Test-Path -LiteralPath $resolvedReference -PathType Leaf)) { $invalidProjectReferences += $declaredPath }
            }
        }
    } catch {
        $invalidProjectReferences += "invalid project JSON: $($_.Exception.Message)"
    }
}
$missingNativeMaps = @($plan.requiredBlueprintMapIds | Where-Object { $_ -notin $nativeMapIds })
$nativeStartReady = $null -ne $nativeProject -and (Test-NonBlankString $nativeStartMapId) -and $nativeStartMapId -in $nativeMapIds
$nativeTreeReady = $missingProjectArtifacts.Count -eq 0 -and $invalidProjectReferences.Count -eq 0 -and $missingNativeMaps.Count -eq 0 -and $nativeStartReady
$nativeMissing = @($missingProjectArtifacts + $invalidProjectReferences + $missingNativeMaps | Where-Object { $_ } | Sort-Object -Unique)
Add-Check -Id 'RLS-030-native-project-tree' -Gate 'native-project-materialization' -Ok $nativeTreeReady `
    -Evidence "root=$resolvedProjectRoot; maps=$($nativeMapIds -join ','); startMap=$nativeStartMapId; brokenReferences=$($invalidProjectReferences -join ',')" `
    -Message 'The native data/project.json tree is incomplete, references missing shards, or does not contain a valid start map.' `
    -Action 'Materialize data/project.json, every declared data/maps path, every referenced database shard, and select a declared startMapId.' `
    -Missing $nativeMissing

$gatePaths = @{}
$missingGateArtifacts = @()
foreach ($relativePath in $plan.requiredGateArtifacts) {
    $candidate = Resolve-ProjectFile -RelativePath ([string]$relativePath) -Root $resolvedProjectRoot
    $gatePaths[[string]$relativePath] = $candidate
    if (-not $candidate -or -not (Test-Path -LiteralPath $candidate -PathType Leaf)) { $missingGateArtifacts += [string]$relativePath }
}
$gateArtifactsPresent = $missingGateArtifacts.Count -eq 0
Add-Check -Id 'RLS-040-gate-artifacts' -Gate 'release-evidence-presence' -Ok $gateArtifactsPresent `
    -Evidence "root=$resolvedProjectRoot; expected=$($plan.requiredGateArtifacts.Count); missing=$($missingGateArtifacts -join ',')" `
    -Message 'Release evidence is incomplete; an exporter must never infer an allowlist, provenance, compiler result, or materialization proof.' `
    -Action 'Create each missing release-input JSON document from the exact materialized project and successful GameBundle compilation.' `
    -Missing $missingGateArtifacts -BlocksTargets @('WindowsPortable', 'AndroidWebView')

$gameBundlePath = Join-Path $resolvedProjectRoot 'release-input\game-bundle.v1.json'
$gameBundle = $null
$bundleMapIds = @()
$bundleAssets = @()
$missingBundleMaps = @($plan.requiredBlueprintMapIds)
$invalidBundleAssets = @()
$gameBundleError = ''
$gameBundleCoversBlueprint = $false
if (Test-Path -LiteralPath $gameBundlePath -PathType Leaf) {
    try {
        $gameBundle = Read-JsonDocument -Path $gameBundlePath
        $bundleMaps = Get-JsonProperty -Value $gameBundle -Name 'maps'
        if ($null -eq $bundleMaps) { throw 'maps object is missing' }
        $bundleMapIds = @($bundleMaps.PSObject.Properties.Name | Sort-Object -Unique)
        $missingBundleMaps = @($plan.requiredBlueprintMapIds | Where-Object { $_ -notin $bundleMapIds })
        $bundleAssetCatalog = Get-JsonProperty -Value $gameBundle -Name 'assets'
        $bundleAssetNode = if ($null -eq $bundleAssetCatalog) { @() } else { Get-JsonProperty -Value $bundleAssetCatalog -Name 'assets' }
        $bundleAssets = if ($null -eq $bundleAssetNode) { @() } else { @($bundleAssetNode) }
        foreach ($asset in $bundleAssets) {
            $bundleAssetId = Get-JsonProperty -Value $asset -Name 'id'
            $bundleAssetPath = Get-JsonProperty -Value $asset -Name 'path'
            $runtimeCompatible = Get-JsonProperty -Value $asset -Name 'runtimeCompatible'
            if (-not (Test-NonBlankString $bundleAssetId) -or -not (Test-NonBlankString $bundleAssetPath) -or $runtimeCompatible -ne $true) {
                $invalidBundleAssets += [string]$bundleAssetId
            }
        }
        $bundleProject = Get-JsonProperty -Value $gameBundle -Name 'project'
        $bundleItems = Get-JsonProperty -Value $gameBundle -Name 'items'
        $bundleDatabases = Get-JsonProperty -Value $gameBundle -Name 'databases'
        $bundleStartMap = if ($null -eq $bundleProject) { '' } else { [string](Get-JsonProperty -Value $bundleProject -Name 'startMapId') }
        $gameBundleCoversBlueprint = $gameBundle.schemaVersion -eq 1 -and $null -ne $bundleProject -and $null -ne $bundleItems -and $null -ne $bundleDatabases -and $missingBundleMaps.Count -eq 0 -and $bundleStartMap -in $bundleMapIds -and $invalidBundleAssets.Count -eq 0
        if (-not $gameBundleCoversBlueprint) { $gameBundleError = 'schema, start map, required maps, items/databases, or runtime asset records are incomplete' }
    } catch {
        $gameBundleError = $_.Exception.Message
        $missingBundleMaps = @($plan.requiredBlueprintMapIds)
    }
} else {
    $gameBundleError = 'file does not exist'
}
Add-Check -Id 'RLS-050-gamebundle-materialization' -Gate 'gamebundle-v1' -Ok $gameBundleCoversBlueprint `
    -Evidence "path=$gameBundlePath; maps=$($bundleMapIds -join ','); assets=$(@($bundleAssets).Count); invalidAssets=$($invalidBundleAssets -join ','); error=$gameBundleError" `
    -Message 'The compiled GameBundle v1 is missing, invalid, or does not cover the same chapter maps and runtime assets.' `
    -Action 'Compile GameBundle v1 from the final materialized project, with the explicit allowlist, and store it at release-input/game-bundle.v1.json.' `
    -Missing @($missingBundleMaps + $invalidBundleAssets | Where-Object { $_ } | Sort-Object -Unique) `
    -BlocksTargets @('WindowsPortable', 'AndroidWebView')

$acceptanceEvidencePath = Join-Path $resolvedProjectRoot 'release-input\editor-acceptance-evidence.v1.json'
$acceptanceEvidenceProblems = @()
$acceptanceEvidenceReady = -not $RequireAcceptedHumanReview
if ($RequireAcceptedHumanReview) {
    if (-not (Test-Path -LiteralPath $acceptanceEvidencePath -PathType Leaf)) {
        $acceptanceEvidenceProblems = @('canonical editor-acceptance-evidence.v1.json does not exist')
    } elseif (-not $gameBundleCoversBlueprint) {
        $acceptanceEvidenceProblems = @('GameBundle must pass before G4 evidence can be checked')
    } else {
        try {
            $acceptanceEvidence = Read-JsonDocument -Path $acceptanceEvidencePath
            $acceptanceEvidenceProblems = @(Get-G4AcceptanceEvidenceProblems -Evidence $acceptanceEvidence -BundleAssets @($bundleAssets) -TemplateRoot $resolvedProjectRoot -GameBundlePath $gameBundlePath)
        } catch {
            $acceptanceEvidenceProblems = @($_.Exception.Message)
        }
    }
    $acceptanceEvidenceReady = $acceptanceEvidenceProblems.Count -eq 0
}
Add-Check -Id 'RLS-054-g4-acceptance-evidence' -Gate 'asset-human-acceptance-evidence' -Ok $acceptanceEvidenceReady `
    -Evidence "path=$acceptanceEvidencePath; required=$RequireAcceptedHumanReview; problems=$($acceptanceEvidenceProblems -join ' | ')" `
    -Message 'Strict release mode requires canonical hash-bound G4 acceptance for every GameBundle resource.' `
    -Action 'Review the 27-resource packet, apply only explicit accepted decisions, and rerun strict preflight.' `
    -Missing $acceptanceEvidenceProblems -BlocksTargets @('WindowsPortable', 'AndroidWebView')

$allowlistPath = Join-Path $resolvedProjectRoot 'release-input\asset-allowlist.json'
$provenancePath = Join-Path $resolvedProjectRoot 'release-input\asset-provenance.v1.json'
$visualAllowlistIds = @()
$supplementalAudioIds = @()
$supplementalAnimationIds = @()
$allowlistIds = @()
$provenanceEntries = @()
$supplementalAudioEntries = @()
$supplementalAnimationEntries = @()
$provenanceProblems = @()
try {
    if (-not (Test-Path -LiteralPath $allowlistPath -PathType Leaf)) { throw 'asset-allowlist.json does not exist' }
    $allowlistDocument = Read-JsonDocument -Path $allowlistPath
    if ($allowlistDocument -is [Array]) {
        $allowlistNode = $allowlistDocument
        $supplementalAudioNode = @()
        $supplementalAnimationNode = @()
    } else {
        $allowlistProperty = $allowlistDocument.PSObject.Properties['assetAllowlist']
        if ($null -eq $allowlistProperty) { throw 'allowlist must be an array or contain assetAllowlist[]' }
        # Windows PowerShell collapses an explicitly empty JSON array property to
        # $null. Property presence still makes this a valid fail-closed allowlist.
        if ($null -eq $allowlistProperty.Value) { $allowlistNode = @() } else { $allowlistNode = @($allowlistProperty.Value) }
        $supplementalAudioProperty = $allowlistDocument.PSObject.Properties['supplementalAudioAssetAllowlist']
        if ($null -eq $supplementalAudioProperty -or $null -eq $supplementalAudioProperty.Value) { $supplementalAudioNode = @() } else { $supplementalAudioNode = @($supplementalAudioProperty.Value) }
        $supplementalAnimationProperty = $allowlistDocument.PSObject.Properties['supplementalAnimationAssetAllowlist']
        if ($null -eq $supplementalAnimationProperty -or $null -eq $supplementalAnimationProperty.Value) { $supplementalAnimationNode = @() } else { $supplementalAnimationNode = @($supplementalAnimationProperty.Value) }
    }
    if (-not ($allowlistNode -is [Array])) { throw 'allowlist assetAllowlist must be an array' }
    if (-not ($supplementalAudioNode -is [Array])) { throw 'allowlist supplementalAudioAssetAllowlist must be an array when present' }
    if (-not ($supplementalAnimationNode -is [Array])) { throw 'allowlist supplementalAnimationAssetAllowlist must be an array when present' }
    $visualAllowlistIds = @($allowlistNode | ForEach-Object { [string]$_ })
    $supplementalAudioIds = @($supplementalAudioNode | ForEach-Object { [string]$_ })
    $supplementalAnimationIds = @($supplementalAnimationNode | ForEach-Object { [string]$_ })
    $allowlistIds = @($visualAllowlistIds + $supplementalAnimationIds + $supplementalAudioIds)
    if (@($allowlistIds | Where-Object { -not (Test-NonBlankString $_) }).Count -gt 0) { $provenanceProblems += 'allowlist contains blank or non-canonical ids' }
    if (@($allowlistIds | Group-Object | Where-Object Count -gt 1).Count -gt 0) { $provenanceProblems += 'allowlist contains duplicate ids' }
} catch {
    $provenanceProblems += $_.Exception.Message
}
try {
    if (-not (Test-Path -LiteralPath $provenancePath -PathType Leaf)) { throw 'asset-provenance.v1.json does not exist' }
    $provenanceDocument = Read-JsonDocument -Path $provenancePath
    $provenanceAssetsProperty = $provenanceDocument.PSObject.Properties['assets']
    if ($provenanceDocument.schemaVersion -ne 1 -or $null -eq $provenanceAssetsProperty) { throw 'provenance must use schemaVersion 1 and assets[]' }
    if ($null -eq $provenanceAssetsProperty.Value) { $provenanceAssetNode = @() } else { $provenanceAssetNode = @($provenanceAssetsProperty.Value) }
    if (-not ($provenanceAssetNode -is [Array])) { throw 'provenance assets must be an array' }
    $supplementalAudioProperty = $provenanceDocument.PSObject.Properties['supplementalAudio']
    if ($null -eq $supplementalAudioProperty -or $null -eq $supplementalAudioProperty.Value) { $supplementalAudioEntries = @() } else { $supplementalAudioEntries = @($supplementalAudioProperty.Value) }
    if (-not ($supplementalAudioEntries -is [Array])) { throw 'provenance supplementalAudio must be an array when present' }
    $supplementalAnimationProperty = $provenanceDocument.PSObject.Properties['supplementalAnimation']
    if ($null -eq $supplementalAnimationProperty -or $null -eq $supplementalAnimationProperty.Value) { $supplementalAnimationEntries = @() } else { $supplementalAnimationEntries = @($supplementalAnimationProperty.Value) }
    if (-not ($supplementalAnimationEntries -is [Array])) { throw 'provenance supplementalAnimation must be an array when present' }
    $provenanceEntries = @($provenanceAssetNode + $supplementalAnimationEntries + $supplementalAudioEntries)
} catch {
    $provenanceProblems += $_.Exception.Message
}
$bundleAssetIds = @($bundleAssets | ForEach-Object { [string]$_.id } | Where-Object { $_ })
foreach ($assetId in @($allowlistIds + $bundleAssetIds | Sort-Object -Unique)) {
    if ($assetId -notin $allowlistIds) { $provenanceProblems += "bundle asset is not allowlisted: $assetId" }
    if ($assetId -notin $bundleAssetIds) { $provenanceProblems += "allowlisted asset is absent from GameBundle: $assetId" }
    $entry = @($provenanceEntries | Where-Object { [string]$_.assetId -eq $assetId })
    if (@($entry).Count -ne 1) { $provenanceProblems += "asset needs exactly one provenance entry: $assetId"; continue }
    $bundleAsset = @($bundleAssets | Where-Object { [string]$_.id -eq $assetId }) | Select-Object -First 1
    if (-not (Test-NonBlankString $entry[0].origin) -or -not (Test-NonBlankString $entry[0].license)) { $provenanceProblems += "origin/license is missing: $assetId" }
    if ($null -ne $bundleAsset -and ([string]$entry[0].runtimePath -ne [string]$bundleAsset.path -or [string]$entry[0].source -ne [string]$bundleAsset.source)) {
        $provenanceProblems += "runtimePath/source does not match GameBundle: $assetId"
    }
    if ($null -ne $bundleAsset) {
        $assetFile = Resolve-ProjectFile -RelativePath ([string]$bundleAsset.path) -Root $resolvedProjectRoot
        if (-not $assetFile -or -not (Test-Path -LiteralPath $assetFile -PathType Leaf)) {
            $provenanceProblems += "runtime bytes are missing: $assetId"
        } elseif ($assetId -in $supplementalAnimationIds) {
            if ([string]$bundleAsset.kind -cne 'spritesheet') { $provenanceProblems += "supplemental animation is not spritesheet: $assetId" }
            $generatedNode = Get-JsonProperty -Value $entry[0] -Name 'generated'
            $technicalReview = Get-JsonProperty -Value $entry[0] -Name 'technicalReview'
            $humanAcceptance = Get-JsonProperty -Value $entry[0] -Name 'humanAcceptance'
            $actualHash = Get-LowerSha256 -Path $assetFile
            $actualSize = (Get-Item -LiteralPath $assetFile -Force).Length
            if ($null -eq $generatedNode) { $provenanceProblems += "supplemental animation generated metadata is missing: $assetId" }
            else {
                $expectedHash = [string](Get-JsonProperty -Value $generatedNode -Name 'outputSha256')
                if ($expectedHash -notmatch '^[a-f0-9]{64}$' -or $expectedHash -ne $actualHash) { $provenanceProblems += "supplemental animation byte hash mismatch: $assetId" }
                if ([long](Get-JsonProperty -Value $generatedNode -Name 'outputSizeBytes') -ne [long]$actualSize) { $provenanceProblems += "supplemental animation byte size mismatch: $assetId" }
            }
            if ($null -eq $technicalReview -or [string](Get-JsonProperty -Value $technicalReview -Name 'state') -cne 'generated-verified') { $provenanceProblems += "supplemental animation technical review is missing: $assetId" }
            if (-not (Test-HumanAcceptanceRecord -Acceptance $humanAcceptance -TemplateRoot $resolvedProjectRoot -AssetId $assetId -ExpectedHash $actualHash -RequireAccepted:$RequireAcceptedHumanReview)) { $provenanceProblems += "supplemental animation human acceptance is missing or not hash-bound: $assetId" }
        } elseif ($assetId -in $supplementalAudioIds) {
            if ([string]$bundleAsset.kind -cne 'audio') { $provenanceProblems += "supplemental asset is not audio: $assetId" }
            $generationNode = Get-JsonProperty -Value $entry[0] -Name 'generation'
            $technicalReview = Get-JsonProperty -Value $entry[0] -Name 'technicalReview'
            $humanAcceptance = Get-JsonProperty -Value $entry[0] -Name 'humanAcceptance'
            $actualHash = Get-LowerSha256 -Path $assetFile
            if ($null -eq $generationNode -or [string](Get-JsonProperty -Value $generationNode -Name 'outputSha256') -cne $actualHash -or
                [long](Get-JsonProperty -Value $generationNode -Name 'outputSizeBytes') -ne [long](Get-Item -LiteralPath $assetFile -Force).Length) {
                $provenanceProblems += "supplemental audio byte hash/size mismatch: $assetId"
            }
            if ($null -eq $technicalReview -or [string](Get-JsonProperty -Value $technicalReview -Name 'state') -cne 'generated-verified') {
                $provenanceProblems += "supplemental audio technical review is missing: $assetId"
            }
            if (-not (Test-HumanAcceptanceRecord -Acceptance $humanAcceptance -TemplateRoot $resolvedProjectRoot -AssetId $assetId -ExpectedHash $actualHash -RequireAccepted:$RequireAcceptedHumanReview)) {
                $provenanceProblems += "supplemental audio human acceptance is missing or not hash-bound: $assetId"
            }
        } elseif ([string]$bundleAsset.source -eq 'generated') {
            $generatedNode = Get-JsonProperty -Value $entry[0] -Name 'generated'
            if ($null -eq $generatedNode) { $provenanceProblems += "generated metadata is missing: $assetId"; continue }
            $expectedHash = [string](Get-JsonProperty -Value $generatedNode -Name 'outputSha256')
            $actualHash = Get-LowerSha256 -Path $assetFile
            if ($expectedHash -notmatch '^[a-f0-9]{64}$' -or $expectedHash -ne $actualHash) { $provenanceProblems += "generated byte hash mismatch: $assetId" }
            foreach ($field in @('providerId', 'modelId', 'operation', 'createdAt')) {
                if (-not (Test-NonBlankString (Get-JsonProperty -Value $generatedNode -Name $field))) { $provenanceProblems += "generated.$field is missing: $assetId" }
            }
        }
    }
}
foreach ($entry in $provenanceEntries) {
    if ([string]$entry.assetId -notin $allowlistIds) { $provenanceProblems += "provenance entry is not allowlisted: $($entry.assetId)" }
}
if (-not $gameBundleCoversBlueprint) { $provenanceProblems += 'GameBundle gate must pass before provenance coverage can be verified' }
if ($requiredAssetSlots.Count -gt 0 -and $allowlistIds.Count -eq 0) { $provenanceProblems += 'allowlist is empty while required chapter asset slots remain unresolved' }
$provenanceProblems = @($provenanceProblems | Where-Object { $_ } | Sort-Object -Unique)
$provenanceReady = $gameBundleCoversBlueprint -and $allowlistIds.Count -eq $bundleAssetIds.Count -and $provenanceProblems.Count -eq 0
Add-Check -Id 'RLS-051-asset-provenance' -Gate 'asset-provenance' -Ok $provenanceReady `
    -Evidence "allowlist=$allowlistPath; provenance=$provenancePath; allowlisted=$($allowlistIds.Count); bundleAssets=$($bundleAssetIds.Count); provenanceEntries=$($provenanceEntries.Count); problems=$($provenanceProblems -join ' | ')" `
    -Message 'Asset allowlist, GameBundle catalog, local bytes, and provenance are not an exact verified one-to-one set.' `
    -Action 'Make the allowlist explicit, add one matching provenance entry per bundled asset, confirm origin/license, and regenerate generated.outputSha256 from shipped bytes.' `
    -Missing $provenanceProblems -BlocksTargets @('WindowsPortable', 'AndroidWebView')

$approvalGatePath = Join-Path $resolvedProjectRoot 'release-input\asset-approval-gate.v1.json'
$approvalGateProblems = @()
$gateApprovedIds = @()
try {
    if (-not (Test-Path -LiteralPath $approvalGatePath -PathType Leaf)) { throw 'asset-approval-gate.v1.json does not exist' }
    $approvalGate = Read-JsonDocument -Path $approvalGatePath
    if ($approvalGate.schemaVersion -ne 1) { $approvalGateProblems += 'schemaVersion must be 1' }
    if ($approvalGate.releaseReady -ne $true) { $approvalGateProblems += 'releaseReady must be true' }

    $gateBlockersProperty = $approvalGate.PSObject.Properties['blockers']
    if ($null -eq $gateBlockersProperty) {
        $approvalGateProblems += 'blockers[] is missing'
    } elseif (@($gateBlockersProperty.Value).Count -ne 0) {
        $approvalGateProblems += 'release-ready gate retains blockers'
    }

    $declaredApprovedProperty = $approvalGate.PSObject.Properties['approvedAssetIds']
    if ($null -eq $declaredApprovedProperty) {
        $approvalGateProblems += 'approvedAssetIds[] is missing'
        $declaredGateApprovedIds = @()
    } else {
        $declaredGateApprovedIds = @($declaredApprovedProperty.Value | ForEach-Object { [string]$_ })
    }
    if (@($declaredGateApprovedIds | Where-Object { $_ -notmatch '^[a-z0-9][a-z0-9._-]{0,127}$' }).Count -gt 0) {
        $approvalGateProblems += 'approvedAssetIds contains a non-lower-case or non-portable id'
    }
    if (@($declaredGateApprovedIds | Group-Object | Where-Object Count -gt 1).Count -gt 0) {
        $approvalGateProblems += 'approvedAssetIds contains duplicates'
    }

    $requiredSlotsProperty = $approvalGate.PSObject.Properties['requiredSlots']
    $gateSlots = if ($null -eq $requiredSlotsProperty -or $null -eq $requiredSlotsProperty.Value) { @() } else { @($requiredSlotsProperty.Value) }
    if ($gateSlots.Count -eq 0) { $approvalGateProblems += 'requiredSlots[] is missing or empty' }
    $fixtureOnlyHashes = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($slot in $gateSlots) {
        $candidate = Get-JsonProperty -Value $slot -Name 'candidate'
        # Candidate fixture evidence is required when a slot was promoted from
        # the legacy fixture catalog, but newly generated project-owned assets
        # may be approved without a fixture candidate. Validate any candidate
        # that is present; do not force one into every new slot.
        if ($null -eq $candidate) { continue }
        if ((Get-JsonProperty -Value $candidate -Name 'fixtureOnly') -ne $true) {
            $approvalGateProblems += 'candidate evidence must be explicitly fixtureOnly when present'
            continue
        }
        $candidateHash = [string](Get-JsonProperty -Value $candidate -Name 'sha256')
        if ($candidateHash -notmatch '^[a-f0-9]{64}$') {
            $approvalGateProblems += 'fixture-only candidate has an invalid SHA-256'
        } else {
            [void]$fixtureOnlyHashes.Add($candidateHash)
        }
    }
    foreach ($slot in $gateSlots) {
        $slotId = [string](Get-JsonProperty -Value $slot -Name 'slotId')
        if ($slotId -notmatch '^[a-z0-9][a-z0-9._-]{0,127}$') {
            $approvalGateProblems += 'required slot has a non-lower-case or non-portable slotId'
            continue
        }
        $reviewState = [string](Get-JsonProperty -Value $slot -Name 'reviewState')
        if ($reviewState -notin @('approved', 'frozen') -or (Get-JsonProperty -Value $slot -Name 'releaseEligible') -ne $true) {
            $approvalGateProblems += "slot is not approved/frozen and release-eligible: $slotId"
            continue
        }
        if (@(Get-JsonProperty -Value $slot -Name 'blockers').Count -ne 0) {
            $approvalGateProblems += "approved slot retains blockers: $slotId"
        }
        $approval = Get-JsonProperty -Value $slot -Name 'approval'
        if ($null -eq $approval) {
            $approvalGateProblems += "approved slot has no approval record: $slotId"
            continue
        }
        if ([string](Get-JsonProperty -Value $approval -Name 'assetId') -cne $slotId) {
            $approvalGateProblems += "approval assetId does not match slotId: $slotId"
        }
        $runtimePath = [string](Get-JsonProperty -Value $approval -Name 'runtimePath')
        $approvalSource = [string](Get-JsonProperty -Value $approval -Name 'source')
        $declaredHash = [string](Get-JsonProperty -Value $approval -Name 'sha256')
        $declaredSize = Get-JsonProperty -Value $approval -Name 'sizeBytes'
        foreach ($field in @('licenseNote', 'reviewer', 'decidedAt')) {
            if (-not (Test-NonBlankString (Get-JsonProperty -Value $approval -Name $field))) {
                $approvalGateProblems += "approval $field is missing: $slotId"
            }
        }
        $decisionTimestamp = [DateTimeOffset]::MinValue
        if (-not [DateTimeOffset]::TryParse([string](Get-JsonProperty -Value $approval -Name 'decidedAt'), [ref]$decisionTimestamp)) {
            $approvalGateProblems += "approval decidedAt is invalid: $slotId"
        }
        $assetFile = Resolve-ProjectFile -RelativePath $runtimePath -Root $resolvedProjectRoot
        if (-not $runtimePath.StartsWith('assets/', [StringComparison]::Ordinal) -or -not $assetFile -or -not (Test-Path -LiteralPath $assetFile -PathType Leaf)) {
            $approvalGateProblems += "approved runtime bytes are missing or outside assets/: $slotId"
        } else {
            $assetItem = Get-Item -LiteralPath $assetFile -Force
            $actualHash = Get-LowerSha256 -Path $assetFile
            if ($declaredHash -notmatch '^[a-f0-9]{64}$' -or $declaredHash -cne $actualHash) {
                $approvalGateProblems += "approved byte hash mismatch: $slotId"
            }
            if ($declaredSize -isnot [int] -and $declaredSize -isnot [long]) {
                $approvalGateProblems += "approved byte size is invalid: $slotId"
            } elseif ([long]$declaredSize -ne [long]$assetItem.Length) {
                $approvalGateProblems += "approved byte size mismatch: $slotId"
            }
        }
        if ($approvalSource -notin @('local', 'imported', 'generated')) {
            $approvalGateProblems += "approved source is invalid: $slotId"
        }
        $matchingBundleAssets = @($bundleAssets | Where-Object { [string]$_.id -ceq $slotId })
        if ($matchingBundleAssets.Count -ne 1) {
            $approvalGateProblems += "approved slot needs exactly one matching GameBundle asset: $slotId"
        } elseif ([string]$matchingBundleAssets[0].path -cne $runtimePath -or [string]$matchingBundleAssets[0].source -cne $approvalSource) {
            $approvalGateProblems += "approval runtimePath/source does not match GameBundle: $slotId"
        }
        if ($fixtureOnlyHashes.Contains($declaredHash)) {
            $approvalGateProblems += "fixture-only candidate bytes cannot be promoted: $slotId"
        }
        $gateApprovedIds += $slotId
    }

    if (@($gateApprovedIds | Group-Object | Where-Object Count -gt 1).Count -gt 0) {
        $approvalGateProblems += 'requiredSlots contains duplicate slot ids'
    }
    if (-not (Test-EqualStringSet -Left $gateApprovedIds -Right $declaredGateApprovedIds)) {
        $approvalGateProblems += 'approvedAssetIds does not exactly match approved/frozen slots'
    }
    if (-not (Test-EqualStringSet -Left $gateApprovedIds -Right $visualAllowlistIds)) {
        $approvalGateProblems += 'approved/frozen slots do not exactly match the visual assetAllowlist'
    }
    if (-not (Test-EqualStringSet -Left $gateApprovedIds -Right $requiredAssetSlots)) {
        $approvalGateProblems += 'approval gate does not cover exactly the required chapter slots'
    }
} catch {
    $approvalGateProblems += $_.Exception.Message
}
$approvalGateProblems = @($approvalGateProblems | Where-Object { $_ } | Sort-Object -Unique)
$approvalGateReady = $provenanceReady -and $approvalGateProblems.Count -eq 0
Add-Check -Id 'RLS-053-asset-approval-gate' -Gate 'asset-human-approval' -Ok $approvalGateReady `
    -Evidence "path=$approvalGatePath; approved=$($gateApprovedIds -join ','); problems=$($approvalGateProblems -join ' | ')" `
    -Message 'The human-review gate is missing, blocked, stale, mismatched with the allowlist, or still points at fixture-only bytes.' `
    -Action 'Approve/freeze every required slot, record exact runtimePath/source/hash/size, remove blockers, and keep approvedAssetIds identical to the release allowlist.' `
    -Missing $approvalGateProblems -BlocksTargets @('WindowsPortable', 'AndroidWebView')

$materializationPath = Join-Path $resolvedProjectRoot 'release-input\materialization-report.v1.json'
$materializationProblems = @()
if (Test-Path -LiteralPath $materializationPath -PathType Leaf) {
    try {
        $materialization = Read-JsonDocument -Path $materializationPath
        if ($materialization.schemaVersion -ne 1) { $materializationProblems += 'schemaVersion must be 1' }
        $materializedMapIds = @($materialization.mapIds | ForEach-Object { [string]$_ })
        foreach ($mapId in $plan.requiredBlueprintMapIds) { if ($mapId -notin $materializedMapIds) { $materializationProblems += "mapIds is missing $mapId" } }
        $materializationLinks = @(
            @{ Name = 'blueprint'; Node = $materialization.blueprint; Path = $BlueprintPath },
            @{ Name = 'project'; Node = $materialization.project; Path = $projectPath },
            @{ Name = 'gameBundle'; Node = $materialization.gameBundle; Path = $gameBundlePath }
        )
        foreach ($link in $materializationLinks) {
            if (-not (Test-Path -LiteralPath $link.Path -PathType Leaf)) { $materializationProblems += "$($link.Name) source file is missing"; continue }
            $declaredHash = [string]$link.Node.sha256
            $actualHash = Get-LowerSha256 -Path $link.Path
            if ($declaredHash -notmatch '^[a-f0-9]{64}$' -or $declaredHash -ne $actualHash) { $materializationProblems += "$($link.Name).sha256 does not match current bytes" }
        }
    } catch {
        $materializationProblems += $_.Exception.Message
    }
} else {
    $materializationProblems += 'materialization report does not exist'
}
$materializationProblems = @($materializationProblems | Where-Object { $_ } | Sort-Object -Unique)
$materializationReady = $materializationProblems.Count -eq 0 -and $nativeTreeReady -and $gameBundleCoversBlueprint
Add-Check -Id 'RLS-052-materialization-evidence' -Gate 'materialization-proof' -Ok $materializationReady `
    -Evidence "path=$materializationPath; problems=$($materializationProblems -join ' | ')" `
    -Message 'The materialization report is missing, stale, or does not bind the blueprint, native project, GameBundle, and required map ids.' `
    -Action 'Write schemaVersion 1 evidence with mapIds[] and blueprint/project/gameBundle.sha256 values computed from the final immutable inputs.' `
    -Missing $materializationProblems -BlocksTargets @('WindowsPortable', 'AndroidWebView')

$exporterScript = Resolve-ConfiguredPath -Value ([string]$plan.exporterCapability.script) -Base $repoRoot
$exporterText = if (Test-Path -LiteralPath $exporterScript -PathType Leaf) { Get-Content -LiteralPath $exporterScript -Raw -Encoding UTF8 } else { '' }
$exporterDeclaresShards = [bool]$plan.exporterCapability.nativeProjectShardCopy
$exporterImplementsShards = $exporterText -match '(?i)(native-project-shard|Copy-NativeProject|Add-NativeDataReference[\s\S]{0,200}-Role\s+[''\"]native-project[''\"]|data/project\.json.*Add-FilePlan|Add-FilePlan.*data/project\.json)'
$exporterReady = $exporterDeclaresShards -and $exporterImplementsShards
Add-Check -Id 'RLS-060-exporter-native-shards' -Gate 'windows-native-shard-copy' -Ok $exporterReady `
    -Evidence "script=$exporterScript; planDeclaresCapability=$exporterDeclaresShards; implementationMarker=$exporterImplementsShards; requirement=$($plan.exporterCapability.requiredBeforeHeavyExport)" `
    -Message 'The Windows exporter cannot yet copy the native project tree consumed by rpg_creator_runtime.exe.' `
    -Action 'Implement a strict allowlist for data/project.json plus only its declared maps/database shards, inventory their hashes, then set exporterCapability.nativeProjectShardCopy=true.' `
    -Missing $(if ($exporterReady) { @() } else { @('native-project-shard-copy capability') })

$exporterEnforcesApprovalGate = $exporterText -match '(?i)AssetApprovalGatePath' -and
    $exporterText -match '(?i)releaseReady' -and
    $exporterText -match '(?i)fixture-only candidate bytes cannot be promoted' -and
    $exporterText -match '(?i)Approved size/hash does not match local runtime bytes'
Add-Check -Id 'RLS-061-exporter-asset-approval' -Gate 'windows-asset-approval-enforcement' -Ok $exporterEnforcesApprovalGate `
    -Evidence "script=$exporterScript; approvalGateEnforced=$exporterEnforcesApprovalGate" `
    -Message 'The Windows exporter can be invoked without independently enforcing the approved/frozen asset gate and exact byte evidence.' `
    -Action 'Require AssetApprovalGatePath and verify releaseReady, exact allowlist coverage, runtimePath/source/hash/size, and fixture exclusion before constructing the file plan.' `
    -Missing $(if ($exporterEnforcesApprovalGate) { @() } else { @('asset-approval enforcement') })

$androidIndexPath = Join-Path $AndroidWebDistPath 'index.html'
$androidWebProblems = @()
if (-not (Test-Path -LiteralPath $AndroidWebDistPath -PathType Container)) {
    $androidWebProblems += 'web runtime directory does not exist'
} elseif (-not (Test-Path -LiteralPath $androidIndexPath -PathType Leaf)) {
    $androidWebProblems += 'index.html does not exist'
} else {
    try {
        $androidIndex = Get-Content -LiteralPath $androidIndexPath -Raw -Encoding UTF8
        if ($androidIndex -match '(?i)(?:src|href)\s*=\s*["'']/') { $androidWebProblems += 'index.html contains root-relative src/href URLs' }
        if ($androidIndex -match '(?i)https?://') { $androidWebProblems += 'index.html contains a remote URL' }
    } catch {
        $androidWebProblems += $_.Exception.Message
    }
}
$androidWebReady = $androidWebProblems.Count -eq 0
Add-Check -Id 'RLS-070-android-web-runtime' -Gate 'android-web-runtime' -Ok $androidWebReady `
    -Evidence "path=$AndroidWebDistPath; problems=$($androidWebProblems -join ' | ')" `
    -Message 'The dedicated offline Android web runtime is absent or uses URLs that cannot resolve below appassets/assets/www/.' `
    -Action 'Build the dedicated Vite entry using src/platform/android/web/vite.config.ts (base ./), then rerun this read-only preflight.' `
    -Command 'npx vite build --config src/platform/android/web/vite.config.ts' `
    -Missing $androidWebProblems -BlocksTargets @('AndroidWebView')

$androidTemplateRoot = Join-Path $repoRoot 'src\platform\android\native-scaffold'
$androidTemplateRequired = @(
    'settings.gradle.kts',
    'build.gradle.kts',
    'app/build.gradle.kts',
    'app/src/main/AndroidManifest.xml',
    'app/src/main/java/ai/rpgcreator/player/MainActivity.java'
)
$missingAndroidTemplate = @()
foreach ($relativePath in $androidTemplateRequired) {
    if (-not (Test-Path -LiteralPath (Join-Path $androidTemplateRoot $relativePath.Replace('/', '\')) -PathType Leaf)) { $missingAndroidTemplate += $relativePath }
}
$androidTemplateReady = $missingAndroidTemplate.Count -eq 0
Add-Check -Id 'RLS-071-android-native-scaffold' -Gate 'android-native-scaffold' -Ok $androidTemplateReady `
    -Evidence "path=$androidTemplateRoot; missing=$($missingAndroidTemplate -join ',')" `
    -Message 'The canonical Android player scaffold is incomplete.' `
    -Action 'Restore the missing Gradle/manifest/player source files below src/platform/android/native-scaffold before staging.' `
    -Missing $missingAndroidTemplate -BlocksTargets @('AndroidWebView')

$androidWrapperFiles = @('gradlew', 'gradlew.bat', 'gradle/wrapper/gradle-wrapper.jar', 'gradle/wrapper/gradle-wrapper.properties')
$missingAndroidWrapper = @()
foreach ($relativePath in $androidWrapperFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $androidTemplateRoot $relativePath.Replace('/', '\')) -PathType Leaf)) { $missingAndroidWrapper += $relativePath }
}
$androidWrapperReady = $missingAndroidWrapper.Count -eq 0
Add-Check -Id 'RLS-072-android-gradle-wrapper' -Gate 'android-reproducible-toolchain' -Ok $androidWrapperReady `
    -Evidence "path=$androidTemplateRoot; missing=$($missingAndroidWrapper -join ',')" `
    -Message 'The Android player has no versioned Gradle Wrapper, so APK builds are not reproducible.' `
    -Action 'With JDK 17 and Gradle 8.14.3, generate the wrapper in the canonical scaffold and pin distributionSha256Sum; never commit local.properties or signing keys.' `
    -Command "Set-Location '$androidTemplateRoot'; gradle wrapper --gradle-version 8.14.3 --distribution-type bin" `
    -Missing $missingAndroidWrapper -BlocksTargets @('AndroidWebView')

$androidStageProblems = @()
$androidStageWww = Join-Path $AndroidStagingPath 'app\src\main\assets\www'
$androidStageIndex = Join-Path $androidStageWww 'index.html'
$androidStageBundle = Join-Path $androidStageWww 'data\game-bundle.v1.json'
$androidStageAllowlist = Join-Path $androidStageWww 'data\package-allowlist.json'
$androidStageMarker = Join-Path $AndroidStagingPath '.rpgcreator-android-scaffold'
foreach ($entry in @(
    @{ Label = 'staging marker'; Path = $androidStageMarker },
    @{ Label = 'offline index'; Path = $androidStageIndex },
    @{ Label = 'staged GameBundle'; Path = $androidStageBundle },
    @{ Label = 'package allowlist'; Path = $androidStageAllowlist }
)) {
    if (-not (Test-Path -LiteralPath $entry.Path -PathType Leaf)) { $androidStageProblems += "$($entry.Label) is missing" }
}
if (Test-Path -LiteralPath $androidStageAllowlist -PathType Leaf) {
    try {
        $packageAllowlist = Read-JsonDocument -Path $androidStageAllowlist
        $packagedPaths = @($packageAllowlist.paths | ForEach-Object { [string]$_ })
        foreach ($requiredPath in @('index.html', 'data/game-bundle.v1.json')) {
            if ($requiredPath -notin $packagedPaths) { $androidStageProblems += "package allowlist is missing $requiredPath" }
        }
        foreach ($packagedPath in $packagedPaths) {
            $resolvedPackagedFile = Resolve-ProjectFile -RelativePath $packagedPath -Root $androidStageWww
            if (-not $resolvedPackagedFile -or -not (Test-Path -LiteralPath $resolvedPackagedFile -PathType Leaf)) { $androidStageProblems += "allowlisted package file is missing: $packagedPath" }
        }
    } catch {
        $androidStageProblems += $_.Exception.Message
    }
}
if (Test-Path -LiteralPath $androidStageBundle -PathType Leaf) {
    try {
        $stagedBundle = Read-JsonDocument -Path $androidStageBundle
        if ($stagedBundle.schemaVersion -ne 1 -or $null -eq $stagedBundle.project -or $null -eq $stagedBundle.maps) { $androidStageProblems += 'staged GameBundle is not schemaVersion 1' }
    } catch {
        $androidStageProblems += $_.Exception.Message
    }
}
$androidStageProblems = @($androidStageProblems | Where-Object { $_ } | Sort-Object -Unique)
$androidStagingReady = $androidStageProblems.Count -eq 0
$androidStageCommand = ".\scripts\dev\prepare-android-webview-package.ps1 -GameBundlePath '$gameBundlePath' -AssetRoot '$resolvedProjectRoot' -WebDistPath '$AndroidWebDistPath' -OutputPath '$AndroidStagingPath'"
Add-Check -Id 'RLS-073-android-staging' -Gate 'android-offline-staging' -Ok $androidStagingReady `
    -Evidence "path=$AndroidStagingPath; problems=$($androidStageProblems -join ' | ')" `
    -Message 'The Android offline source package has not been staged or its package inventory is incomplete.' `
    -Action 'After the GameBundle/assets and web runtime gates pass, run the safe staging script and rerun this preflight before Gradle.' `
    -Command $androidStageCommand -Missing $androidStageProblems -BlocksTargets @('AndroidWebView')

$windowsBlockingChecks = @($checks | Where-Object { $_.status -eq 'blocked' -and 'WindowsPortable' -in $_.blocksTargets })
$androidBlockingChecks = @($checks | Where-Object { $_.status -eq 'blocked' -and 'AndroidWebView' -in $_.blocksTargets })
$selectedBlockingChecks = @(
    if ($Target -eq 'WindowsPortable') {
        @($windowsBlockingChecks)
    } elseif ($Target -eq 'AndroidWebView') {
        @($androidBlockingChecks)
    } else {
        @($checks | Where-Object { $_.status -eq 'blocked' })
    }
)
$missingArtifacts = @($selectedBlockingChecks | ForEach-Object { $_.missing } | Where-Object { $_ } | Sort-Object -Unique)
$report = [ordered]@{
    schemaVersion = 1
    planId = [string]$plan.id
    selectedTarget = $Target
    releaseReady = $selectedBlockingChecks.Count -eq 0
    targets = [ordered]@{
        windowsPortable = [ordered]@{
            ready = $windowsBlockingChecks.Count -eq 0
            blockingCheckIds = @($windowsBlockingChecks | ForEach-Object { $_.id })
        }
        androidWebView = [ordered]@{
            ready = $androidBlockingChecks.Count -eq 0
            blockingCheckIds = @($androidBlockingChecks | ForEach-Object { $_.id })
        }
    }
    runtime = [ordered]@{
        configuredPath = [string]$plan.runtime.executable
        resolvedPath = $resolvedRuntime
        exists = $runtimeExists
        sizeBytes = $runtimeLength
        sha256 = $runtimeHash
        peMachine = $runtimeMachine
    }
    source = [ordered]@{
        projectRoot = $resolvedProjectRoot
        blueprint = $BlueprintPath
        assetManifest = $AssetManifestPath
        gameBundle = $gameBundlePath
        provenance = $provenancePath
        assetApprovalGate = $approvalGatePath
        editorAcceptanceEvidence = if ($RequireAcceptedHumanReview) { $acceptanceEvidencePath } else { $null }
        requireAcceptedHumanReview = [bool]$RequireAcceptedHumanReview
        androidWebRuntime = $AndroidWebDistPath
        androidStaging = $AndroidStagingPath
        blueprintMapIds = @($blueprintMapIds)
        requiredAssetSlots = @($requiredAssetSlots)
    }
    checks = @($checks)
    missingArtifacts = $missingArtifacts
    nextActions = @($selectedBlockingChecks | ForEach-Object {
        [ordered]@{ checkId = $_.id; action = $_.action; command = $_.command }
    })
    nextHeavyStep = if ($selectedBlockingChecks.Count -eq 0) {
        if ($Target -eq 'AndroidWebView') { 'Run the pinned Gradle wrapper verification/build serially inside the staged Android project.' }
        elseif ($Target -eq 'All') { 'Run Windows export, then Android Gradle verification/build, one heavy operation at a time.' }
        else { 'Run scripts/dev/export-windows-portable.ps1 with the exact preflight-approved inputs.' }
    } else {
        $null
    }
}

$json = $report | ConvertTo-Json -Depth 32
if ($OutputPath) {
    $resolvedOutput = Resolve-ConfiguredPath -Value $OutputPath -Base $invocationRoot
    if (Test-Path -LiteralPath $resolvedOutput) { throw "Refusing to overwrite readiness report: $resolvedOutput" }
    $outputParent = Split-Path -Parent $resolvedOutput
    if ($outputParent) { [IO.Directory]::CreateDirectory($outputParent) | Out-Null }
    [IO.File]::WriteAllText($resolvedOutput, "$json`n", [Text.UTF8Encoding]::new($false))
    Write-Host "Readiness report: $resolvedOutput"
}
Write-Output $json
if ($selectedBlockingChecks.Count -gt 0) { exit 3 }
exit 0
