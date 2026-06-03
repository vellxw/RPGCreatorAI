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
