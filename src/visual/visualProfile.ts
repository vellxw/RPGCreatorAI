import type { ProjectData } from '../types/project';

export type AspectRatioPreset = '16:9' | '4:3' | '1:1' | 'custom';
export type CameraMode = 'follow-player' | 'fixed-room';
export type MapPresentation = 'full-scene' | 'compact-room';

export interface BaseResolution {
  width: number;
  height: number;
}

export interface VisualProfile {
  aspectRatio: AspectRatioPreset;
  baseResolution: BaseResolution;
  tileSize: number;
  cameraMode: CameraMode;
  mapPresentation: MapPresentation;
  zoom: number;
  integerScale: boolean;
}

export type VisualProfileInput = Partial<Omit<VisualProfile, 'baseResolution'>> & {
  baseResolution?: Partial<BaseResolution>;
};

export const DEFAULT_VISUAL_PROFILE: VisualProfile = {
  aspectRatio: '16:9',
  baseResolution: { width: 1280, height: 720 },
  tileSize: 32,
  cameraMode: 'follow-player',
  mapPresentation: 'full-scene',
  zoom: 1,
  integerScale: true,
};

const VALID_ASPECTS = new Set<AspectRatioPreset>(['16:9', '4:3', '1:1', 'custom']);
const VALID_CAMERA_MODES = new Set<CameraMode>(['follow-player', 'fixed-room']);
const VALID_PRESENTATIONS = new Set<MapPresentation>(['full-scene', 'compact-room']);

function positiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function positiveInteger(value: unknown, fallback: number): number {
  return Number.isInteger(value) && (value as number) > 0 ? (value as number) : fallback;
}

export function normalizeVisualProfile(input: VisualProfileInput | null | undefined): VisualProfile {
  const candidate = input ?? {};
  const aspectRatio =
    candidate.aspectRatio && VALID_ASPECTS.has(candidate.aspectRatio)
      ? candidate.aspectRatio
      : DEFAULT_VISUAL_PROFILE.aspectRatio;
  const cameraMode =
    candidate.cameraMode && VALID_CAMERA_MODES.has(candidate.cameraMode)
      ? candidate.cameraMode
      : DEFAULT_VISUAL_PROFILE.cameraMode;
  const mapPresentation =
    candidate.mapPresentation && VALID_PRESENTATIONS.has(candidate.mapPresentation)
      ? candidate.mapPresentation
      : DEFAULT_VISUAL_PROFILE.mapPresentation;

  return {
    aspectRatio,
    baseResolution: {
      width: positiveInteger(
        candidate.baseResolution?.width,
        DEFAULT_VISUAL_PROFILE.baseResolution.width,
      ),
      height: positiveInteger(
        candidate.baseResolution?.height,
        DEFAULT_VISUAL_PROFILE.baseResolution.height,
      ),
    },
    tileSize: positiveInteger(candidate.tileSize, DEFAULT_VISUAL_PROFILE.tileSize),
    cameraMode,
    mapPresentation,
    zoom: positiveNumber(candidate.zoom, DEFAULT_VISUAL_PROFILE.zoom),
    integerScale:
      typeof candidate.integerScale === 'boolean'
        ? candidate.integerScale
        : DEFAULT_VISUAL_PROFILE.integerScale,
  };
}

export function withNormalizedVisualProfile(project: ProjectData): ProjectData {
  return {
    ...project,
    visualProfile: normalizeVisualProfile(project.visualProfile),
  };
}
