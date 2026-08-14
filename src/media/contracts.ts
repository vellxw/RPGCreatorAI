export const MEDIA_CATALOG_SCHEMA_VERSION = 1 as const;
export const OFFLINE_MEDIA_MANIFEST_SCHEMA_VERSION = 1 as const;

export type MediaAssetKind = 'audio' | 'voice' | 'video' | 'subtitle';

interface MediaAssetBaseV1 {
  /** Stable public key. Runtime and authored content refer to this value, never to a filename. */
  id: string;
  label?: string;
  kind: MediaAssetKind;
  /** Portable project-relative path. It is normalized when an offline manifest is compiled. */
  path: string;
  /** Canonical MIME type without parameters. */
  mimeType: string;
  /** Exact source file size, in bytes. */
  byteSize: number;
  /** Optional integrity metadata. When present it must be a SHA-256 hex digest. */
  sha256?: string;
}

export interface AudioMediaAssetV1 extends MediaAssetBaseV1 {
  kind: 'audio';
  durationMs: number;
}

export interface VoiceMediaAssetV1 extends MediaAssetBaseV1 {
  kind: 'voice';
  durationMs: number;
  locale: string;
  speakerId?: string;
}

export interface VideoMediaAssetV1 extends MediaAssetBaseV1 {
  kind: 'video';
  durationMs: number;
  width: number;
  height: number;
}

export interface SubtitleMediaAssetV1 extends MediaAssetBaseV1 {
  kind: 'subtitle';
  locale: string;
  /** Optional media timeline span covered by the subtitle file. */
  durationMs?: number;
}

export type MediaAssetV1 =
  | AudioMediaAssetV1
  | VoiceMediaAssetV1
  | VideoMediaAssetV1
  | SubtitleMediaAssetV1;

/**
 * Places a bounded section of one media asset on a cinematic timeline.
 * `endMs` is exclusive and all values are integer milliseconds.
 */
export interface CinematicTrackV1 {
  assetId: string;
  role: MediaAssetKind;
  startMs: number;
  endMs: number;
  sourceStartMs?: number;
  /** Valid only for audio and voice tracks. */
  volume?: number;
  /** Valid only for general audio tracks. */
  loop?: boolean;
  /** Valid only for subtitle tracks; at most one track may be default. */
  default?: boolean;
}

export interface CinematicV1 {
  id: string;
  label?: string;
  durationMs: number;
  skippable: boolean;
  tracks: CinematicTrackV1[];
}

/**
 * Explicit release boundary. Catalog entries may exist for authoring, but only
 * ids listed here may cross into an offline runtime package.
 */
export interface MediaOfflineAllowlistV1 {
  assetIds: string[];
  cinematicIds: string[];
}

export interface MediaCatalogV1 {
  schemaVersion: typeof MEDIA_CATALOG_SCHEMA_VERSION;
  assets: MediaAssetV1[];
  cinematics: CinematicV1[];
  offlineAllowlist: MediaOfflineAllowlistV1;
}

/** Filtered, normalized DTO suitable for a GameBundle or packaged runtime. */
export interface OfflineMediaManifestV1 {
  schemaVersion: typeof OFFLINE_MEDIA_MANIFEST_SCHEMA_VERSION;
  assets: MediaAssetV1[];
  cinematics: CinematicV1[];
  /** Sum of unique packaged paths, so aliases do not inflate the estimate. */
  totalBytes: number;
}
