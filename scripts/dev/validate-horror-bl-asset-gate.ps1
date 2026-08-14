<#
.SYNOPSIS
Validates the fail-closed chapter asset review gate and fixture byte hashes.

.DESCRIPTION
This command is read-only. Candidate fixtures are never promoted, copied, or
added to the release allowlist. Exit code 0 means the gate contract is
internally valid; -RequireReleaseReady additionally exits 3 while any required
slot is not approved/frozen with matching allowlist and provenance coverage.
#>

[CmdletBinding()]
param(
    [string]$GatePath,
    [string]$AllowlistPath,
    [string]$ProvenancePath,
    [switch]$RequireReleaseReady
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path

function Resolve-RepoFile {
    param([Parameter(Mandatory = $true)][string]$Value)
    if ([IO.Path]::IsPathRooted($Value) -or $Value -match '(^|/|\\)\.\.($|/|\\)' -or $Value -match '^[a-zA-Z][a-zA-Z0-9+.-]*:') {
        throw "Asset gate path is not repository-relative: $Value"
    }
    $resolved = [IO.Path]::GetFullPath((Join-Path $repoRoot $Value.Replace('/', [IO.Path]::DirectorySeparatorChar)))
    $prefix = $repoRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if (-not $resolved.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Asset gate path escapes the repository: $Value"
    }
    return $resolved
}

function Read-JsonDocument {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Required JSON file not found: $Path" }
    $json = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    $convertFromJson = Get-Command ConvertFrom-Json
    if ($convertFromJson.Parameters.ContainsKey('DateKind')) {
        return $json | ConvertFrom-Json -DateKind String
    }
    return $json | ConvertFrom-Json
}

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = $algorithm.ComputeHash($stream)
        return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
    } finally {
        $algorithm.Dispose()
        $stream.Dispose()
    }
}

function Get-StringSha256 {
    param([Parameter(Mandatory = $true)][string]$Value)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
        return ([BitConverter]::ToString($algorithm.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    } finally {
        $algorithm.Dispose()
    }
}

function Get-PngInfo {
    param([Parameter(Mandatory = $true)][string]$Path)
    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    $reader = [IO.BinaryReader]::new($stream)
    try {
        if ($stream.Length -lt 24) { throw 'PNG is shorter than its required signature and IHDR header.' }
        $signature = $reader.ReadBytes(8)
        $expectedSignature = [byte[]](137, 80, 78, 71, 13, 10, 26, 10)
        for ($index = 0; $index -lt $expectedSignature.Length; $index++) {
            if ($signature[$index] -ne $expectedSignature[$index]) { throw 'File signature is not PNG.' }
        }
        $lengthBytes = $reader.ReadBytes(4)
        [Array]::Reverse($lengthBytes)
        $chunkLength = [BitConverter]::ToUInt32($lengthBytes, 0)
        $chunkType = [Text.Encoding]::ASCII.GetString($reader.ReadBytes(4))
        if ($chunkLength -ne 13 -or $chunkType -cne 'IHDR') { throw 'PNG does not begin with a canonical IHDR chunk.' }
        $widthBytes = $reader.ReadBytes(4)
        $heightBytes = $reader.ReadBytes(4)
        [Array]::Reverse($widthBytes)
        [Array]::Reverse($heightBytes)
        $width = [BitConverter]::ToUInt32($widthBytes, 0)
        $height = [BitConverter]::ToUInt32($heightBytes, 0)
        if ($width -lt 1 -or $height -lt 1 -or $width -gt 8192 -or $height -gt 8192) {
            throw "PNG dimensions are outside the 1..8192 release bounds: ${width}x${height}."
        }
        return [pscustomobject][ordered]@{
            mediaType = 'image/png'
            width = [uint32]$width
            height = [uint32]$height
        }
    } finally {
        $reader.Dispose()
        $stream.Dispose()
    }
}

function Get-Property {
    param(
        [Parameter(Mandatory = $true)][object]$Value,
        [Parameter(Mandatory = $true)][string]$Name
    )
    $property = $Value.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

if (-not $GatePath) { $GatePath = 'templates/horror-bl/release-input/asset-approval-gate.v1.json' }
$resolvedGate = Resolve-RepoFile -Value $GatePath
$gate = Read-JsonDocument -Path $resolvedGate
$projectRoot = Split-Path -Parent (Split-Path -Parent $resolvedGate)

if (-not $AllowlistPath) { $AllowlistPath = [string](Get-Property -Value $gate -Name 'allowlistPath') }
if (-not $ProvenancePath) { $ProvenancePath = [string](Get-Property -Value $gate -Name 'provenancePath') }
$resolvedAllowlist = Resolve-RepoFile -Value $AllowlistPath
$resolvedProvenance = Resolve-RepoFile -Value $ProvenancePath
$allowlistDocument = Read-JsonDocument -Path $resolvedAllowlist
$provenanceDocument = Read-JsonDocument -Path $resolvedProvenance

$issues = [Collections.Generic.List[object]]::new()
function Add-Issue {
    param(
        [Parameter(Mandatory = $true)][string]$Code,
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Message
    )
    $issues.Add([pscustomobject][ordered]@{ code = $Code; path = $Path; message = $Message })
}

$requiredSlotIds = @(
    'portrait.damian',
    'portrait.elian',
    'threat.ninth-witness',
    'seed.damian.full-body',
    'background.facility-lobby',
    'background.archive-sublevel',
    'background.service-corridor'
)
$sha256Pattern = '^[a-f0-9]{64}$'
$slots = @((Get-Property -Value $gate -Name 'requiredSlots'))
$candidateIntegrity = [Collections.Generic.List[object]]::new()

if ((Get-Property -Value $gate -Name 'schemaVersion') -ne 1) {
    Add-Issue -Code 'schema-version' -Path '$.schemaVersion' -Message 'Expected schemaVersion 1.'
}
if ($slots.Count -ne $requiredSlotIds.Count) {
    Add-Issue -Code 'slot-count' -Path '$.requiredSlots' -Message "Expected exactly $($requiredSlotIds.Count) required chapter asset slots."
}

$seenSlots = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$approvedIds = [Collections.Generic.List[string]]::new()
$approvedRecords = [Collections.Generic.List[object]]::new()
foreach ($slot in $slots) {
    $slotId = [string](Get-Property -Value $slot -Name 'slotId')
    $slotPath = "$.requiredSlots[$slotId]"
    if ($slotId -notin $requiredSlotIds) {
        Add-Issue -Code 'slot-id' -Path "$slotPath.slotId" -Message "Unexpected required slot '$slotId'."
    } elseif (-not $seenSlots.Add($slotId)) {
        Add-Issue -Code 'slot-duplicate' -Path "$slotPath.slotId" -Message "Duplicate slot '$slotId'."
    }

    $reviewState = [string](Get-Property -Value $slot -Name 'reviewState')
    $releaseEligible = (Get-Property -Value $slot -Name 'releaseEligible') -eq $true
    $candidate = Get-Property -Value $slot -Name 'candidate'
    $approval = Get-Property -Value $slot -Name 'approval'

    # Fixture evidence remains attached after promotion as a denylist. Validate
    # it in every state so an approved asset can never silently reuse fixture
    # bytes or lose the evidence that the exporter is expected to reject.
    if ($null -ne $candidate) {
        if ((Get-Property -Value $candidate -Name 'fixtureOnly') -ne $true) {
            Add-Issue -Code 'fixture-marker' -Path "$slotPath.candidate.fixtureOnly" -Message 'Repository candidate evidence must be explicitly fixture-only.'
        }
        if ((Get-Property -Value $candidate -Name 'licenseStatus') -ne 'unconfirmed') {
            Add-Issue -Code 'license-claim' -Path "$slotPath.candidate.licenseStatus" -Message 'No license is established for these fixtures; expected unconfirmed.'
        }
        try {
            $repositoryPath = [string](Get-Property -Value $candidate -Name 'repositoryPath')
            $fixturePath = Resolve-RepoFile -Value $repositoryPath
            if (-not (Test-Path -LiteralPath $fixturePath -PathType Leaf)) { throw "Fixture not found: $repositoryPath" }
            $item = Get-Item -LiteralPath $fixturePath -Force
            $actualHash = Get-Sha256 -Path $fixturePath
            $declaredFixtureHash = [string](Get-Property -Value $candidate -Name 'sha256')
            $declaredFixtureSize = [long](Get-Property -Value $candidate -Name 'sizeBytes')
            $hashMatches = $declaredFixtureHash -match $sha256Pattern -and $actualHash -ceq $declaredFixtureHash
            $sizeMatches = $item.Length -eq $declaredFixtureSize
            if (-not $hashMatches) { Add-Issue -Code 'fixture-hash' -Path "$slotPath.candidate.sha256" -Message "SHA-256 mismatch for $repositoryPath." }
            if (-not $sizeMatches) { Add-Issue -Code 'fixture-size' -Path "$slotPath.candidate.sizeBytes" -Message "Byte-size mismatch for $repositoryPath." }
            $candidateIntegrity.Add([pscustomobject][ordered]@{
                slotId = $slotId
                repositoryPath = $repositoryPath
                sizeBytes = [long]$item.Length
                sha256 = $actualHash
                matches = $hashMatches -and $sizeMatches
            })
        } catch {
            Add-Issue -Code 'fixture-path' -Path "$slotPath.candidate.repositoryPath" -Message $_.Exception.Message
        }
    }

    if ($reviewState -eq 'candidate') {
        if ($releaseEligible) {
            Add-Issue -Code 'candidate-release-eligible' -Path "$slotPath.releaseEligible" -Message 'Candidate fixtures must be release-ineligible.'
        }
        if ($null -ne $approval) {
            Add-Issue -Code 'candidate-approval' -Path "$slotPath.approval" -Message 'A candidate cannot carry an approval record.'
        }
        if ($null -eq $candidate) {
            Add-Issue -Code 'candidate-missing' -Path "$slotPath.candidate" -Message 'Candidate state requires hash-pinned fixture evidence.'
            continue
        }
    } elseif ($reviewState -in @('approved', 'frozen')) {
        if (-not $releaseEligible -or $null -eq $approval) {
            Add-Issue -Code 'approval-incomplete' -Path $slotPath -Message 'Approved/frozen state requires releaseEligible=true and an approval record.'
            continue
        }
        $assetId = [string](Get-Property -Value $approval -Name 'assetId')
        if ($assetId -cne $slotId) {
            Add-Issue -Code 'approval-id' -Path "$slotPath.approval.assetId" -Message 'Approved asset id must equal its stable slot id.'
        }
        $licenseNote = [string](Get-Property -Value $approval -Name 'licenseNote')
        if ([string]::IsNullOrWhiteSpace($licenseNote)) {
            Add-Issue -Code 'approval-license' -Path "$slotPath.approval.licenseNote" -Message 'Approval requires an explicit rights and redistribution note; generated output must not be mislabeled as a third-party license.'
        }
        $reviewer = [string](Get-Property -Value $approval -Name 'reviewer')
        $decidedAt = [string](Get-Property -Value $approval -Name 'decidedAt')
        if ([string]::IsNullOrWhiteSpace($reviewer)) {
            Add-Issue -Code 'approval-reviewer' -Path "$slotPath.approval.reviewer" -Message 'Approval requires a non-blank reviewer.'
        }
        $parsedDecision = [DateTimeOffset]::MinValue
        if (-not [DateTimeOffset]::TryParse($decidedAt, [ref]$parsedDecision)) {
            Add-Issue -Code 'approval-date' -Path "$slotPath.approval.decidedAt" -Message 'Approval requires an ISO-compatible decision timestamp.'
        }
        $runtimePath = [string](Get-Property -Value $approval -Name 'runtimePath')
        $source = [string](Get-Property -Value $approval -Name 'source')
        $declaredHash = [string](Get-Property -Value $approval -Name 'sha256')
        $declaredSize = [long](Get-Property -Value $approval -Name 'sizeBytes')
        $declaredMediaType = [string](Get-Property -Value $approval -Name 'mediaType')
        $declaredWidth = [long](Get-Property -Value $approval -Name 'width')
        $declaredHeight = [long](Get-Property -Value $approval -Name 'height')
        if ($source -notin @('local', 'imported', 'generated')) {
            Add-Issue -Code 'approval-source' -Path "$slotPath.approval.source" -Message 'Approved source must be local, imported, or generated.'
        }
        if ($declaredMediaType -cne 'image/png') {
            Add-Issue -Code 'approval-media-type' -Path "$slotPath.approval.mediaType" -Message 'Chapter release visuals must be verified PNG files.'
        }
        try {
            if (-not $runtimePath.StartsWith('assets/', [StringComparison]::Ordinal)) { throw 'runtimePath must be below assets/.' }
            if ([IO.Path]::IsPathRooted($runtimePath) -or $runtimePath -match '(^|/)\.\.($|/)') { throw 'runtimePath must be a safe relative path.' }
            $approvedPath = [IO.Path]::GetFullPath((Join-Path $projectRoot $runtimePath.Replace('/', [IO.Path]::DirectorySeparatorChar)))
            $projectPrefix = $projectRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
            if (-not $approvedPath.StartsWith($projectPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'runtimePath escapes the template root.' }
            if (-not (Test-Path -LiteralPath $approvedPath -PathType Leaf)) { throw "Approved runtime bytes not found: $runtimePath" }
            $approvedItem = Get-Item -LiteralPath $approvedPath -Force
            $actualHash = Get-Sha256 -Path $approvedPath
            $pngInfo = Get-PngInfo -Path $approvedPath
            if ($declaredHash -notmatch $sha256Pattern -or $actualHash -cne $declaredHash) { throw "Approved SHA-256 mismatch for $runtimePath." }
            if ($approvedItem.Length -ne $declaredSize) { throw "Approved byte-size mismatch for $runtimePath." }
            if ($declaredMediaType -cne $pngInfo.mediaType -or $declaredWidth -ne $pngInfo.width -or $declaredHeight -ne $pngInfo.height) {
                throw "Approved media metadata mismatch for $runtimePath; actual PNG is $($pngInfo.width)x$($pngInfo.height)."
            }
        } catch {
            Add-Issue -Code 'approval-bytes' -Path "$slotPath.approval.runtimePath" -Message $_.Exception.Message
        }
        if (@((Get-Property -Value $slot -Name 'blockers')).Count -ne 0) {
            Add-Issue -Code 'approval-blockers' -Path "$slotPath.blockers" -Message 'Approved/frozen slots cannot retain blockers.'
        }
        $approvedIds.Add($assetId)
        $approvedRecords.Add([pscustomobject][ordered]@{
            assetId = $assetId
            runtimePath = $runtimePath
            source = $source
            sha256 = $declaredHash
            sizeBytes = $declaredSize
            mediaType = $declaredMediaType
            width = $declaredWidth
            height = $declaredHeight
        })
    } else {
        Add-Issue -Code 'review-state' -Path "$slotPath.reviewState" -Message "Unsupported review state '$reviewState'."
    }
}

foreach ($requiredSlotId in $requiredSlotIds) {
    if (-not $seenSlots.Contains($requiredSlotId)) {
        Add-Issue -Code 'slot-missing' -Path '$.requiredSlots' -Message "Missing required slot '$requiredSlotId'."
    }
}

$fixtureHashes = @($candidateIntegrity | ForEach-Object { [string]$_.sha256 } | Where-Object { $_ } | Sort-Object -Unique)
foreach ($record in $approvedRecords) {
    if ([string]$record.sha256 -in $fixtureHashes) {
        Add-Issue -Code 'approval-fixture-reuse' -Path "$.requiredSlots[$($record.assetId)].approval.sha256" -Message 'Approved runtime bytes cannot reuse any hash-pinned fixture candidate.'
    }
}

$allowlistNode = if ($allowlistDocument -is [Array]) { $allowlistDocument } else { Get-Property -Value $allowlistDocument -Name 'assetAllowlist' }
$allowlist = @($allowlistNode | ForEach-Object { [string]$_ })
$provenance = @((Get-Property -Value $provenanceDocument -Name 'assets'))
$provenanceIds = @($provenance | ForEach-Object { [string](Get-Property -Value $_ -Name 'assetId') })
$declaredApprovedIds = @((Get-Property -Value $gate -Name 'approvedAssetIds') | ForEach-Object { [string]$_ })

function Compare-IdSets {
    param([string[]]$Left, [string[]]$Right)
    return @(Compare-Object -ReferenceObject @($Left | Sort-Object -Unique) -DifferenceObject @($Right | Sort-Object -Unique)).Count -eq 0
}

if (-not (Compare-IdSets -Left @($approvedIds) -Right $declaredApprovedIds)) {
    Add-Issue -Code 'approved-id-drift' -Path '$.approvedAssetIds' -Message 'approvedAssetIds must be derived exactly from approved/frozen slots.'
}
if (-not (Compare-IdSets -Left @($approvedIds) -Right $allowlist)) {
    Add-Issue -Code 'allowlist-drift' -Path '$.assetAllowlist' -Message 'The release allowlist must contain every and only approved/frozen slot id.'
}
if (-not (Compare-IdSets -Left @($approvedIds) -Right $provenanceIds)) {
    Add-Issue -Code 'provenance-drift' -Path '$.provenance.assets' -Message 'Release provenance must contain every and only approved/frozen slot id.'
}
if ((Get-Property -Value $provenanceDocument -Name 'schemaVersion') -ne 1) {
    Add-Issue -Code 'provenance-schema-version' -Path '$.provenance.schemaVersion' -Message 'Expected provenance schemaVersion 1.'
}
if (@($allowlist | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -gt 0 -or @($allowlist | Sort-Object -Unique).Count -ne $allowlist.Count) {
    Add-Issue -Code 'allowlist-shape' -Path '$.assetAllowlist' -Message 'The release allowlist cannot contain blank or duplicate ids.'
}
if (@($provenanceIds | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -gt 0 -or @($provenanceIds | Sort-Object -Unique).Count -ne $provenanceIds.Count) {
    Add-Issue -Code 'provenance-shape' -Path '$.provenance.assets' -Message 'Provenance cannot contain blank or duplicate asset ids.'
}

foreach ($record in $approvedRecords) {
    $assetId = [string]$record.assetId
    $entryPath = "$.provenance.assets[$assetId]"
    $entries = @($provenance | Where-Object { [string](Get-Property -Value $_ -Name 'assetId') -ceq $assetId })
    if ($entries.Count -ne 1) { continue }
    $entry = $entries[0]
    foreach ($field in @('origin', 'license')) {
        if ([string]::IsNullOrWhiteSpace([string](Get-Property -Value $entry -Name $field))) {
            Add-Issue -Code 'provenance-rights' -Path "$entryPath.$field" -Message "Provenance $field must state the known basis without inventing a license or ownership claim."
        }
    }
    if ([string](Get-Property -Value $entry -Name 'runtimePath') -cne [string]$record.runtimePath -or
        [string](Get-Property -Value $entry -Name 'source') -cne [string]$record.source) {
        Add-Issue -Code 'provenance-runtime-drift' -Path $entryPath -Message 'Provenance runtimePath/source must exactly match the approval record.'
    }

    if ($record.source -ceq 'generated') {
        $generated = Get-Property -Value $entry -Name 'generated'
        if ($null -eq $generated) {
            Add-Issue -Code 'provenance-generated-missing' -Path "$entryPath.generated" -Message 'Generated output requires transparent provider/tool/model and byte metadata.'
            continue
        }
        foreach ($field in @('providerId', 'providerDisplayName', 'tool', 'modelId', 'operation', 'createdAt', 'generationRecordPath', 'prompt', 'promptSha256')) {
            if ([string]::IsNullOrWhiteSpace([string](Get-Property -Value $generated -Name $field))) {
                Add-Issue -Code 'provenance-generated-field' -Path "$entryPath.generated.$field" -Message "Generated provenance field '$field' is required. Use an explicit not-disclosed value when the built-in tool does not expose one."
            }
        }
        $createdAt = [string](Get-Property -Value $generated -Name 'createdAt')
        $parsedCreatedAt = [DateTimeOffset]::MinValue
        if (-not [DateTimeOffset]::TryParse($createdAt, [ref]$parsedCreatedAt)) {
            Add-Issue -Code 'provenance-generated-date' -Path "$entryPath.generated.createdAt" -Message 'Generated createdAt must be an ISO-compatible timestamp.'
        }
        if ([string](Get-Property -Value $generated -Name 'outputSha256') -cne [string]$record.sha256 -or
            [long](Get-Property -Value $generated -Name 'outputSizeBytes') -ne [long]$record.sizeBytes -or
            [string](Get-Property -Value $generated -Name 'mediaType') -cne [string]$record.mediaType -or
            [long](Get-Property -Value $generated -Name 'width') -ne [long]$record.width -or
            [long](Get-Property -Value $generated -Name 'height') -ne [long]$record.height) {
            Add-Issue -Code 'provenance-generated-bytes' -Path "$entryPath.generated" -Message 'Generated provenance hash, byte size, media type, and dimensions must exactly match approved runtime bytes.'
        }
        $referencesProperty = $generated.PSObject.Properties['referenceImages']
        if ($null -eq $referencesProperty -or ($null -ne $referencesProperty.Value -and -not ($referencesProperty.Value -is [Array]))) {
            Add-Issue -Code 'provenance-generated-references' -Path "$entryPath.generated.referenceImages" -Message 'referenceImages must be an explicit array; use [] when no reference image was supplied.'
        }
        $identityConsent = Get-Property -Value $generated -Name 'identityConsent'
        if ($null -eq $identityConsent -or [string]::IsNullOrWhiteSpace([string](Get-Property -Value $identityConsent -Name 'status')) -or
            [string]::IsNullOrWhiteSpace([string](Get-Property -Value $identityConsent -Name 'basis'))) {
            Add-Issue -Code 'provenance-generated-consent' -Path "$entryPath.generated.identityConsent" -Message 'Record identity-reference consent honestly; use not-applicable only when no real-person identity/reference was supplied.'
        }

        try {
            $generationRecordPath = [string](Get-Property -Value $generated -Name 'generationRecordPath')
            if (-not $generationRecordPath.StartsWith('assets/source/generated/', [StringComparison]::Ordinal) -or
                [IO.Path]::IsPathRooted($generationRecordPath) -or $generationRecordPath -match '(^|/)\.\.($|/)') {
                throw 'generationRecordPath must be a safe project-relative path below assets/source/generated/.'
            }
            $generationRecordFile = [IO.Path]::GetFullPath((Join-Path $projectRoot $generationRecordPath.Replace('/', [IO.Path]::DirectorySeparatorChar)))
            $projectPrefix = $projectRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
            if (-not $generationRecordFile.StartsWith($projectPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'generationRecordPath escapes the template root.' }
            $generationRecord = Read-JsonDocument -Path $generationRecordFile
            $sessionEntries = @((Get-Property -Value $generationRecord -Name 'assets') | Where-Object { [string](Get-Property -Value $_ -Name 'assetId') -ceq $assetId })
            if ($sessionEntries.Count -ne 1) { throw "Generation record needs exactly one '$assetId' entry." }
            $sessionEntry = $sessionEntries[0]
            $sessionExecution = Get-Property -Value $generationRecord -Name 'execution'
            $prompt = [string](Get-Property -Value $sessionEntry -Name 'prompt')
            $declaredPrompt = [string](Get-Property -Value $generated -Name 'prompt')
            $promptSha256 = [string](Get-Property -Value $generated -Name 'promptSha256')
            if ([string]::IsNullOrWhiteSpace($prompt) -or $declaredPrompt -cne $prompt -or $promptSha256 -notmatch $sha256Pattern -or (Get-StringSha256 -Value $prompt) -cne $promptSha256) {
                throw 'promptSha256 does not match the exact UTF-8 prompt retained by the generation record.'
            }
            if ([string](Get-Property -Value $sessionExecution -Name 'tool') -cne [string](Get-Property -Value $generated -Name 'tool') -or
                [string](Get-Property -Value $sessionExecution -Name 'provider') -cne [string](Get-Property -Value $generated -Name 'providerDisplayName')) {
                throw 'Provider/tool metadata differs from the generation record.'
            }
            $sessionModel = Get-Property -Value $sessionExecution -Name 'model'
            $declaredModel = [string](Get-Property -Value $generated -Name 'modelId')
            if ($null -eq $sessionModel) {
                if ($declaredModel -cne 'not-disclosed') { throw 'The generation record exposes no model; modelId must state not-disclosed.' }
            } elseif ($declaredModel -cne [string]$sessionModel) {
                throw 'modelId differs from the generation record.'
            }
            if ([string](Get-Property -Value $sessionEntry -Name 'sha256') -cne [string]$record.sha256 -or
                [long](Get-Property -Value $sessionEntry -Name 'sizeBytes') -ne [long]$record.sizeBytes -or
                [long](Get-Property -Value $sessionEntry -Name 'width') -ne [long]$record.width -or
                [long](Get-Property -Value $sessionEntry -Name 'height') -ne [long]$record.height -or
                [string](Get-Property -Value $sessionEntry -Name 'generatedAt') -cne [string](Get-Property -Value $generated -Name 'createdAt')) {
                throw 'Output metadata differs from the retained generation record.'
            }
        } catch {
            Add-Issue -Code 'provenance-generation-record' -Path "$entryPath.generated.generationRecordPath" -Message $_.Exception.Message
        }
    }
}

$declaredReleaseReady = (Get-Property -Value $gate -Name 'releaseReady') -eq $true
$declaredBlockers = @((Get-Property -Value $gate -Name 'blockers'))
if (-not $declaredReleaseReady -and $declaredBlockers.Count -eq 0) {
    Add-Issue -Code 'release-blockers-missing' -Path '$.blockers' -Message 'A blocked release gate must explain at least one blocker.'
}
if ($declaredReleaseReady -and $declaredBlockers.Count -ne 0) {
    Add-Issue -Code 'release-blockers-stale' -Path '$.blockers' -Message 'A release-ready gate cannot retain blockers.'
}
$derivedReleaseReady = $approvedIds.Count -eq $requiredSlotIds.Count -and $issues.Count -eq 0
if ($declaredReleaseReady -ne $derivedReleaseReady) {
    Add-Issue -Code 'release-ready-drift' -Path '$.releaseReady' -Message "Declared releaseReady=$declaredReleaseReady but derived value is $derivedReleaseReady."
}

$valid = $issues.Count -eq 0
$report = [ordered]@{
    schemaVersion = 1
    valid = $valid
    releaseReady = $derivedReleaseReady
    requiredSlotIds = $requiredSlotIds
    approvedAssetIds = @($approvedIds)
    allowlistAssetIds = $allowlist
    provenanceAssetIds = $provenanceIds
    candidateIntegrity = @($candidateIntegrity)
    issues = @($issues)
}
$report | ConvertTo-Json -Depth 16

if (-not $valid) { exit 2 }
if ($RequireReleaseReady -and -not $derivedReleaseReady) { exit 3 }
exit 0
