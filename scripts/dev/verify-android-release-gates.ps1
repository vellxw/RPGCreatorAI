[CmdletBinding()]
param(
    [string]$TemplateRoot = '',
    [string]$GateContractPath = '',
    [string]$StagingRoot = '',
    [string]$ToolchainReportPath = '',
    [string]$ReportPath = ''
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if ([string]::IsNullOrWhiteSpace($TemplateRoot)) { $TemplateRoot = Join-Path $repoRoot 'templates\horror-bl' }
if ([string]::IsNullOrWhiteSpace($GateContractPath)) { $GateContractPath = Join-Path $repoRoot 'src\platform\android\toolchain\android-release-gates.v1.json' }
if ([string]::IsNullOrWhiteSpace($StagingRoot)) { $StagingRoot = Join-Path $repoRoot 'output\android-webview' }
if ([string]::IsNullOrWhiteSpace($ToolchainReportPath)) { $ToolchainReportPath = Join-Path $repoRoot 'output\android-toolchain-readiness.v1.json' }
if ([string]::IsNullOrWhiteSpace($ReportPath)) { $ReportPath = Join-Path $repoRoot 'output\android-release-gates.v1.json' }
$TemplateRoot = [IO.Path]::GetFullPath($TemplateRoot)
$GateContractPath = [IO.Path]::GetFullPath($GateContractPath)
$StagingRoot = [IO.Path]::GetFullPath($StagingRoot)
$ToolchainReportPath = [IO.Path]::GetFullPath($ToolchainReportPath)
$ReportPath = [IO.Path]::GetFullPath($ReportPath)

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

function Test-HasProperty([object]$Value, [string]$Name) {
    return $null -ne $Value -and $null -ne $Value.PSObject.Properties[$Name]
}

function Get-ObjectMap([object[]]$Values, [string]$IdProperty = 'id') {
    $map = @{}
    foreach ($value in @($Values)) {
        if ($null -ne $value -and (Test-HasProperty $value $IdProperty)) { $map[[string]$value.$IdProperty] = $value }
    }
    return $map
}

$gateChecks = [ordered]@{
    G1 = [Collections.Generic.List[object]]::new()
    G2 = [Collections.Generic.List[object]]::new()
    G3 = [Collections.Generic.List[object]]::new()
    G4 = [Collections.Generic.List[object]]::new()
    G5 = [Collections.Generic.List[object]]::new()
}
function Add-GateCheck([string]$Gate, [string]$Id, [bool]$Passed, [string]$Message, [object]$Evidence = $null) {
    $gateChecks[$Gate].Add([PSCustomObject][ordered]@{
        id = $Id
        status = if ($Passed) { 'ready' } else { 'blocked' }
        message = $Message
        evidence = $Evidence
    })
}

function Get-GateStatus([string]$Gate) {
    if (@($gateChecks[$Gate] | Where-Object { $_.status -eq 'blocked' }).Count -eq 0) { return 'ready' }
    return 'blocked'
}

$contract = Read-JsonFile $GateContractPath 'Android release gate contract'
if ($contract.schemaVersion -ne 1) { throw 'Android release gate contract schemaVersion must be 1.' }
$releaseRequestPath = Join-Path $TemplateRoot ([string]$contract.gates.G5.releaseRequest).Replace('/', [IO.Path]::DirectorySeparatorChar)
$releaseRequest = Read-JsonFile $releaseRequestPath 'Android release request'
$bundlePath = Join-Path $TemplateRoot ([string]$releaseRequest.gameBundlePath).Replace('/', [IO.Path]::DirectorySeparatorChar)
$manifestPath = Join-Path $TemplateRoot ([string]$releaseRequest.assetManifestPath).Replace('/', [IO.Path]::DirectorySeparatorChar)
$provenancePath = Join-Path $TemplateRoot ([string]$releaseRequest.assetProvenancePath).Replace('/', [IO.Path]::DirectorySeparatorChar)
$approvalGatePath = Join-Path $TemplateRoot ([string]$releaseRequest.assetApprovalGatePath).Replace('/', [IO.Path]::DirectorySeparatorChar)
$runtimeConfigPath = Join-Path $TemplateRoot ([string]$releaseRequest.runtimeConfigPath).Replace('/', [IO.Path]::DirectorySeparatorChar)
$gameReleaseRelativePath = if (Test-HasProperty $releaseRequest 'gameReleasePath') { [string]$releaseRequest.gameReleasePath } else { 'release-input/game-release.v1.json' }
$gameReleasePath = Join-Path $TemplateRoot $gameReleaseRelativePath.Replace('/', [IO.Path]::DirectorySeparatorChar)
$bundle = Read-JsonFile $bundlePath 'GameBundle'
$assetManifest = Read-JsonFile $manifestPath 'Asset manifest'
$provenance = Read-JsonFile $provenancePath 'Asset provenance'
$approvalGate = Read-JsonFile $approvalGatePath 'Asset approval gate'
$runtimeConfig = Read-JsonFile $runtimeConfigPath 'Runtime config'
$gameReleaseExists = Test-Path -LiteralPath $gameReleasePath -PathType Leaf
$gameRelease = if ($gameReleaseExists) { Read-JsonFile $gameReleasePath 'Game release descriptor' } else { $null }
if ($bundle.schemaVersion -ne 1 -or $assetManifest.schemaVersion -ne 1 -or $provenance.schemaVersion -ne 1) { throw 'GameBundle, asset manifest, and provenance must all use schemaVersion 1.' }

$bundleAssets = @($bundle.assets.assets)
$manifestAssets = @($assetManifest.assets)
$provenanceAssets = @($provenance.assets)
$supplementalAnimationProvenance = @($provenance.supplementalAnimation)
$supplementalAudioProvenance = @($provenance.supplementalAudio)
$supplementalAnimationGateAssets = @($approvalGate.supplementalAnimation.assets)
$supplementalAudioGateAssets = @($approvalGate.supplementalAudio.assets)
$bundleAssetsById = Get-ObjectMap $bundleAssets
$manifestAssetsById = Get-ObjectMap $manifestAssets
$provenanceById = Get-ObjectMap $provenanceAssets 'assetId'
$supplementalAnimationProvenanceById = Get-ObjectMap $supplementalAnimationProvenance 'assetId'
$supplementalAudioProvenanceById = Get-ObjectMap $supplementalAudioProvenance 'assetId'
$supplementalAnimationGateById = Get-ObjectMap $supplementalAnimationGateAssets 'assetId'
$supplementalAudioGateById = Get-ObjectMap $supplementalAudioGateAssets 'assetId'
$approvedStatuses = @($contract.gates.G4.approvedStatuses | ForEach-Object { [string]$_ })

function Test-ReleaseAsset([string]$Gate, [string]$AssetId, [string]$ExpectedKind = '') {
    $bundleAsset = if ($bundleAssetsById.ContainsKey($AssetId)) { $bundleAssetsById[$AssetId] } else { $null }
    $manifestAsset = if ($manifestAssetsById.ContainsKey($AssetId)) { $manifestAssetsById[$AssetId] } else { $null }
    $present = $null -ne $bundleAsset -and $null -ne $manifestAsset
    Add-GateCheck $Gate "asset.$AssetId.catalog" $present "Asset $AssetId must exist in both GameBundle and canonical asset manifest."
    if (-not $present) { return $false }
    $kindReady = [string]::IsNullOrWhiteSpace($ExpectedKind) -or [string]$manifestAsset.kind -ceq $ExpectedKind
    Add-GateCheck $Gate "asset.$AssetId.kind" $kindReady "Asset $AssetId must have kind '$ExpectedKind'." ([string]$manifestAsset.kind)
    $approvalReady = ([string]$manifestAsset.status -cin $approvedStatuses) -and $manifestAsset.releaseEligible -eq $true -and $manifestAsset.runtimeCompatible -eq $true
    Add-GateCheck $Gate "asset.$AssetId.approval" $approvalReady "Asset $AssetId must be approved/frozen, release eligible, and runtime compatible." ([ordered]@{ status = $manifestAsset.status; releaseEligible = $manifestAsset.releaseEligible; runtimeCompatible = $manifestAsset.runtimeCompatible })
    $samePath = [string]$bundleAsset.path -ceq [string]$manifestAsset.path
    Add-GateCheck $Gate "asset.$AssetId.path" $samePath "GameBundle and manifest must use the same path for $AssetId." ([ordered]@{ bundle = $bundleAsset.path; manifest = $manifestAsset.path })
    $filePath = Join-Path $TemplateRoot ([string]$manifestAsset.path).Replace('/', [IO.Path]::DirectorySeparatorChar)
    $fileReady = Test-Path -LiteralPath $filePath -PathType Leaf
    $actualHash = if ($fileReady) { Get-LowerSha256 $filePath } else { $null }
    $actualBytes = if ($fileReady) { (Get-Item -LiteralPath $filePath).Length } else { $null }
    $bytesReady = $fileReady -and [string]$manifestAsset.sha256 -ceq $actualHash -and [long]$manifestAsset.sizeBytes -eq [long]$actualBytes
    Add-GateCheck $Gate "asset.$AssetId.bytes" $bytesReady "Asset $AssetId bytes must match manifest size and SHA-256." ([ordered]@{ path = $filePath; sha256 = $actualHash; bytes = $actualBytes })
    return $present -and $kindReady -and $approvalReady -and $samePath -and $bytesReady
}

function Test-SupplementalAudioAsset([string]$AssetId) {
    $bundleAsset = if ($bundleAssetsById.ContainsKey($AssetId)) { $bundleAssetsById[$AssetId] } else { $null }
    $manifestAsset = if ($manifestAssetsById.ContainsKey($AssetId)) { $manifestAssetsById[$AssetId] } else { $null }
    $provenanceAsset = if ($supplementalAudioProvenanceById.ContainsKey($AssetId)) { $supplementalAudioProvenanceById[$AssetId] } else { $null }
    $gateAsset = if ($supplementalAudioGateById.ContainsKey($AssetId)) { $supplementalAudioGateById[$AssetId] } else { $null }
    $present = $null -ne $bundleAsset -and $null -ne $manifestAsset -and $null -ne $provenanceAsset -and $null -ne $gateAsset
    Add-GateCheck 'G3' "audio.$AssetId.records" $present 'Supplemental audio must have GameBundle, manifest, provenance, and technical-gate records.'
    if (-not $present) { return $false }
    $technicalState = [string]$approvalGate.supplementalAudio.technicalReview.state -ceq 'generated-verified' -and [string]$provenanceAsset.technicalReview.state -ceq 'generated-verified'
    Add-GateCheck 'G3' "audio.$AssetId.technical-review" $technicalState 'Supplemental audio must have generated-verified technical evidence.'
    $metadataReady = [string]$manifestAsset.kind -ceq 'audio' -and [string]$manifestAsset.status -ceq 'frozen' -and $manifestAsset.releaseEligible -eq $true -and $manifestAsset.runtimeCompatible -eq $true -and [string]$bundleAsset.path -ceq [string]$manifestAsset.path -and [string]$gateAsset.runtimePath -ceq [string]$manifestAsset.path -and [string]$gateAsset.sha256 -ceq [string]$manifestAsset.sha256 -and [long]$gateAsset.sizeBytes -eq [long]$manifestAsset.sizeBytes
    Add-GateCheck 'G3' "audio.$AssetId.metadata" $metadataReady 'Supplemental audio routes and technical hash metadata must agree.'
    $filePath = Join-Path $TemplateRoot ([string]$manifestAsset.path).Replace('/', [IO.Path]::DirectorySeparatorChar)
    $fileReady = Test-Path -LiteralPath $filePath -PathType Leaf
    $bytesReady = $fileReady -and (Get-LowerSha256 $filePath) -ceq [string]$manifestAsset.sha256 -and (Get-Item -LiteralPath $filePath).Length -eq [long]$manifestAsset.sizeBytes
    Add-GateCheck 'G3' "audio.$AssetId.bytes" $bytesReady 'Supplemental audio bytes must match the frozen manifest hash and size.'
    return $present -and $technicalState -and $metadataReady -and $bytesReady
}

function Test-SupplementalAnimationAsset([string]$AssetId) {
    $bundleAsset = if ($bundleAssetsById.ContainsKey($AssetId)) { $bundleAssetsById[$AssetId] } else { $null }
    $manifestAsset = if ($manifestAssetsById.ContainsKey($AssetId)) { $manifestAssetsById[$AssetId] } else { $null }
    $provenanceAsset = if ($supplementalAnimationProvenanceById.ContainsKey($AssetId)) { $supplementalAnimationProvenanceById[$AssetId] } else { $null }
    $gateAsset = if ($supplementalAnimationGateById.ContainsKey($AssetId)) { $supplementalAnimationGateById[$AssetId] } else { $null }
    $present = $null -ne $bundleAsset -and $null -ne $manifestAsset -and $null -ne $provenanceAsset -and $null -ne $gateAsset
    Add-GateCheck 'G1' "animation.$AssetId.records" $present 'Animation strip must have GameBundle, manifest, provenance, and technical-gate records.'
    if (-not $present) { return $false }
    $technicalState = [string]$approvalGate.supplementalAnimation.technicalReview.state -ceq 'generated-verified' -and [string]$provenanceAsset.technicalReview.state -ceq 'generated-verified'
    Add-GateCheck 'G1' "animation.$AssetId.technical-review" $technicalState 'Animation strip must have generated-verified technical evidence.'
    $metadataReady = [string]$manifestAsset.kind -ceq 'spritesheet' -and [string]$manifestAsset.status -ceq 'frozen' -and $manifestAsset.releaseEligible -eq $true -and $manifestAsset.runtimeCompatible -eq $true -and [string]$bundleAsset.path -ceq [string]$manifestAsset.path -and [string]$gateAsset.runtimePath -ceq [string]$manifestAsset.path -and [string]$gateAsset.sha256 -ceq [string]$manifestAsset.sha256 -and [long]$gateAsset.sizeBytes -eq [long]$manifestAsset.sizeBytes -and [string]$gateAsset.action -ceq [string]$manifestAsset.generated.spriteSheet.action -and [string]$gateAsset.direction -ceq [string]$manifestAsset.generated.spriteSheet.direction -and [string]$gateAsset.animationSetId -ceq [string]$manifestAsset.generated.spriteSheet.animationSetId
    Add-GateCheck 'G1' "animation.$AssetId.metadata" $metadataReady 'Animation strip metadata and technical hash records must agree.'
    $filePath = Join-Path $TemplateRoot ([string]$manifestAsset.path).Replace('/', [IO.Path]::DirectorySeparatorChar)
    $fileReady = Test-Path -LiteralPath $filePath -PathType Leaf
    $bytesReady = $fileReady -and (Get-LowerSha256 $filePath) -ceq [string]$manifestAsset.sha256 -and (Get-Item -LiteralPath $filePath).Length -eq [long]$manifestAsset.sizeBytes
    Add-GateCheck 'G1' "animation.$AssetId.bytes" $bytesReady 'Animation strip bytes must match frozen manifest hash and size.'
    return $present -and $technicalState -and $metadataReady -and $bytesReady
}

# G1 - player identity plus idle/walk/interact strips in all four directions.
$g1 = $contract.gates.G1
$system = $bundle.databases.system
$party = @($system.startingParty | ForEach-Object { [string]$_ })
Add-GateCheck 'G1' 'player.id' ($party.Count -gt 0 -and $party[0] -ceq [string]$g1.playerId) "Starting player must be $($g1.playerId)." $party
Add-GateCheck 'G1' 'player.animation-set' ((Test-HasProperty $system 'playerAnimationSet') -and [string]$system.playerAnimationSet -ceq [string]$g1.animationSetId) "Player animation set must be $($g1.animationSetId)." $(if (Test-HasProperty $system 'playerAnimationSet') { $system.playerAnimationSet } else { $null })
$animationSet = @($bundle.databases.animations.sets | Where-Object { [string]$_.id -ceq [string]$g1.animationSetId })
Add-GateCheck 'G1' 'animation-set.unique' ($animationSet.Count -eq 1) "Exactly one animation set '$($g1.animationSetId)' is required." $animationSet.Count
foreach ($action in @($g1.requiredActions)) {
    foreach ($direction in @($g1.directions)) {
        $assetId = ([string]$g1.assetIdTemplate).Replace('{action}', [string]$action).Replace('{direction}', [string]$direction)
        [void](Test-ReleaseAsset 'G1' $assetId 'spritesheet')
        [void](Test-SupplementalAnimationAsset $assetId)
        if ($animationSet.Count -eq 1) {
            $clips = @($animationSet[0].clips | Where-Object { [string]$_.action -ceq [string]$action -and [string]$_.direction -ceq [string]$direction -and [string]$_.asset -ceq $assetId })
            Add-GateCheck 'G1' "clip.$action.$direction" ($clips.Count -eq 1) "Animation set must bind exactly one $action/$direction clip to $assetId." $clips.Count
        }
        if ($manifestAssetsById.ContainsKey($assetId)) {
            $asset = $manifestAssetsById[$assetId]
            $sheet = if ((Test-HasProperty $asset 'generated') -and (Test-HasProperty $asset.generated 'spriteSheet')) { $asset.generated.spriteSheet } else { $null }
            $metadataReady = $null -ne $sheet -and [string]$asset.generated.ownerId -ceq [string]$g1.playerId -and [string]$sheet.animationSetId -ceq [string]$g1.animationSetId -and [string]$sheet.action -ceq [string]$action -and [string]$sheet.direction -ceq [string]$direction
            Add-GateCheck 'G1' "metadata.$action.$direction" $metadataReady "$assetId must declare matching owner/action/direction/animationSet metadata."
        }
    }
}

# G2 - one approved illustrated background per required map.
$g2 = $contract.gates.G2
foreach ($mapProperty in $g2.mapBackgrounds.PSObject.Properties) {
    $mapId = [string]$mapProperty.Name
    $assetId = [string]$mapProperty.Value
    [void](Test-ReleaseAsset 'G2' $assetId 'image')
    $map = if (Test-HasProperty $bundle.maps $mapId) { $bundle.maps.$mapId } else { $null }
    Add-GateCheck 'G2' "map.$mapId.exists" ($null -ne $map) "GameBundle must contain map $mapId."
    $backgroundReady = $null -ne $map -and (Test-HasProperty $map 'parallax') -and (Test-HasProperty $map.parallax 'image') -and [string]$map.parallax.image -ceq $assetId
    Add-GateCheck 'G2' "map.$mapId.background" $backgroundReady "Map $mapId must use $assetId as parallax.image."
}

# G3 - embedded VN data, schema-v2 saves, and an offline audio set.
$g3 = $contract.gates.G3
$dialogueReady = (Test-HasProperty $bundle 'dialogue') -and $bundle.dialogue.schemaVersion -eq 1 -and (Test-HasProperty $bundle.dialogue 'scenes')
$sceneCount = if ($dialogueReady) { @($bundle.dialogue.scenes.PSObject.Properties).Count } else { 0 }
Add-GateCheck 'G3' 'dialogue.scenes' ($dialogueReady -and $sceneCount -ge [int]$g3.minimumVisualNovelScenes) "GameBundle must embed at least $($g3.minimumVisualNovelScenes) visual-novel scene." $sceneCount
if ($dialogueReady) {
    foreach ($sceneProperty in $bundle.dialogue.scenes.PSObject.Properties) {
        $scene = $sceneProperty.Value
        $nodes = @($scene.nodes)
        $nodeIds = @($nodes | ForEach-Object { [string]$_.id })
        $sceneValid = $nodes.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace([string]$scene.entryNodeId) -and $nodeIds -ccontains [string]$scene.entryNodeId -and @($nodeIds | Group-Object | Where-Object Count -gt 1).Count -eq 0
        Add-GateCheck 'G3' "dialogue.scene.$($sceneProperty.Name)" $sceneValid 'Each VN scene needs non-empty unique nodes and a valid entryNodeId.' ([ordered]@{ nodeCount = $nodes.Count; entryNodeId = $scene.entryNodeId })
    }
}
Add-GateCheck 'G3' 'save.schema' ((Test-HasProperty $runtimeConfig 'save') -and $runtimeConfig.save.schemaVersion -eq [int]$g3.saveSchemaVersion) "Runtime save schema must be $($g3.saveSchemaVersion)." $(if (Test-HasProperty $runtimeConfig 'save') { $runtimeConfig.save.schemaVersion } else { $null })
Add-GateCheck 'G3' 'network.disabled' ((Test-HasProperty $runtimeConfig 'network') -and $runtimeConfig.network.allowed -eq $false -and $releaseRequest.networkAllowed -eq $false) 'Runtime config and release request must both prohibit network access.'
foreach ($assetId in @($g3.requiredAudioAssetIds | ForEach-Object { [string]$_ })) { [void](Test-SupplementalAudioAsset $assetId) }

$dialogueAssetRefs = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
function Collect-DialogueAssetReferences([object]$Value, [string]$PropertyName = '') {
    if ($null -eq $Value) { return }
    if ($Value -is [string]) {
        if ($PropertyName -match '(?i)^(assetId|portraitAssetId|voiceAssetId|backgroundAssetId|audioAssetId|musicAssetId|soundAssetId)$') { [void]$dialogueAssetRefs.Add([string]$Value) }
        return
    }
    if ($Value -is [Collections.IDictionary]) {
        foreach ($key in $Value.Keys) { Collect-DialogueAssetReferences $Value[$key] ([string]$key) }
        return
    }
    if ($Value -is [Collections.IEnumerable] -and $Value -isnot [PSCustomObject]) {
        foreach ($item in $Value) { Collect-DialogueAssetReferences $item $PropertyName }
        return
    }
    foreach ($property in $Value.PSObject.Properties) { Collect-DialogueAssetReferences $property.Value ([string]$property.Name) }
}
if ($dialogueReady) { Collect-DialogueAssetReferences $bundle.dialogue }
foreach ($assetId in @($dialogueAssetRefs | Sort-Object)) {
    Add-GateCheck 'G3' "dialogue.asset.$assetId" $bundleAssetsById.ContainsKey($assetId) "VN reference $assetId must resolve through bundle.assets."
}

# G4 - editor/user acceptance binds the exact GameBundle, manifest, and each runtime asset.
$g4 = $contract.gates.G4
$evidencePath = Join-Path $TemplateRoot ([string]$g4.requiredEvidencePath).Replace('/', [IO.Path]::DirectorySeparatorChar)
$evidenceExists = Test-Path -LiteralPath $evidencePath -PathType Leaf
$acceptance = $null
$evidenceHash = $null
Add-GateCheck 'G4' 'acceptance.exists' $evidenceExists 'Editor acceptance evidence is required; automated generation cannot self-approve it.' $evidencePath
if ($evidenceExists) {
    $acceptance = Read-JsonFile $evidencePath 'Editor acceptance evidence'
    $evidenceHash = Get-LowerSha256 $evidencePath
    $evidenceReference = [string]$g4.requiredEvidencePath
    $hashesReady = $acceptance.schemaVersion -eq 1 -and [string]$acceptance.status -ceq 'accepted' -and [string]$acceptance.gameBundleSha256 -ceq (Get-LowerSha256 $bundlePath) -and [string]$acceptance.assetManifestSha256 -ceq (Get-LowerSha256 $manifestPath)
    Add-GateCheck 'G4' 'acceptance.hashes' $hashesReady 'Acceptance evidence must bind the exact GameBundle and asset-manifest SHA-256 values.'
    $reviewTimestamp = [DateTimeOffset]::MinValue
    $reviewerReady = $null -ne $acceptance.reviewer -and [string]$acceptance.reviewer.kind -in @('human', 'delegated-by-creator') -and -not [string]::IsNullOrWhiteSpace([string]$acceptance.reviewer.label) -and [DateTimeOffset]::TryParse([string]$acceptance.reviewedAt, [ref]$reviewTimestamp)
    Add-GateCheck 'G4' 'acceptance.reviewer' $reviewerReady 'Acceptance evidence must identify a reviewer and ISO review timestamp.' $acceptance.reviewer
    $decisions = @($acceptance.resources)
    $decisionIds = @($decisions | ForEach-Object { [string]$_.resourceId })
    $decisionSetReady = @($decisions).Count -eq @($bundleAssets).Count -and (@($decisionIds | Sort-Object -Unique).Count -eq @($bundleAssets).Count) -and (@($decisionIds | Where-Object { -not $bundleAssetsById.ContainsKey($_) }).Count -eq 0)
    Add-GateCheck 'G4' 'acceptance.resource-set' $decisionSetReady 'Acceptance evidence must contain exactly one decision for every GameBundle asset and no extras.' $decisionIds
    foreach ($asset in $bundleAssets) {
        $manifestAsset = if ($manifestAssetsById.ContainsKey([string]$asset.id)) { $manifestAssetsById[[string]$asset.id] } else { $null }
        $expectedHash = if ($null -ne $manifestAsset) { [string]$manifestAsset.sha256 } else { '' }
        $decision = @($decisions | Where-Object { [string]$_.resourceId -ceq [string]$asset.id -and [string]$_.kind -ceq 'asset' -and [string]$_.status -ceq 'accepted' -and [string]$_.sha256 -ceq $expectedHash })
        Add-GateCheck 'G4' "acceptance.asset.$($asset.id)" (@($decision).Count -eq 1) "Acceptance evidence must contain one hash-bound accepted decision for $($asset.id)." @($decision).Count
    }
}
$acceptanceReviewerLabel = if ($null -ne $acceptance) { [string]$acceptance.reviewer.label } else { '' }
$acceptanceReviewedAt = if ($null -ne $acceptance) { [string]$acceptance.reviewedAt } else { '' }
Add-GateCheck 'G4' 'approval-gate.ready' ($approvalGate.releaseReady -eq $true -and @($approvalGate.blockers).Count -eq 0) 'Canonical asset approval gate must be release-ready with no blockers.'
foreach ($asset in $bundleAssets) {
    $id = [string]$asset.id
    if ($supplementalAudioProvenanceById.ContainsKey($id)) {
        $supplemental = $supplementalAudioProvenanceById[$id]
        $decision = if ($null -ne $acceptance) { @($acceptance.resources | Where-Object { [string]$_.resourceId -ceq $id -and [string]$_.status -ceq 'accepted' -and [string]$_.sha256 -ceq [string]$manifestAssetsById[$id].sha256 }) } else { @() }
        $humanAccepted = $evidenceExists -and [string]$supplemental.humanAcceptance.state -ceq 'accepted' -and [string]$supplemental.humanAcceptance.evidence -ceq [string]$g4.requiredEvidencePath -and [string]$supplemental.humanAcceptance.evidenceSha256 -ceq $evidenceHash -and [string]$supplemental.humanAcceptance.reviewer -ceq $acceptanceReviewerLabel -and [string]$supplemental.humanAcceptance.reviewedAt -ceq $acceptanceReviewedAt -and @($decision).Count -eq 1
        Add-GateCheck 'G4' "provenance.$id" $humanAccepted 'Supplemental audio must carry accepted hash-bound evidence linked to the canonical G4 file.' $supplemental.humanAcceptance
        continue
    }
    if ($supplementalAnimationProvenanceById.ContainsKey($id)) {
        $supplemental = $supplementalAnimationProvenanceById[$id]
        $decision = if ($null -ne $acceptance) { @($acceptance.resources | Where-Object { [string]$_.resourceId -ceq $id -and [string]$_.status -ceq 'accepted' -and [string]$_.sha256 -ceq [string]$manifestAssetsById[$id].sha256 }) } else { @() }
        $humanAccepted = $evidenceExists -and [string]$supplemental.humanAcceptance.state -ceq 'accepted' -and [string]$supplemental.humanAcceptance.evidence -ceq [string]$g4.requiredEvidencePath -and [string]$supplemental.humanAcceptance.evidenceSha256 -ceq $evidenceHash -and [string]$supplemental.humanAcceptance.reviewer -ceq $acceptanceReviewerLabel -and [string]$supplemental.humanAcceptance.reviewedAt -ceq $acceptanceReviewedAt -and @($decision).Count -eq 1
        Add-GateCheck 'G4' "provenance.$id" $humanAccepted 'Supplemental animation must carry accepted hash-bound evidence linked to the canonical G4 file.' $supplemental.humanAcceptance
        continue
    }
    $manifestAsset = if ($manifestAssetsById.ContainsKey($id)) { $manifestAssetsById[$id] } else { $null }
    $provenanceAsset = if ($provenanceById.ContainsKey($id)) { $provenanceById[$id] } else { $null }
    $closed = $null -ne $manifestAsset -and $null -ne $provenanceAsset -and [string]$manifestAsset.status -cin $approvedStatuses -and $manifestAsset.releaseEligible -eq $true -and $manifestAsset.runtimeCompatible -eq $true -and [string]$provenanceAsset.runtimePath -ceq [string]$asset.path
    Add-GateCheck 'G4' "provenance.$id" $closed "Every GameBundle asset must have approved manifest state and path-matched provenance."
}

# G5 - G1-G4, reproducible toolchain, exact staging, allowlist, inventory, and no network permission.
foreach ($gate in @('G1', 'G2', 'G3', 'G4')) { Add-GateCheck 'G5' "dependency.$gate" ((Get-GateStatus $gate) -eq 'ready') "G5 requires $gate to be ready." }
$requiredMaps = @($contract.gates.G5.requiredMapIds | ForEach-Object { [string]$_ })
$actualMapIds = @($bundle.maps.PSObject.Properties | ForEach-Object { [string]$_.Name })
foreach ($mapId in $requiredMaps) { Add-GateCheck 'G5' "map.$mapId" ($actualMapIds -ccontains $mapId) "Release GameBundle must include map $mapId." }
$gameReleaseLocked = $gameReleaseExists -and $gameRelease.schemaVersion -eq 1 -and [string]$gameRelease.status -ceq 'locked' -and [string]$gameRelease.version -match '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$' -and [string]$releaseRequest.versionName -ceq [string]$gameRelease.version
Add-GateCheck 'G5' 'release.game-version' $gameReleaseLocked 'Android release request must match a locked game-release.v1.json descriptor; editor/package versions are never inferred.' ([ordered]@{ path = $gameReleasePath; status = if ($gameReleaseExists) { [string]$gameRelease.status } else { 'missing' }; requestVersion = [string]$releaseRequest.versionName; lockedVersion = if ($gameReleaseExists) { [string]$gameRelease.version } else { $null } })

$toolchainExists = Test-Path -LiteralPath $ToolchainReportPath -PathType Leaf
Add-GateCheck 'G5' 'toolchain.report' $toolchainExists 'A generated Android toolchain readiness report is required.' $ToolchainReportPath
if ($toolchainExists) {
    $toolchainReport = Read-JsonFile $ToolchainReportPath 'Android toolchain report'
    Add-GateCheck 'G5' 'toolchain.ready' ($toolchainReport.schemaVersion -eq 1 -and [string]$toolchainReport.status -ceq 'ready' -and @($toolchainReport.blockers).Count -eq 0) 'JDK 17, SDK 36, and checksum-bound Gradle wrapper must all be ready.' $toolchainReport.status
}

$stagedBundlePath = Join-Path $StagingRoot 'app\src\main\assets\www\data\game-bundle.v1.json'
$stagedGameReleasePath = Join-Path $StagingRoot 'app\src\main\assets\www\data\game-release.v1.json'
$allowlistPath = Join-Path $StagingRoot 'app\src\main\assets\www\data\package-allowlist.json'
$stagedAcceptancePath = Join-Path $StagingRoot 'app\src\main\assets\www\data\editor-acceptance-evidence.v1.json'
$inventoryPath = Join-Path $StagingRoot ([string]$contract.gates.G5.stagingInventory).Replace('/', [IO.Path]::DirectorySeparatorChar)
$stagedManifestPath = Join-Path $StagingRoot 'app\src\main\AndroidManifest.xml'
$stageFilesExist = (Test-Path -LiteralPath $stagedBundlePath -PathType Leaf) -and (Test-Path -LiteralPath $allowlistPath -PathType Leaf) -and (Test-Path -LiteralPath $inventoryPath -PathType Leaf) -and (Test-Path -LiteralPath $stagedManifestPath -PathType Leaf)
Add-GateCheck 'G5' 'staging.files' $stageFilesExist 'Staging must contain GameBundle, allowlist, inventory, and AndroidManifest.' $StagingRoot
$g4ReadyForStaging = (Get-GateStatus 'G4') -eq 'ready'
$stagedAcceptanceExists = Test-Path -LiteralPath $stagedAcceptancePath -PathType Leaf
$stagedGameReleaseExists = Test-Path -LiteralPath $stagedGameReleasePath -PathType Leaf
Add-GateCheck 'G5' 'staging.game-release' ((-not $gameReleaseLocked) -or $stagedGameReleaseExists) 'When the game release descriptor is locked, strict Android staging must embed game-release.v1.json.' $stagedGameReleasePath
Add-GateCheck 'G5' 'staging.g4-evidence' ((-not $g4ReadyForStaging) -or $stagedAcceptanceExists) 'When G4 is ready, strict Android staging must embed editor-acceptance-evidence.v1.json.' $stagedAcceptancePath
if ($stageFilesExist) {
    $sourceBundleHash = Get-LowerSha256 $bundlePath
    $stagedBundleHash = Get-LowerSha256 $stagedBundlePath
    Add-GateCheck 'G5' 'staging.bundle-exact' ($sourceBundleHash -ceq $stagedBundleHash) 'Staged GameBundle, including dialogue, must be byte-identical to canonical source.' ([ordered]@{ source = $sourceBundleHash; staged = $stagedBundleHash })
    $allowlist = Read-JsonFile $allowlistPath 'Android package allowlist'
    $allowedPaths = @($allowlist.paths | ForEach-Object { [string]$_ })
    $requiredPaths = [Collections.Generic.List[string]]::new()
    @('index.html', 'data/android-runtime-contract.v1.json', 'data/game-bundle.v1.json') | ForEach-Object { $requiredPaths.Add($_) }
    if ($gameReleaseLocked) { $requiredPaths.Add('data/game-release.v1.json') }
    if ($g4ReadyForStaging) { $requiredPaths.Add('data/editor-acceptance-evidence.v1.json') }
    foreach ($asset in $bundleAssets) { $requiredPaths.Add([string]$asset.path) }
    foreach ($path in @($requiredPaths | Sort-Object -Unique)) { Add-GateCheck 'G5' "allowlist.$path" ($allowedPaths -ccontains $path) "Offline allowlist must include $path." }
    Add-GateCheck 'G5' 'allowlist.base-url' ([string]$allowlist.assetBaseUrl -ceq '/assets/www/') 'Offline allowlist assetBaseUrl must be /assets/www/.' $allowlist.assetBaseUrl

    $inventory = Read-JsonFile $inventoryPath 'Android staging inventory'
    $inventoryErrors = [Collections.Generic.List[string]]::new()
    if ($inventory.schemaVersion -ne 1 -or [string]$inventory.sourceGameBundleSha256 -cne $sourceBundleHash -or [string]$inventory.stagedGameBundleSha256 -cne $stagedBundleHash) { $inventoryErrors.Add('bundle hashes do not bind current source/staging') }
    if ([string]$inventory.assetManifestSha256 -cne (Get-LowerSha256 $manifestPath)) { $inventoryErrors.Add('asset-manifest hash does not bind current canonical manifest') }
    if ($g4ReadyForStaging) {
        $canonicalAcceptanceHash = if ($evidenceExists) { $evidenceHash } else { '' }
        $inventoryAcceptance = if (Test-HasProperty $inventory 'editorAcceptanceEvidence') { $inventory.editorAcceptanceEvidence } else { $null }
        if ($null -eq $inventoryAcceptance -or -not $stagedAcceptanceExists -or [string]$inventoryAcceptance.path -cne 'app/src/main/assets/www/data/editor-acceptance-evidence.v1.json' -or [string]$inventoryAcceptance.sha256 -cne $canonicalAcceptanceHash -or (Get-LowerSha256 $stagedAcceptancePath) -cne $canonicalAcceptanceHash) {
            $inventoryErrors.Add('strict G4 acceptance evidence is missing or not hash-bound to the canonical evidence')
        }
    }
    if ($gameReleaseLocked) {
        $gameReleaseHash = Get-LowerSha256 $gameReleasePath
        $inventoryGameRelease = if (Test-HasProperty $inventory 'gameRelease') { $inventory.gameRelease } else { $null }
        if (-not $stagedGameReleaseExists -or (Get-LowerSha256 $stagedGameReleasePath) -cne $gameReleaseHash -or $null -eq $inventoryGameRelease -or [string]$inventoryGameRelease.path -cne 'app/src/main/assets/www/data/game-release.v1.json' -or [string]$inventoryGameRelease.sha256 -cne $gameReleaseHash) {
            $inventoryErrors.Add('strict game release descriptor is missing or not hash-bound to the canonical descriptor')
        }
    }
    $inventoryAssetIds = @($inventory.packagedAssetIds | ForEach-Object { [string]$_ } | Sort-Object -Unique)
    $bundleAssetIds = @($bundleAssets | ForEach-Object { [string]$_.id } | Sort-Object -Unique)
    if (($inventoryAssetIds -join "`n") -cne ($bundleAssetIds -join "`n")) { $inventoryErrors.Add('packagedAssetIds does not exactly match GameBundle assets') }
    $inventoryRecords = @($inventory.files)
    $recordPaths = @($inventoryRecords | ForEach-Object { [string]$_.path })
    if (@($recordPaths | Group-Object | Where-Object Count -gt 1).Count -gt 0) { $inventoryErrors.Add('inventory contains duplicate paths') }
    foreach ($record in $inventoryRecords) {
        $path = Join-Path $StagingRoot ([string]$record.path).Replace('/', [IO.Path]::DirectorySeparatorChar)
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { $inventoryErrors.Add("missing $($record.path)"); continue }
        if ((Get-LowerSha256 $path) -cne [string]$record.sha256 -or (Get-Item -LiteralPath $path).Length -ne [long]$record.bytes) { $inventoryErrors.Add("hash/size mismatch $($record.path)") }
    }
    # Gradle creates caches and compiled outputs in the staging directory after
    # the source inventory is materialized. They are build products, not part
    # of the reproducible source package, and must never invalidate G5.
    $actualStagedPaths = @(Get-ChildItem -LiteralPath $StagingRoot -File -Recurse | ForEach-Object {
        $full = [IO.Path]::GetFullPath($_.FullName)
        $prefix = $StagingRoot.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
        $full.Substring($prefix.Length).Replace('\', '/')
    } | Where-Object {
        $_ -cne ([string]$contract.gates.G5.stagingInventory) -and
        $_ -notmatch '^(?:\.gradle/|build/|app/build/)'
    } | Sort-Object)
    $expectedStagedPaths = @($recordPaths | Sort-Object)
    if (($actualStagedPaths -join "`n") -cne ($expectedStagedPaths -join "`n")) { $inventoryErrors.Add('staging contains files missing from inventory or inventory records missing from staging') }
    foreach ($asset in $bundleAssets) {
        $stagedAssetPath = Join-Path $StagingRoot ('app\src\main\assets\www\' + ([string]$asset.path).Replace('/', '\'))
        $manifestAsset = if ($manifestAssetsById.ContainsKey([string]$asset.id)) { $manifestAssetsById[[string]$asset.id] } else { $null }
        if ($null -eq $manifestAsset -or -not (Test-Path -LiteralPath $stagedAssetPath -PathType Leaf) -or (Get-LowerSha256 $stagedAssetPath) -cne [string]$manifestAsset.sha256) { $inventoryErrors.Add("staged asset is missing/stale: $($asset.id)") }
    }
    Add-GateCheck 'G5' 'staging.inventory' ($inventoryErrors.Count -eq 0) 'Inventory must bind every staged file and every current GameBundle asset.' @($inventoryErrors)

    $manifestText = [IO.File]::ReadAllText($stagedManifestPath)
    $internetEntries = [Text.RegularExpressions.Regex]::Matches($manifestText, '<uses-permission\b[^>]*android:name\s*=\s*"android\.permission\.INTERNET"[^>]*/?>', 'IgnoreCase')
    $noInternet = $internetEntries.Count -eq 0 -or @($internetEntries | Where-Object { $_.Value -notmatch 'tools:node\s*=\s*"remove"' }).Count -eq 0
    Add-GateCheck 'G5' 'manifest.no-internet' $noInternet 'Staged manifest must not grant INTERNET.'

    $stagedAppBuildPath = Join-Path $StagingRoot 'app\build.gradle.kts'
    $appBuildText = if (Test-Path -LiteralPath $stagedAppBuildPath -PathType Leaf) { [IO.File]::ReadAllText($stagedAppBuildPath) } else { '' }
    $applicationIdPattern = 'applicationId\s*=\s*"{0}"' -f [Text.RegularExpressions.Regex]::Escape([string]$releaseRequest.applicationId)
    $versionCodePattern = 'versionCode\s*=\s*{0}\b' -f [int]$releaseRequest.versionCode
    $versionNamePattern = 'versionName\s*=\s*"{0}"' -f [Text.RegularExpressions.Regex]::Escape([string]$releaseRequest.versionName)
    $identityReady = $appBuildText -match $applicationIdPattern -and $appBuildText -match $versionCodePattern -and $appBuildText -match $versionNamePattern
    Add-GateCheck 'G5' 'release.identity' $identityReady 'Staged applicationId/versionCode/versionName must match release request.'
}

$gateResults = [ordered]@{}
foreach ($gate in @('G1', 'G2', 'G3', 'G4', 'G5')) {
    $gateDefinition = $contract.gates.$gate
    $blockedChecks = @($gateChecks[$gate] | Where-Object { $_.status -eq 'blocked' })
    $gateResults[$gate] = [ordered]@{
        name = [string]$gateDefinition.name
        status = if ($blockedChecks.Count -eq 0) { 'ready' } else { 'blocked' }
        checks = @($gateChecks[$gate])
        blockers = @($blockedChecks | ForEach-Object { [ordered]@{ id = $_.id; message = $_.message } })
    }
}
$overall = if (@($gateResults.Values | Where-Object { $_.status -eq 'blocked' }).Count -eq 0) { 'ready' } else { 'blocked' }
$report = [ordered]@{
    schemaVersion = 1
    id = 'la-novena-promesa.android-release-gates'
    generatedAt = [DateTime]::UtcNow.ToString('o')
    status = $overall
    contract = [ordered]@{ path = $GateContractPath; sha256 = Get-LowerSha256 $GateContractPath }
    inputs = [ordered]@{
        templateRoot = $TemplateRoot
        gameBundle = [ordered]@{ path = $bundlePath; sha256 = Get-LowerSha256 $bundlePath }
        assetManifest = [ordered]@{ path = $manifestPath; sha256 = Get-LowerSha256 $manifestPath }
        releaseRequest = [ordered]@{ path = $releaseRequestPath; sha256 = Get-LowerSha256 $releaseRequestPath }
        gameRelease = if ($gameReleaseExists) { [ordered]@{ path = $gameReleasePath; sha256 = Get-LowerSha256 $gameReleasePath } } else { [ordered]@{ path = $gameReleasePath; sha256 = $null } }
        stagingRoot = $StagingRoot
        toolchainReport = $ToolchainReportPath
    }
    gates = $gateResults
}
Write-Utf8NoBom $ReportPath ($report | ConvertTo-Json -Depth 20)
Write-Host "Android release gate report: $ReportPath"
foreach ($gate in @('G1', 'G2', 'G3', 'G4', 'G5')) { Write-Host "$gate`: $($gateResults[$gate].status)" }
if ($overall -eq 'ready') { exit 0 }
exit 3
