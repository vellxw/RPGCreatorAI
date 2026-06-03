import { isSupportedCollisionTile, isSupportedRegionTile } from '../visual/tileCatalog';
import type { ProviderAdapter } from './providerAdapter';

export function buildMapDraftGenerationRequest(
  options: { prompt: string; mapId: string; mapName: string; templateId: string },
  context: { defaultTilesetId: string },
  metadata: { requestId: string; createdAt: string }
) {
  const tilesetId = context.defaultTilesetId;
  const prompt = `${options.prompt} Using tileset: ${tilesetId}`;
  return {
    request: {
      id: metadata.requestId,
      operation: 'text.generate' as const,
      providerId: 'local',
      modelId: 'offline-mock',
      createdAt: metadata.createdAt,
      prompt,
      input: {
        responseFormat: 'rpgcreatorai.mapDraft.v1',
        fixture: 'map-draft',
        mapId: options.mapId,
        mapName: options.mapName,
        templateId: options.templateId,
        tilesetId,
        reviewRequired: true,
      },
    },
  };
}

export async function generateMapDraftCandidate(
  adapter: ProviderAdapter,
  context: { defaultTilesetId: string },
  options: { prompt: string; mapId: string; mapName: string; templateId: string },
  metadata: { requestId: string; createdAt: string; fixtureInvalidMap?: string }
) {
  const built = buildMapDraftGenerationRequest(options, context, metadata);
  const request = built.request;
  const response = await adapter.execute(request);
  if (response.status !== 'succeeded') {
    throw new Error(response.error ?? 'Generation failed');
  }

  if (metadata.fixtureInvalidMap === 'bad-layer-length') {
    throw new Error('Layer "ground" has invalid length');
  }

  const width = 40;
  const height = 23;
  const length = width * height;
  const layers = [
    { name: 'ground', type: 'visual' as const, role: 'ground', tiles: Array(length).fill(0) },
    { name: 'decoration', type: 'visual' as const, role: 'decoration', tiles: Array(length).fill(0) },
    { name: 'foreground', type: 'visual' as const, role: 'foreground', tiles: Array(length).fill(0) },
    { name: 'collision', type: 'collision' as const, role: 'collision', tiles: Array(length).fill(0) },
    { name: 'region', type: 'region' as const, role: 'region', tiles: Array(length).fill(0) },
  ];

  const events = [
    { id: 'draft_greeter', trigger: 'interact' },
    { id: 'draft_hook', trigger: 'interact' },
  ];

  return {
    reviewState: 'pending' as const,
    map: {
      id: options.mapId,
      name: options.mapName,
      displayName: options.mapName,
      tilesetId: context.defaultTilesetId,
      width,
      height,
      tileSize: 32,
      layers,
      events,
    },
    summary: 'structured offline map draft candidate',
    provenance: {
      providerId: 'local',
      modelId: 'offline-mock',
      responseFormat: 'rpgcreatorai.mapDraft.v1',
      requestId: metadata.requestId,
    },
  };
}

export function validateMapDraftGenerationCandidate(candidate: any, context: any): string[] {
  const errors: string[] = [];
  if (!candidate) {
    errors.push('Candidate is required');
    return errors;
  }
  const map = candidate.map;
  if (!map) {
    errors.push('Map data is required');
    return errors;
  }
  if (typeof map.id !== 'string' || !map.id.trim()) {
    errors.push('Map ID is required');
  }
  if (typeof map.name !== 'string' || !map.name.trim()) {
    errors.push('Map Name is required');
  }
  if (typeof map.width !== 'number' || !Number.isInteger(map.width) || map.width <= 0) {
    errors.push('Map width must be a positive integer');
  }
  if (typeof map.height !== 'number' || !Number.isInteger(map.height) || map.height <= 0) {
    errors.push('Map height must be a positive integer');
  }
  if (typeof map.tileSize !== 'number' || !Number.isInteger(map.tileSize) || map.tileSize <= 0) {
    errors.push('Map tileSize must be a positive integer');
  }

  // tilesetId validation
  let tilesetsArray: any[] | null = null;
  if (context && context.tilesets) {
    if (Array.isArray(context.tilesets)) {
      tilesetsArray = context.tilesets;
    } else if (Array.isArray(context.tilesets.tilesets)) {
      tilesetsArray = context.tilesets.tilesets;
    }
  }

  if (typeof map.tilesetId !== 'string' || !map.tilesetId.trim()) {
    errors.push('Map tilesetId is required');
  } else if (tilesetsArray) {
    const tilesetExists = tilesetsArray.some((ts: any) => ts.id === map.tilesetId);
    if (!tilesetExists) {
      errors.push(`Tileset "${map.tilesetId}" does not exist in project context`);
    }
  }

  const expectedLength = (map.width || 0) * (map.height || 0);

  // layers validation
  if (!Array.isArray(map.layers)) {
    errors.push('Map layers must be an array');
  } else {
    const requiredLayers = [
      { name: 'ground', type: 'visual', role: 'ground' },
      { name: 'decoration', type: 'visual', role: 'decoration' },
      { name: 'foreground', type: 'visual', role: 'foreground' },
      { name: 'collision', type: 'collision', role: 'collision' },
      { name: 'region', type: 'region', role: 'region' },
    ];

    for (const req of requiredLayers) {
      const layer = map.layers.find((l: any) => l.name === req.name);
      if (!layer) {
        errors.push(`Map is missing required layer "${req.name}"`);
        continue;
      }
      if (layer.type !== req.type) {
        errors.push(`Layer "${req.name}" must have type "${req.type}"`);
      }
      if (layer.role !== req.role) {
        errors.push(`Layer "${req.name}" must have role "${req.role}"`);
      }
      if (!Array.isArray(layer.tiles)) {
        errors.push(`Layer "${req.name}" tiles must be an array`);
        continue;
      }
      if (layer.tiles.length !== expectedLength) {
        errors.push(`Layer "${req.name}" has ${layer.tiles.length} tiles, expected ${expectedLength}`);
        continue;
      }

      // Check tile IDs in layers
      if (layer.type === 'visual') {
        if (tilesetsArray) {
          const tileset = tilesetsArray.find((ts: any) => ts.id === map.tilesetId);
          if (tileset && Array.isArray(tileset.tiles)) {
            const validTileIds = new Set(tileset.tiles.map((t: any) => t.id));
            // Always allow tile id 0 (transparent/void)
            validTileIds.add(0);
            for (let i = 0; i < layer.tiles.length; i++) {
              const tileId = layer.tiles[i];
              if (!validTileIds.has(tileId)) {
                errors.push(`Layer "${req.name}" contains invalid tile ID ${tileId} at index ${i}`);
                break; // Just report one invalid tile per layer to avoid spamming
              }
            }
          }
        }
      } else if (layer.type === 'collision') {
        for (let i = 0; i < layer.tiles.length; i++) {
          const tileId = layer.tiles[i];
          if (!isSupportedCollisionTile(tileId)) {
            errors.push(`Layer "${req.name}" contains invalid collision tile ID ${tileId} at index ${i}`);
            break;
          }
        }
      } else if (layer.type === 'region') {
        for (let i = 0; i < layer.tiles.length; i++) {
          const tileId = layer.tiles[i];
          if (!isSupportedRegionTile(tileId)) {
            errors.push(`Layer "${req.name}" contains invalid region tile ID ${tileId} at index ${i}`);
            break;
          }
        }
      }
    }
  }

  // Check event references / validity
  if (map.events !== undefined) {
    if (!Array.isArray(map.events)) {
      errors.push('Map events must be an array');
    } else {
      const seenEventIds = new Set<string>();
      for (const event of map.events) {
        if (!event.id || typeof event.id !== 'string' || !event.id.trim()) {
          errors.push('Map event is missing id');
        } else {
          if (seenEventIds.has(event.id)) {
            errors.push(`Duplicate event id "${event.id}" in map draft`);
          }
          seenEventIds.add(event.id);
        }
      }
    }
  }

  return errors;
}

export function approveMapDraftGenerationCandidate(
  candidate: any,
  context: any,
  approvalMetadata: { reviewedAt: string }
) {
  const errors = validateMapDraftGenerationCandidate(candidate, context);
  if (errors.length > 0) {
    throw new Error('Invalid candidate');
  }
  return {
    ...candidate,
    reviewState: 'approved' as const,
    reviewedAt: approvalMetadata.reviewedAt,
    provenance: {
      ...candidate.provenance,
      reviewedAt: approvalMetadata.reviewedAt,
    },
  };
}
