[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$GameBundlePath,
    [Parameter(Mandatory = $true)][string]$AssetRoot,
    [Parameter(Mandatory = $true)][string]$WebDistPath,
    [string]$AssetManifestPath = '',
    [string]$EditorAcceptanceEvidencePath = '',
    [string]$OutputPath = '',
    [switch]$Force,
    [switch]$RequireAcceptedHumanReview
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$templateRoot = Join-Path $repoRoot 'src\platform\android\native-scaffold'
if ([string]::IsNullOrWhiteSpace($OutputPath)) { $OutputPath = Join-Path $repoRoot 'output\android-webview' }
$markerContent = 'RPGCreatorAI Android scaffold v1'
$runtimeContractRelativePath = 'data/android-runtime-contract.v1.json'
$runtimeContractId = 'rpgcreatorai-phaser-android'
$androidAssetBaseUrl = '/assets/www/'
$defaultAssetManifestRelativePath = 'data/assets/assets-manifest.json'
$maxBundleBytes = 64MB
$maxPackageFiles = 20000
$maxPackageBytes = 512MB
$forbiddenPackageNames = @('.env', '.env.local', '.env.production', 'credentials.json', 'google-services.json', 'keystore.properties', 'local.properties', 'secrets.json')
$forbiddenPackageExtensions = @('.jks', '.keystore', '.key', '.p12', '.pem', '.pfx')

function Assert-NoReparseTraversal([string]$Path, [string]$Label) {
    $full = [IO.Path]::GetFullPath($Path)
    if ($full.StartsWith('\\', [StringComparison]::Ordinal) -or $full.StartsWith('//', [StringComparison]::Ordinal)) {
        throw "$Label must be on a local filesystem: $Path"
    }
    $root = [IO.Path]::GetPathRoot($full)
    if (-not $root) { throw "$Label has no filesystem root: $Path" }
    $current = $root
    foreach ($segment in [Text.RegularExpressions.Regex]::Split($full.Substring($root.Length), '[\\/]')) {
        if (-not $segment) { continue }
        $current = Join-Path $current $segment
        if (-not (Test-Path -LiteralPath $current)) { break }
        $item = Get-Item -LiteralPath $current -Force
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "$Label traverses a symlink, junction, cloud placeholder, or other reparse point: $($item.FullName)"
        }
    }
    return $full
}

function Test-IsInside([string]$Candidate, [string]$Root) {
    $candidateFull = [IO.Path]::GetFullPath($Candidate)
    $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    return $candidateFull.Equals($rootFull, [StringComparison]::OrdinalIgnoreCase) -or
        $candidateFull.StartsWith("$rootFull$([IO.Path]::DirectorySeparatorChar)", [StringComparison]::OrdinalIgnoreCase)
}

function Resolve-ExistingPath([string]$Path, [string]$Label, [string]$PathType) {
    $full = Assert-NoReparseTraversal $Path $Label
    if (-not (Test-Path -LiteralPath $full -PathType $PathType)) { throw "$Label does not exist or has the wrong type: $Path" }
    return (Get-Item -LiteralPath $full -Force).FullName
}

function Convert-ToSafeRelativePath([string]$Path, [string]$Label) {
    if ($Path -ne $Path.Trim()) { throw "$Label must not have leading or trailing whitespace: $Path" }
    if ($Path.Contains('\')) { throw "$Label must use forward slashes: $Path" }
    $normalized = $Path.Replace('\', '/')
    if ([string]::IsNullOrWhiteSpace($normalized) -or [IO.Path]::IsPathRooted($normalized) -or $normalized.Contains(':')) { throw "$Label must be relative: $Path" }
    $segments = $normalized.Split('/')
    $reserved = '^(?i:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$'
    if ($segments | Where-Object { $_ -eq '' -or $_ -eq '.' -or $_ -eq '..' -or $_ -eq '~' -or $_ -match '[. ]$' -or $_ -match $reserved }) { throw "$Label contains an unsafe segment: $Path" }
    if ($normalized -notmatch '^[A-Za-z0-9._~/-]+$') { throw "$Label must use URL-safe ASCII path characters: $Path" }
    return $normalized
}

function Get-RelativePathCompat([string]$BasePath, [string]$ChildPath) {
    $baseFull = [IO.Path]::GetFullPath($BasePath).TrimEnd('\', '/')
    $childFull = [IO.Path]::GetFullPath($ChildPath)
    if ($childFull.Equals($baseFull, [StringComparison]::OrdinalIgnoreCase)) { return '' }
    $prefix = "$baseFull$([IO.Path]::DirectorySeparatorChar)"
    if ($childFull.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        return $childFull.Substring($prefix.Length)
    }
    # Windows PowerShell 5.1 lacks [IO.Path]::GetRelativePath. Uri keeps this
    # fallback deterministic for paths on the same local volume.
    $baseUri = [Uri]::new("$prefix")
    $childUri = [Uri]::new($childFull)
    return [Uri]::UnescapeDataString($baseUri.MakeRelativeUri($childUri).ToString()).Replace('/', [IO.Path]::DirectorySeparatorChar)
}

function Write-Utf8NoBom([string]$Path, [string]$Value) {
    [IO.File]::WriteAllText($Path, $Value, [Text.UTF8Encoding]::new($false))
}

$allowedPackageExtensions = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
@(
    '.html', '.js', '.mjs', '.css', '.json', '.wasm', '.webmanifest',
    '.avif', '.bmp', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.svg', '.webp',
    '.aac', '.flac', '.m4a', '.mp3', '.oga', '.ogg', '.opus', '.wav',
    '.m4v', '.mp4', '.ogv', '.webm', '.srt', '.vtt',
    '.otf', '.ttf', '.woff', '.woff2'
) | ForEach-Object { [void]$allowedPackageExtensions.Add($_) }
$allowedRuntimeAssetExtensions = @('.bmp', '.jpeg', '.jpg', '.png', '.webp', '.mp3', '.ogg', '.wav')

function Assert-AllowlistedPackagePath([string]$Path, [string]$Label) {
    $relative = Convert-ToSafeRelativePath $Path $Label
    if ($relative.Length -gt 512) { throw "$Label is longer than the offline package limit: $relative" }
    $extension = [IO.Path]::GetExtension($relative)
    if (-not $allowedPackageExtensions.Contains($extension)) { throw "$Label has an unsupported offline extension: $relative" }
    if ($extension -ieq '.html' -and $relative -cne 'index.html') { throw "$Label contains a non-entry HTML document: $relative" }
    return $relative
}

function Get-SafeTreeFiles([string]$Root, [string]$Label) {
    [void](Assert-NoReparseTraversal $Root $Label)
    $queue = [Collections.Generic.Queue[string]]::new()
    $queue.Enqueue($Root)
    while ($queue.Count -gt 0) {
        $directory = $queue.Dequeue()
        foreach ($item in Get-ChildItem -LiteralPath $directory -Force) {
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "$Label contains a symlink, junction, cloud placeholder, or reparse point: $($item.FullName)"
            }
            if ($item.PSIsContainer) { $queue.Enqueue($item.FullName) } else { Write-Output $item }
        }
    }
}

function Test-IsGeneratedAndroidOutput([string]$RelativePath) {
    return $RelativePath -match '^(?:\.gradle/|build/|app/build/)'
}

function Assert-NoPackagedSecret([IO.FileInfo]$File, [string]$Label) {
    $basename = $File.Name.ToLowerInvariant()
    $extension = $File.Extension.ToLowerInvariant()
    if ($forbiddenPackageNames -contains $basename -or $forbiddenPackageExtensions -contains $extension) {
        throw "$Label contains forbidden credential or signing material: $($File.FullName)"
    }
    if ($File.Length -gt 16MB -or @('.css', '.gradle', '.html', '.java', '.js', '.json', '.kts', '.mjs', '.properties', '.txt', '.xml') -notcontains $extension) { return }
    $text = [IO.File]::ReadAllText($File.FullName)
    $patterns = @(
        '-----BEGIN(?: [A-Z]+)* PRIVATE KEY-----',
        '\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}\b',
        '\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b',
        '\bxox[baprs]-[A-Za-z0-9-]{16,}\b',
        '\bAKIA[0-9A-Z]{16}\b',
        '\bAIza[0-9A-Za-z_-]{35}\b',
        '\bBearer\s+[A-Za-z0-9._~+/-]{20,}={0,2}\b',
        '(?i)"(?:api[_-]?key|access[_-]?token|authorization|client[_-]?secret|password|private[_-]?key|refresh[_-]?token|secret|session[_-]?token)"\s*:'
    )
    foreach ($pattern in $patterns) {
        if ([Text.RegularExpressions.Regex]::IsMatch($text, $pattern)) {
            throw "$Label contains likely credential material: $($File.FullName)"
        }
    }
}

function Get-LowerSha256Bytes([byte[]]$Bytes) {
    $hasher = [Security.Cryptography.SHA256]::Create()
    try {
        return -join ($hasher.ComputeHash($Bytes) | ForEach-Object { $_.ToString('x2') })
    } finally {
        $hasher.Dispose()
    }
}

function Copy-SafeTree([string]$Source, [string]$Destination, [string]$Label, [switch]$RuntimeWebFiles) {
    $files = @(Get-SafeTreeFiles $Source $Label | Where-Object {
        $relative = (Get-RelativePathCompat $Source $_.FullName).Replace('\', '/')
        -not (Test-IsGeneratedAndroidOutput $relative)
    })
    if ($files.Count -gt $maxPackageFiles) { throw "$Label exceeds the $maxPackageFiles-file package limit." }
    $totalBytes = [long]0
    foreach ($file in $files) {
        $relative = Convert-ToSafeRelativePath (Get-RelativePathCompat $Source $file.FullName).Replace('\', '/') "$Label path"
        $totalBytes += [long]$file.Length
        if ($totalBytes -gt $maxPackageBytes) { throw "$Label exceeds the $maxPackageBytes-byte package limit." }
        if ($RuntimeWebFiles) { [void](Assert-AllowlistedPackagePath $relative "$Label path") }
        Assert-NoPackagedSecret $file $Label
        $targetFile = Join-Path $Destination $relative.Replace('/', [IO.Path]::DirectorySeparatorChar)
        if (-not (Test-IsInside $targetFile $Destination)) { throw "$Label destination escaped package root: $relative" }
        if (Test-Path -LiteralPath $targetFile) { throw "$Label destination collision: $relative" }
        $targetParent = Split-Path -Parent $targetFile
        [IO.Directory]::CreateDirectory($targetParent) | Out-Null
        [void](Assert-NoReparseTraversal $targetParent "$Label destination")
        Copy-Item -LiteralPath $file.FullName -Destination $targetFile
    }
}

function Test-HasProperty([object]$Value, [string]$Name) {
    return $null -ne $Value -and $null -ne $Value.PSObject.Properties[$Name]
}

function Test-IsJsonObject([object]$Value) {
    return $null -ne $Value -and $Value -is [PSCustomObject]
}

function Assert-G4AcceptanceEvidence {
    param(
        [Parameter(Mandatory = $true)][string]$EvidencePath,
        [Parameter(Mandatory = $true)][object[]]$BundleAssets,
        [Parameter(Mandatory = $true)][object]$AssetPolicy,
        [Parameter(Mandatory = $true)][string]$AssetRootPath,
        [Parameter(Mandatory = $true)][string]$GameBundlePath
    )
    $evidenceItem = Get-Item -LiteralPath $EvidencePath -Force
    if ($evidenceItem.Length -le 0 -or $evidenceItem.Length -gt 4MB) { throw 'Editor acceptance evidence has an invalid size.' }
    Assert-NoPackagedSecret $evidenceItem 'Editor acceptance evidence'
    try { $evidence = [IO.File]::ReadAllText($EvidencePath, [Text.UTF8Encoding]::new($false, $true)) | ConvertFrom-Json } catch { throw "Editor acceptance evidence is invalid JSON: $($_.Exception.Message)" }
    if (-not (Test-IsJsonObject $evidence) -or $evidence.schemaVersion -ne 1 -or [string]$evidence.status -cne 'accepted') {
        throw 'Editor acceptance evidence must use schemaVersion 1 and status accepted.'
    }
    $reviewer = $evidence.PSObject.Properties['reviewer']
    if ($null -eq $reviewer -or [string]$evidence.reviewer.kind -notin @('human', 'delegated-by-creator') -or [string]::IsNullOrWhiteSpace([string]$evidence.reviewer.label)) {
        throw 'Editor acceptance evidence must identify a human or explicitly delegated reviewer.'
    }
    $reviewTimestamp = [DateTimeOffset]::MinValue
    if (-not [DateTimeOffset]::TryParse([string]$evidence.reviewedAt, [ref]$reviewTimestamp)) { throw 'Editor acceptance evidence reviewedAt is invalid.' }
    if (-not (Test-HasProperty $evidence 'resources') -or $evidence.resources -isnot [Array]) { throw 'Editor acceptance evidence must contain resources[].' }

    $expectedIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($asset in @($BundleAssets)) {
        $id = [string]$asset.id
        if ([string]::IsNullOrWhiteSpace($id) -or -not $expectedIds.Add($id)) { throw "GameBundle contains a duplicate or invalid G4 asset id: $id" }
    }
    $seenIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($decision in @($evidence.resources)) {
        $id = [string]$decision.resourceId
        if (-not $expectedIds.Contains($id)) { throw "Editor acceptance evidence contains an unknown resource: $id" }
        if (-not $seenIds.Add($id)) { throw "Editor acceptance evidence contains a duplicate resource: $id" }
        if ([string]$decision.kind -cne 'asset' -or [string]$decision.status -cne 'accepted' -or [string]$decision.sha256 -notmatch '^[a-f0-9]{64}$') {
            throw "Editor acceptance evidence decision is not hash-bound accepted asset evidence: $id"
        }
        $asset = @($BundleAssets | Where-Object { [string]$_.id -ceq $id })[0]
        $runtimePath = [string]$asset.path
        if (-not $runtimePath.StartsWith('assets/', [StringComparison]::Ordinal)) { throw "G4 runtime path is outside assets/: $id" }
        $runtimeFile = [IO.Path]::GetFullPath((Join-Path $AssetRootPath $runtimePath.Replace('/', [IO.Path]::DirectorySeparatorChar)))
        if (-not (Test-IsInside $runtimeFile $AssetRootPath) -or -not (Test-Path -LiteralPath $runtimeFile -PathType Leaf)) { throw "G4 runtime bytes are missing: $id" }
        $actualHash = Get-LowerSha256Bytes ([IO.File]::ReadAllBytes($runtimeFile))
        if ([string]$decision.sha256 -cne $actualHash) { throw "G4 evidence hash does not match runtime bytes: $id" }
        if (-not $AssetPolicy.assetsById.ContainsKey($id) -or [string]$AssetPolicy.assetsById[$id].sha256 -cne $actualHash) { throw "G4 evidence asset manifest hash does not match runtime bytes: $id" }
    }
    if ($seenIds.Count -ne $expectedIds.Count) { throw "Editor acceptance evidence must cover every GameBundle asset (expected $($expectedIds.Count), found $($seenIds.Count))." }
    if ([string]$evidence.gameBundleSha256 -cne (Get-LowerSha256Bytes ([IO.File]::ReadAllBytes($GameBundlePath)))) { throw 'Editor acceptance evidence gameBundleSha256 does not match the current GameBundle.' }
    if ([string]$evidence.assetManifestSha256 -cne [string]$AssetPolicy.manifestSha256) { throw 'Editor acceptance evidence assetManifestSha256 does not match the current asset manifest.' }
    return $evidence
}

function Read-RuntimeAssetPolicy([string]$Root, [string]$RequestedPath, [int]$BundleAssetCount) {
    $candidate = if ([string]::IsNullOrWhiteSpace($RequestedPath)) {
        Join-Path $Root $defaultAssetManifestRelativePath.Replace('/', [IO.Path]::DirectorySeparatorChar)
    } else {
        if ([IO.Path]::IsPathRooted($RequestedPath)) { $RequestedPath } else { Join-Path $Root $RequestedPath }
    }

    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        if ($BundleAssetCount -gt 0) {
            throw "GameBundle assets require a project asset manifest with policy.runtimeRoots: $candidate"
        }
        return [PSCustomObject]@{ manifestPath = $null; runtimeRoots = @(); approvedStatuses = @(); assetsById = @{} }
    }

    $manifestPath = Resolve-ExistingPath $candidate 'Project asset manifest' 'Leaf'
    if (-not (Test-IsInside $manifestPath $Root)) {
        throw "Project asset manifest must stay inside AssetRoot: $manifestPath"
    }
    $manifestItem = Get-Item -LiteralPath $manifestPath -Force
    if ($manifestItem.Length -le 0 -or $manifestItem.Length -gt 8MB) { throw 'Project asset manifest has an invalid size.' }
    Assert-NoPackagedSecret $manifestItem 'Project asset manifest'
    $manifestBytes = [IO.File]::ReadAllBytes($manifestPath)
    $manifestSha256 = Get-LowerSha256Bytes $manifestBytes
    $manifest = [Text.UTF8Encoding]::new($false, $true).GetString($manifestBytes) | ConvertFrom-Json
    if (-not (Test-IsJsonObject $manifest) -or
        -not (Test-HasProperty $manifest 'schemaVersion') -or
        $manifest.schemaVersion -ne 1 -or
        -not (Test-HasProperty $manifest 'assets') -or
        $manifest.assets -isnot [Array] -or
        -not (Test-HasProperty $manifest 'policy') -or
        -not (Test-IsJsonObject $manifest.policy) -or
        -not (Test-HasProperty $manifest.policy 'runtimeRoots') -or
        $manifest.policy.runtimeRoots -isnot [Array] -or
        -not (Test-HasProperty $manifest.policy 'approvedStatuses') -or
        $manifest.policy.approvedStatuses -isnot [Array]) {
        throw 'Project asset manifest must be schemaVersion 1 with assets[], policy.runtimeRoots[], and policy.approvedStatuses[].'
    }
    if ($manifest.assets.Count -gt 10000) { throw 'Project asset manifest exceeds the 10000-entry package limit.' }
    if ($manifest.policy.runtimeRoots.Count -gt 64) { throw 'Project asset manifest exceeds the 64-root policy limit.' }

    $approvedStatuses = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($statusValue in @($manifest.policy.approvedStatuses)) {
        if (-not ($statusValue -is [string]) -or $statusValue -notin @('approved', 'frozen') -or -not $approvedStatuses.Add($statusValue)) {
            throw 'Project approvedStatuses must contain unique approved/frozen state names.'
        }
    }
    if ($BundleAssetCount -gt 0 -and $approvedStatuses.Count -eq 0) {
        throw 'GameBundle contains assets but the project policy has no approvedStatuses.'
    }

    $runtimeRoots = [Collections.Generic.List[string]]::new()
    $rootSet = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($rootValue in @($manifest.policy.runtimeRoots)) {
        if (-not ($rootValue -is [string])) { throw 'Project runtimeRoots entries must be strings.' }
        $runtimeRoot = Convert-ToSafeRelativePath $rootValue 'Project runtime root'
        if ($runtimeRoot.Length -gt 256 -or
            -not ($runtimeRoot -ceq 'assets' -or $runtimeRoot.StartsWith('assets/', [StringComparison]::Ordinal))) {
            throw "Project runtime root must be canonical and stay below assets/: $runtimeRoot"
        }
        if (-not $rootSet.Add($runtimeRoot)) { throw "Project runtimeRoots contains a case-insensitive duplicate: $runtimeRoot" }
        $runtimeRoots.Add($runtimeRoot)
    }
    if ($BundleAssetCount -gt 0 -and $runtimeRoots.Count -eq 0) {
        throw 'GameBundle contains assets but the project asset manifest has no runtimeRoots.'
    }
    for ($left = 0; $left -lt $runtimeRoots.Count; $left++) {
        for ($right = $left + 1; $right -lt $runtimeRoots.Count; $right++) {
            $a = $runtimeRoots[$left]
            $b = $runtimeRoots[$right]
            if ($a.StartsWith("$b/", [StringComparison]::OrdinalIgnoreCase) -or
                $b.StartsWith("$a/", [StringComparison]::OrdinalIgnoreCase)) {
                throw "Project runtimeRoots must not overlap: $a and $b"
            }
        }
    }

    $manifestAssetsById = @{}
    foreach ($manifestAsset in @($manifest.assets)) {
        if (-not (Test-IsJsonObject $manifestAsset) -or
            -not (Test-HasProperty $manifestAsset 'id') -or
            -not ($manifestAsset.id -is [string]) -or
            $manifestAsset.id -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$' -or
            $manifestAssetsById.ContainsKey($manifestAsset.id)) {
            throw 'Project asset manifest contains an invalid or duplicate asset id.'
        }
        $manifestAssetsById[$manifestAsset.id] = $manifestAsset
    }
    return [PSCustomObject]@{
        manifestPath = $manifestPath
        manifestSha256 = $manifestSha256
        runtimeRoots = @($runtimeRoots.ToArray())
        approvedStatuses = @($approvedStatuses | Sort-Object)
        assetsById = $manifestAssetsById
    }
}

function Assert-AndroidWebRuntimeContract([string]$WebDist) {
    $contractPath = Join-Path $WebDist $runtimeContractRelativePath.Replace('/', [IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path -LiteralPath $contractPath -PathType Leaf)) {
        throw "Web dist is not the dedicated Android runtime: missing $runtimeContractRelativePath. Build src/platform/android/web/vite.config.ts first."
    }
    $contractItem = Get-Item -LiteralPath $contractPath -Force
    if ($contractItem.Length -le 0 -or $contractItem.Length -gt 16KB) { throw 'Android web runtime contract has an invalid size.' }
    $contract = [IO.File]::ReadAllText($contractPath, [Text.UTF8Encoding]::new($false, $true)) | ConvertFrom-Json
    $expectedKeys = @('schemaVersion', 'runtimeId', 'entryDocument', 'gameBundlePath', 'viteBase', 'assetBaseUrl', 'assetPathMode')
    foreach ($key in $expectedKeys) {
        if (-not (Test-HasProperty $contract $key)) { throw "Android web runtime contract is missing $key." }
    }
    $unexpectedKeys = @($contract.PSObject.Properties.Name | Where-Object { $_ -notin $expectedKeys })
    if ($unexpectedKeys.Count -gt 0) { throw "Android web runtime contract contains unexpected fields: $($unexpectedKeys -join ', ')." }
    if ($contract.schemaVersion -ne 1 -or
        $contract.runtimeId -cne $runtimeContractId -or
        $contract.entryDocument -cne 'index.html' -or
        $contract.gameBundlePath -cne 'data/game-bundle.v1.json' -or
        $contract.viteBase -cne './' -or
        $contract.assetBaseUrl -cne $androidAssetBaseUrl -or
        $contract.assetPathMode -cne 'game-bundle-project-relative') {
        throw 'Android web runtime contract does not match the offline GameBundle v1 package layout.'
    }
}

function Assert-RelativeWebEntrypoint([string]$WebDist) {
    $indexPath = Join-Path $WebDist 'index.html'
    $indexItem = Get-Item -LiteralPath $indexPath -Force
    if ($indexItem.Length -le 0 -or $indexItem.Length -gt 2MB) { throw 'Web dist index.html has an invalid size.' }
    $html = [IO.File]::ReadAllText($indexPath, [Text.UTF8Encoding]::new($false, $true))
    if ($html -notmatch 'data-rpg-runtime') {
        throw 'Web dist index.html is not the dedicated Android Phaser entry document.'
    }
    if ($html -match '(?is)<base\b') { throw 'Web dist index.html must not declare a base URL.' }

    $references = [Text.RegularExpressions.Regex]::Matches($html, '(?is)\b(?:src|href)\s*=\s*["'']([^"'']+)["'']')
    foreach ($match in $references) {
        $reference = [string]$match.Groups[1].Value
        if ([string]::IsNullOrWhiteSpace($reference) -or
            $reference.Contains('\') -or
            $reference.Contains('?') -or
            $reference.Contains('#') -or
            $reference.StartsWith('/') -or
            $reference.StartsWith('//') -or
            $reference -match '^[A-Za-z][A-Za-z0-9+.-]*:') {
            throw "Web dist index.html contains a non-relative or ambiguous resource reference: $reference"
        }
        $relative = if ($reference.StartsWith('./', [StringComparison]::Ordinal)) { $reference.Substring(2) } else { $reference }
        $relative = Assert-AllowlistedPackagePath $relative 'Web entrypoint reference'
        $dependency = [IO.Path]::GetFullPath((Join-Path $WebDist $relative.Replace('/', [IO.Path]::DirectorySeparatorChar)))
        if (-not (Test-IsInside $dependency $WebDist) -or -not (Test-Path -LiteralPath $dependency -PathType Leaf)) {
            throw "Web dist index.html references a missing package file: $reference"
        }
    }
}

$bundleFile = Resolve-ExistingPath $GameBundlePath 'GameBundle' 'Leaf'
$assetRootPath = Resolve-ExistingPath $AssetRoot 'Asset root' 'Container'
$gameReleasePath = Join-Path $assetRootPath 'release-input\game-release.v1.json'
$gameRelease = $null
if (Test-Path -LiteralPath $gameReleasePath -PathType Leaf) {
    try { $gameRelease = [IO.File]::ReadAllText($gameReleasePath) | ConvertFrom-Json } catch { throw "Game release descriptor is invalid JSON: $($_.Exception.Message)" }
}
if ($RequireAcceptedHumanReview -and ($null -eq $gameRelease -or $gameRelease.schemaVersion -ne 1 -or [string]$gameRelease.status -cne 'locked' -or [string]$gameRelease.version -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$')) {
    throw 'Strict Android staging requires a locked game-release.v1.json descriptor.'
}
$webDist = Resolve-ExistingPath $WebDistPath 'Web dist' 'Container'
if (-not (Test-Path -LiteralPath (Join-Path $webDist 'index.html') -PathType Leaf)) { throw 'Web dist must contain index.html.' }
Assert-AndroidWebRuntimeContract $webDist
Assert-RelativeWebEntrypoint $webDist

$target = [IO.Path]::GetFullPath($OutputPath).TrimEnd('\', '/')
if ([string]::IsNullOrWhiteSpace($target) -or $target -eq [IO.Path]::GetPathRoot($target) -or $target.Equals($repoRoot, [StringComparison]::OrdinalIgnoreCase) -or (Test-IsInside $repoRoot $target)) {
    throw "Output path is too broad or contains the repository: $target"
}
if ($target.Equals($assetRootPath, [StringComparison]::OrdinalIgnoreCase) -or
    (Test-IsInside $assetRootPath $target) -or
    (Test-IsInside $target $assetRootPath) -or
    (Test-IsInside $bundleFile $target) -or
    (Test-IsInside $target $webDist) -or
    (Test-IsInside $webDist $target) -or
    (Test-IsInside $target $templateRoot) -or
    (Test-IsInside $templateRoot $target)) {
    throw 'Output path must not overlap an input or template tree.'
}
$marker = Join-Path $target '.rpgcreator-android-scaffold'
if (Test-Path -LiteralPath $target) {
    if (-not $Force) { throw "Output already exists. Pass -Force only for a previously staged scaffold: $target" }
    if (-not (Test-Path -LiteralPath $marker -PathType Leaf)) { throw "Refusing to replace an unmarked directory: $target" }
    [void](Assert-NoReparseTraversal $target 'Existing output')
    [void](Assert-NoReparseTraversal $marker 'Existing output marker')
    if ((Get-Content -LiteralPath $marker -Raw -Encoding UTF8).Trim() -cne $markerContent) { throw "Refusing to replace output with an invalid marker: $target" }
}

$bundleItem = Get-Item -LiteralPath $bundleFile -Force
if ($bundleItem.Length -le 0 -or $bundleItem.Length -gt $maxBundleBytes) { throw "GameBundle must contain between 1 and $maxBundleBytes bytes." }
Assert-NoPackagedSecret $bundleItem 'GameBundle'
$bundleBytes = [IO.File]::ReadAllBytes($bundleFile)
$sourceGameBundleSha256 = Get-LowerSha256Bytes $bundleBytes
$bundleJson = [Text.UTF8Encoding]::new($false, $true).GetString($bundleBytes)
$bundle = $bundleJson | ConvertFrom-Json
if (-not (Test-IsJsonObject $bundle) -or
    -not (Test-HasProperty $bundle 'schemaVersion') -or
    $bundle.schemaVersion -ne 1 -or
    -not (Test-HasProperty $bundle 'project') -or
    -not (Test-IsJsonObject $bundle.project) -or
    -not (Test-HasProperty $bundle 'maps') -or
    -not (Test-IsJsonObject $bundle.maps) -or
    -not (Test-HasProperty $bundle 'items') -or
    -not (Test-IsJsonObject $bundle.items) -or
    -not (Test-HasProperty $bundle 'databases') -or
    -not (Test-IsJsonObject $bundle.databases)) {
    throw 'Input must be a compiled GameBundle v1 with project, maps, items, and databases.'
}
if (-not (Test-HasProperty $bundle.project 'startMapId') -or
    -not ($bundle.project.startMapId -is [string]) -or
    [string]::IsNullOrWhiteSpace($bundle.project.startMapId) -or
    -not (Test-HasProperty $bundle.maps $bundle.project.startMapId)) {
    throw 'GameBundle project.startMapId must identify a packaged map.'
}

$assets = @()
if (Test-HasProperty $bundle 'assets') {
    if (-not (Test-IsJsonObject $bundle.assets) -or
        -not (Test-HasProperty $bundle.assets 'schemaVersion') -or
        -not (Test-HasProperty $bundle.assets 'assets') -or
        $bundle.assets.assets -isnot [Array]) {
        throw 'GameBundle assets must be an AssetCatalogData object with an assets array.'
    }
    $assets = @($bundle.assets.assets)
}
if ($assets.Count -gt 10000) { throw 'GameBundle exceeds the 10000-asset Android package limit.' }
$runtimePolicy = Read-RuntimeAssetPolicy $assetRootPath $AssetManifestPath $assets.Count
$reservedPackagePaths = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
[void]$reservedPackagePaths.Add('data/game-bundle.v1.json')
[void]$reservedPackagePaths.Add('data/package-allowlist.json')
if ($RequireAcceptedHumanReview) { [void]$reservedPackagePaths.Add('data/game-release.v1.json') }
if ([string]::IsNullOrWhiteSpace($EditorAcceptanceEvidencePath)) {
    $EditorAcceptanceEvidencePath = Join-Path $assetRootPath 'release-input\editor-acceptance-evidence.v1.json'
}
$resolvedAcceptanceEvidence = $null
if ($RequireAcceptedHumanReview) {
    $resolvedAcceptanceEvidence = Resolve-ExistingPath $EditorAcceptanceEvidencePath 'Editor acceptance evidence' 'Leaf'
    [void]$reservedPackagePaths.Add('data/editor-acceptance-evidence.v1.json')
}
$assetIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$assetPaths = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$assetCopyPlan = [Collections.Generic.List[object]]::new()
foreach ($asset in $assets) {
    if (-not (Test-IsJsonObject $asset) -or
        -not (Test-HasProperty $asset 'id') -or
        -not ($asset.id -is [string]) -or
        $asset.id -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$' -or
        -not $assetIds.Add($asset.id)) {
        throw 'GameBundle contains an asset with an invalid or duplicate portable id.'
    }
    if (-not (Test-HasProperty $asset 'path') -or
        -not (Test-HasProperty $asset 'kind') -or
        -not (Test-HasProperty $asset 'source') -or
        -not (Test-HasProperty $asset 'runtimeCompatible') -or
        @('image', 'spritesheet', 'tileset', 'audio', 'generated') -notcontains [string]$asset.kind -or
        $asset.runtimeCompatible -ne $true -or
        @('local', 'imported', 'generated') -notcontains [string]$asset.source) {
        throw "GameBundle asset is not explicitly runtime-compatible or has an invalid source: $($asset.id)"
    }
    $relative = Assert-AllowlistedPackagePath ([string]$asset.path) "Asset $($asset.id) path"
    if (-not $relative.StartsWith('assets/', [StringComparison]::OrdinalIgnoreCase)) {
        throw "Game asset must stay below the canonical assets/ root: $relative"
    }
    if ($allowedRuntimeAssetExtensions -notcontains [IO.Path]::GetExtension($relative).ToLowerInvariant()) {
        throw "Game asset uses an unsafe runtime extension: $relative"
    }
    if ($reservedPackagePaths.Contains($relative)) { throw "Game asset uses an Android-owned package path: $relative" }
    if (-not $assetPaths.Add($relative)) { throw "GameBundle contains a duplicate case-insensitive asset path: $relative" }
    $matchingRuntimeRoots = @($runtimePolicy.runtimeRoots | Where-Object {
        $runtimeRoot = [string]$_
        $relative.StartsWith("$runtimeRoot/", [StringComparison]::OrdinalIgnoreCase)
    })
    if ($matchingRuntimeRoots.Count -ne 1) {
        throw "Game asset path must belong to exactly one approved policy.runtimeRoots entry: $relative"
    }
    if (-not $runtimePolicy.assetsById.ContainsKey($asset.id)) {
        throw "GameBundle asset is absent from the project asset manifest: $($asset.id)"
    }
    $manifestAsset = $runtimePolicy.assetsById[$asset.id]
    foreach ($field in @('path', 'kind', 'source', 'status', 'releaseEligible', 'runtimeCompatible', 'sizeBytes', 'sha256')) {
        if (-not (Test-HasProperty $manifestAsset $field)) {
            throw "Project asset manifest entry $($asset.id) is missing $field."
        }
    }
    if ([string]$manifestAsset.path -cne $relative -or
        [string]$manifestAsset.kind -cne [string]$asset.kind -or
        [string]$manifestAsset.source -cne [string]$asset.source -or
        [string]$manifestAsset.status -notin $runtimePolicy.approvedStatuses -or
        $manifestAsset.releaseEligible -ne $true -or
        $manifestAsset.runtimeCompatible -ne $true -or
        ($manifestAsset.sizeBytes -isnot [int] -and $manifestAsset.sizeBytes -isnot [long]) -or
        [long]$manifestAsset.sizeBytes -le 0 -or
        [string]$manifestAsset.sha256 -cnotmatch '^[a-f0-9]{64}$') {
        throw "Project asset manifest entry does not match the compiled GameBundle asset: $($asset.id)"
    }
    $source = [IO.Path]::GetFullPath((Join-Path $assetRootPath $relative))
    if (-not (Test-IsInside $source $assetRootPath) -or -not (Test-Path -LiteralPath $source -PathType Leaf)) {
        throw "Asset is missing or escapes AssetRoot: $relative"
    }
    [void](Assert-NoReparseTraversal $source "Asset $($asset.id)")
    $sourceItem = Get-Item -LiteralPath $source -Force
    if ($sourceItem.Length -le 0 -or $sourceItem.Length -gt $maxPackageBytes) {
        throw "Asset has an invalid packaged size: $($asset.id)"
    }
    Assert-NoPackagedSecret $sourceItem "Asset $($asset.id)"
    $sourceSha256 = (Get-FileHash -LiteralPath $sourceItem.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    if ([long]$sourceItem.Length -ne [long]$manifestAsset.sizeBytes -or $sourceSha256 -cne [string]$manifestAsset.sha256) {
        throw "Asset bytes do not match the approved project manifest record: $($asset.id)"
    }
    $assetCopyPlan.Add([PSCustomObject]@{
        id = [string]$asset.id
        relative = $relative
        source = $sourceItem.FullName
        sizeBytes = [long]$sourceItem.Length
        sha256 = $sourceSha256
    })
}

$validatedAcceptanceEvidence = $null
if ($RequireAcceptedHumanReview) {
    $validatedAcceptanceEvidence = Assert-G4AcceptanceEvidence -EvidencePath $resolvedAcceptanceEvidence -BundleAssets @($assets) -AssetPolicy $runtimePolicy -AssetRootPath $assetRootPath -GameBundlePath $bundleFile
}

$finalTarget = $target
$finalMarker = $marker
$hadExistingOutput = Test-Path -LiteralPath $finalTarget
$targetParent = Split-Path -Parent $finalTarget
$targetLeaf = Split-Path -Leaf $finalTarget
if ([string]::IsNullOrWhiteSpace($targetLeaf)) { throw 'Output path must have a non-empty leaf directory.' }
[IO.Directory]::CreateDirectory($targetParent) | Out-Null
$transactionId = [Guid]::NewGuid().ToString('N')
$stagingTarget = Join-Path $targetParent ".$targetLeaf.staging-$transactionId"
$backupTarget = Join-Path $targetParent ".$targetLeaf.backup-$transactionId"
foreach ($transactionPath in @($stagingTarget, $backupTarget)) {
    if (Test-Path -LiteralPath $transactionPath) { throw "Refusing to reuse a staging/backup path: $transactionPath" }
}
$target = $stagingTarget
$marker = Join-Path $target '.rpgcreator-android-scaffold'
$backupMoved = $false
$swapCompleted = $false

try {
    New-Item -ItemType Directory -Path $target | Out-Null
    [void](Assert-NoReparseTraversal $target 'New staging output')
    Copy-SafeTree $templateRoot $target 'Native Android template'
    Write-Utf8NoBom $marker $markerContent

    $www = Join-Path $target 'app\src\main\assets\www'
    New-Item -ItemType Directory -Path $www | Out-Null
    [void](Assert-NoReparseTraversal $www 'Web asset destination')
    Copy-SafeTree $webDist $www 'Web runtime distribution' -RuntimeWebFiles
    foreach ($reserved in $reservedPackagePaths) {
        if (Test-Path -LiteralPath (Join-Path $www $reserved)) {
            throw "Web dist collides with an Android-owned package file: $reserved"
        }
    }

    foreach ($assetPlanEntry in $assetCopyPlan) {
        $destination = Join-Path $www $assetPlanEntry.relative
        if (Test-Path -LiteralPath $destination) { throw "Web/game asset collision: $($assetPlanEntry.relative)" }
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        [void](Assert-NoReparseTraversal (Split-Path -Parent $destination) "Asset $($assetPlanEntry.id) destination")
        Copy-Item -LiteralPath $assetPlanEntry.source -Destination $destination
        $destinationItem = Get-Item -LiteralPath $destination -Force
        $destinationSha256 = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
        if ([long]$destinationItem.Length -ne [long]$assetPlanEntry.sizeBytes -or $destinationSha256 -cne [string]$assetPlanEntry.sha256) {
            throw "Packaged asset copy does not match its approved bytes: $($assetPlanEntry.id)"
        }
    }

    $dataDirectory = Join-Path $www 'data'
    New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
    $stagedBundlePath = Join-Path $dataDirectory 'game-bundle.v1.json'
    [IO.File]::WriteAllBytes($stagedBundlePath, $bundleBytes)
    $stagedGameBundleSha256 = (Get-FileHash -LiteralPath $stagedBundlePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($stagedGameBundleSha256 -cne $sourceGameBundleSha256) { throw 'Staged GameBundle bytes do not match the validated source bytes.' }

    if ($RequireAcceptedHumanReview) {
        $stagedGameReleasePath = Join-Path $dataDirectory 'game-release.v1.json'
        Copy-Item -LiteralPath $gameReleasePath -Destination $stagedGameReleasePath
        if ((Get-FileHash -LiteralPath $stagedGameReleasePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne (Get-FileHash -LiteralPath $gameReleasePath -Algorithm SHA256).Hash.ToLowerInvariant()) {
            throw 'Staged game release descriptor does not match the canonical source bytes.'
        }
    }

    if ($RequireAcceptedHumanReview) {
        $stagedAcceptancePath = Join-Path $dataDirectory 'editor-acceptance-evidence.v1.json'
        Copy-Item -LiteralPath $resolvedAcceptanceEvidence -Destination $stagedAcceptancePath
        $stagedAcceptanceSha256 = (Get-FileHash -LiteralPath $stagedAcceptancePath -Algorithm SHA256).Hash.ToLowerInvariant()
        $sourceAcceptanceSha256 = (Get-FileHash -LiteralPath $resolvedAcceptanceEvidence -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($stagedAcceptanceSha256 -cne $sourceAcceptanceSha256) { throw 'Staged editor acceptance evidence does not match the validated source bytes.' }
    }

    $packageAllowlistPath = Join-Path $dataDirectory 'package-allowlist.json'
    $packagePaths = @(Get-SafeTreeFiles $www 'Packaged WebView assets' | ForEach-Object {
        $relative = (Get-RelativePathCompat $www $_.FullName).Replace('\', '/')
        Assert-AllowlistedPackagePath $relative 'Packaged file'
    } | Sort-Object)
    $packagePathSet = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($packagePath in $packagePaths) {
        if (-not $packagePathSet.Add($packagePath)) { throw "Offline package contains a duplicate path: $packagePath" }
    }
    if (-not $packagePathSet.Contains('index.html') -or -not $packagePathSet.Contains('data/game-bundle.v1.json')) {
        throw 'Offline package is missing its entry document or GameBundle.'
    }
    $packageAllowlistJson = [ordered]@{
        schemaVersion = 1
        assetBaseUrl = $androidAssetBaseUrl
        runtimeRoots = @($runtimePolicy.runtimeRoots)
        approvedStatuses = @($runtimePolicy.approvedStatuses)
        paths = $packagePaths
    } | ConvertTo-Json -Depth 4
    Write-Utf8NoBom $packageAllowlistPath $packageAllowlistJson

    $finalFiles = @(Get-SafeTreeFiles $target 'Final Android source package' | Where-Object {
        $relative = (Get-RelativePathCompat $target $_.FullName).Replace('\', '/')
        -not (Test-IsGeneratedAndroidOutput $relative)
    } | Sort-Object -Property FullName)
    if (($finalFiles.Count + 1) -gt $maxPackageFiles) { throw "Final Android source package exceeds $maxPackageFiles files." }
    $finalBytes = [long](($finalFiles | Measure-Object -Property Length -Sum).Sum)
    $inventoryFiles = @($finalFiles | ForEach-Object {
        Assert-NoPackagedSecret $_ 'Final Android source package'
        [PSCustomObject]@{
            path = (Get-RelativePathCompat $target $_.FullName).Replace('\', '/')
            bytes = $_.Length
            sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    })
    $inventoryDocument = [ordered]@{
        schemaVersion = 1
        target = 'android-webview-source'
        assetBaseUrl = $androidAssetBaseUrl
        runtimeRoots = @($runtimePolicy.runtimeRoots)
        approvedStatuses = @($runtimePolicy.approvedStatuses)
        assetManifestPath = if ($runtimePolicy.manifestPath) { (Get-RelativePathCompat $assetRootPath $runtimePolicy.manifestPath).Replace('\', '/') } else { $null }
        assetManifestSha256 = if ($runtimePolicy.manifestPath) { $runtimePolicy.manifestSha256 } else { $null }
        sourceGameBundleSha256 = $sourceGameBundleSha256
        stagedGameBundleSha256 = $stagedGameBundleSha256
        gameRelease = if ($RequireAcceptedHumanReview) {
            [ordered]@{
                path = 'app/src/main/assets/www/data/game-release.v1.json'
                sha256 = (Get-FileHash -LiteralPath (Join-Path $dataDirectory 'game-release.v1.json') -Algorithm SHA256).Hash.ToLowerInvariant()
            }
        } else { $null }
        editorAcceptanceEvidence = if ($RequireAcceptedHumanReview) {
            [ordered]@{
                path = 'app/src/main/assets/www/data/editor-acceptance-evidence.v1.json'
                sha256 = (Get-FileHash -LiteralPath (Join-Path $dataDirectory 'editor-acceptance-evidence.v1.json') -Algorithm SHA256).Hash.ToLowerInvariant()
            }
        } else { $null }
        packageAllowlistPath = 'app/src/main/assets/www/data/package-allowlist.json'
        packagedAssetIds = @($assetCopyPlan | ForEach-Object { $_.id } | Sort-Object)
        inventorySelfExcluded = $true
        files = $inventoryFiles
    }
    $inventoryJson = $inventoryDocument | ConvertTo-Json -Depth 8
    $inventoryBytes = [Text.Encoding]::UTF8.GetByteCount($inventoryJson + [Environment]::NewLine)
    if (($finalBytes + $inventoryBytes) -gt $maxPackageBytes) { throw "Final Android source package exceeds $maxPackageBytes bytes." }
    Write-Utf8NoBom (Join-Path $target 'package-files.sha256.json') $inventoryJson

    # Recheck the final path immediately before the same-volume swap. A caller
    # may replace the marked output while the new package is being prepared.
    if ($hadExistingOutput) {
        if (-not (Test-Path -LiteralPath $finalTarget -PathType Container) -or
            -not (Test-Path -LiteralPath $finalMarker -PathType Leaf)) {
            throw 'Existing Android output changed while the replacement was being prepared.'
        }
        [void](Assert-NoReparseTraversal $finalTarget 'Existing output before swap')
        [void](Assert-NoReparseTraversal $finalMarker 'Existing output marker before swap')
        if ((Get-Content -LiteralPath $finalMarker -Raw -Encoding UTF8).Trim() -cne $markerContent) {
            throw 'Existing Android output marker changed while the replacement was being prepared.'
        }
        Move-Item -LiteralPath $finalTarget -Destination $backupTarget -ErrorAction Stop
        $backupMoved = $true
    } elseif (Test-Path -LiteralPath $finalTarget) {
        throw 'An Android output appeared while the new package was being prepared.'
    }
    Move-Item -LiteralPath $target -Destination $finalTarget -ErrorAction Stop
    $swapCompleted = $true
    $target = $finalTarget
    $marker = $finalMarker
    if (-not (Test-Path -LiteralPath $marker -PathType Leaf) -or
        (Get-Content -LiteralPath $marker -Raw -Encoding UTF8).Trim() -cne $markerContent -or
        -not (Test-Path -LiteralPath (Join-Path $target 'package-files.sha256.json') -PathType Leaf)) {
        throw 'Final Android output failed post-swap marker/inventory verification.'
    }
} catch {
    if ($swapCompleted -and (Test-Path -LiteralPath $finalTarget -PathType Container)) {
        try {
            Move-Item -LiteralPath $finalTarget -Destination $stagingTarget -ErrorAction Stop
            $swapCompleted = $false
        } catch {
            $_.Exception.Data['RPGCreatorAI.RollbackError'] = $_.Exception.Message
        }
    }
    if ($backupMoved -and -not (Test-Path -LiteralPath $finalTarget) -and (Test-Path -LiteralPath $backupTarget -PathType Container)) {
        try {
            Move-Item -LiteralPath $backupTarget -Destination $finalTarget -ErrorAction Stop
            $backupMoved = $false
        } catch {
            # Keep the backup in place and surface its exact path. Silently
            # clearing the flag could leave the original output inaccessible.
            $_.Exception.Data['RPGCreatorAI.RollbackBackup'] = $backupTarget
            $_.Exception.Data['RPGCreatorAI.RollbackError'] = $_.Exception.Message
        }
    }
    if (Test-Path -LiteralPath $stagingTarget) {
        [void](Assert-NoReparseTraversal $stagingTarget 'Failed staging cleanup')
        Remove-Item -LiteralPath $stagingTarget -Recurse -Force
    }
    throw
}

if ($backupMoved -and (Test-Path -LiteralPath $backupTarget)) {
    try {
        [void](Assert-NoReparseTraversal $backupTarget 'Committed backup cleanup')
        Remove-Item -LiteralPath $backupTarget -Recurse -Force
    } catch {
        Write-Warning "Android replacement committed, but the previous scaffold backup was retained at \${backupTarget}: $($_.Exception.Message)"
    }
}

Write-Host "Android WebView scaffold staged at: $target"
Write-Host 'No SDK, Gradle, APK build, signing, emulator, or device command was executed.'
