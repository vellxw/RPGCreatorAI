import type {
  GeneratedAssetMetadata,
  ProviderImageGenerationSettings,
  ProviderImageStyle,
} from '../types/project';

export type ImagePromptTemplateKind = 'tileset' | 'icon' | 'portrait' | 'concept' | 'edit' | 'ui-panel' | 'reference';

export interface ImagePromptTemplate {
  id: string;
  version: number;
  kind: ImagePromptTemplateKind;
  label: string;
  requiredInputs: string[];
  purpose: string;
  outputGuidance: string[];
  styleConstraints: string[];
  legalConstraints: string[];
}

export interface ImagePromptVisualContext {
  source: string;
  version: string;
  rules: string[];
}

export interface RenderImagePromptOptions {
  imageSettings?: ProviderImageGenerationSettings;
  visualContext?: ImagePromptVisualContext;
}

export interface RenderedImagePrompt {
  templateId: string;
  templateVersion: number;
  templateKind: ImagePromptTemplateKind;
  prompt: string;
  manifest: {
    inputs: Record<string, string>;
    style: ProviderImageStyle | 'project-default';
    visualContextSource: string;
    visualContextVersion: string;
  };
  imageSettings?: ProviderImageGenerationSettings;
}

export interface BuildImagePromptProvenanceOptions {
  providerId: string;
  modelId: string;
  createdAt: string;
}

export const defaultImagePromptVisualContext: ImagePromptVisualContext = {
  source: 'docs/GAME_VISUAL_DESIGN.md',
  version: '2026-06-02',
  rules: [
    'Create original assets for RPGCreatorAI; each output must be an original RPGCreatorAI asset and must not copy reference art, layouts, characters, or copyrighted content.',
    'Respect viewport-aware story-RPG composition with complete frame coverage and readable playable space.',
    'Use pixel-perfect alignment, clear silhouettes, and tile-consistent visual scale.',
    'Keep collision, entrances, interactables, foreground, midground, and background readable from the art.',
    'Prefer authored scene detail over accidental voids, detached islands, or purely atmospheric output.',
  ],
};

export const imagePromptTemplates: ImagePromptTemplate[] = [
  {
    id: 'tileset-rpg-map-v1',
    version: 1,
    kind: 'tileset',
    label: 'RPG map tileset',
    requiredInputs: ['subject', 'useCase', 'palette', 'styleNotes'],
    purpose: 'Generate a coherent tile family for authored RPG maps.',
    outputGuidance: [
      'Return a clean sheet-ready image concept with repeatable ground, wall, boundary, and decor tiles.',
      'Keep tile edges aligned and readable at small scale.',
      'Separate walkable, blocking, foreground, and decorative cues visually.',
    ],
    styleConstraints: [
      'original RPGCreatorAI tile art direction only',
      'pixel-clean forms with no accidental seams',
      'consistent tile scale and readable silhouettes',
    ],
    legalConstraints: [
      'Do not copy proprietary tilesets, characters, logos, or franchise-specific motifs.',
      'Do not claim license, endorsement, or compatibility with third-party art packs.',
    ],
  },
  {
    id: 'icon-item-v1',
    version: 1,
    kind: 'icon',
    label: 'Item icon',
    requiredInputs: ['subject', 'useCase', 'palette', 'styleNotes'],
    purpose: 'Generate a compact inventory or database icon candidate.',
    outputGuidance: [
      'Use a centered silhouette that stays readable at inventory scale.',
      'Avoid busy backgrounds; keep the icon boundary clear.',
      'Use palette contrast to separate the object from transparent or neutral backing.',
    ],
    styleConstraints: [
      'original RPGCreatorAI icon art direction only',
      'high-contrast readable shape',
      'small-canvas clarity before decorative texture',
    ],
    legalConstraints: [
      'Do not copy proprietary item designs, logos, or recognizable franchise symbols.',
      'Do not claim the output is licensed stock art.',
    ],
  },
  {
    id: 'portrait-character-v1',
    version: 1,
    kind: 'portrait',
    label: 'Character portrait',
    requiredInputs: ['subject', 'useCase', 'palette', 'styleNotes'],
    purpose: 'Generate dialogue portrait or character concept candidates.',
    outputGuidance: [
      'Prioritize expressive face, readable pose, and clean shoulders-up composition.',
      'Leave space for dialogue UI crops and avoid tangents at the frame edge.',
      'Make clothing and props imply role without copying known characters.',
    ],
    styleConstraints: [
      'original RPGCreatorAI portrait art direction only',
      'clear silhouette and readable expression',
      'story-RPG staging with restrained detail',
    ],
    legalConstraints: [
      'Do not copy actors, celebrities, proprietary characters, or studio-specific likenesses.',
      'Do not claim legal clearance or identity rights.',
    ],
  },
  {
    id: 'character-concept-v1',
    version: 1,
    kind: 'concept',
    label: 'Character concept',
    requiredInputs: ['subject', 'useCase', 'palette', 'styleNotes'],
    purpose: 'Generate full-character concept candidates for portrait, sprite, and animation direction.',
    outputGuidance: [
      'Return a readable full-body or three-quarter character concept suitable for later portrait and sprite derivation.',
      'Show silhouette, clothing, color blocking, and key props without adding unrelated background clutter.',
      'Keep pose and proportions useful for RPG sprite planning and animation notes.',
    ],
    styleConstraints: [
      'original RPGCreatorAI character concept direction only',
      'clear full-character silhouette and readable costume layers',
      'story-RPG design language with restrained detail',
    ],
    legalConstraints: [
      'Do not copy actors, celebrities, proprietary characters, or recognizable franchise costumes.',
      'Do not claim legal clearance, identity rights, or compatibility with third-party character packs.',
    ],
  },
  {
    id: 'asset-edit-v1',
    version: 1,
    kind: 'edit',
    label: 'Asset edit or variation',
    requiredInputs: ['subject', 'useCase', 'palette', 'styleNotes'],
    purpose: 'Generate reviewed edit or variation candidates from existing project assets.',
    outputGuidance: [
      'Preserve the source asset identity unless the edit instruction explicitly changes it.',
      'Return a new image candidate only; never overwrite the referenced source asset.',
      'Keep source dimensions, readable composition, and project-owned asset intent visible.',
    ],
    styleConstraints: [
      'original RPGCreatorAI asset edit direction only',
      'source-aware iteration with readable silhouettes',
      'consistent scale, palette discipline, and no destructive overwrite',
    ],
    legalConstraints: [
      'Do not copy proprietary references, branded assets, or recognizable protected artwork.',
      'Do not claim third-party license transfer from the source or reference images.',
    ],
  },
  {
    id: 'ui-panel-v1',
    version: 1,
    kind: 'ui-panel',
    label: 'Runtime UI panel',
    requiredInputs: ['subject', 'useCase', 'palette', 'styleNotes'],
    purpose: 'Generate runtime HUD, dialogue, shop, inventory, or menu panel candidates.',
    outputGuidance: [
      'Keep text areas quiet, high-contrast, and reusable for varying string lengths.',
      'Avoid decorative clutter where buttons, labels, or counters need to sit.',
      'Preserve stable frame edges and simple nine-slice-friendly regions.',
    ],
    styleConstraints: [
      'original RPGCreatorAI UI art direction only',
      'functional readability before ornament',
      'consistent panel scale and clean state boundaries',
    ],
    legalConstraints: [
      'Do not copy proprietary game menus, UI skins, logos, or brand marks.',
      'Do not imply third-party endorsement.',
    ],
  },
  {
    id: 'reference-board-v1',
    version: 1,
    kind: 'reference',
    label: 'Reference board',
    requiredInputs: ['subject', 'useCase', 'palette', 'styleNotes'],
    purpose: 'Generate internal visual reference candidates for reviewed asset direction.',
    outputGuidance: [
      'Show original mood, material, color, and composition direction without copying references.',
      'Keep notes and visual callouts generic enough to guide later asset production.',
      'Avoid including logos, known characters, or exact layout replicas.',
    ],
    styleConstraints: [
      'original RPGCreatorAI visual direction only',
      'clear mood and material cues',
      'reviewable composition guidance',
    ],
    legalConstraints: [
      'Do not copy proprietary reference boards, branded assets, or copyrighted layouts.',
      'Do not claim legal approval for downstream generated assets.',
    ],
  },
];

function findTemplate(templateId: string): ImagePromptTemplate {
  const template = imagePromptTemplates.find(candidate => candidate.id === templateId);
  if (!template) throw new Error(`Unknown image prompt template "${templateId}"`);
  return template;
}

function sanitizePromptInput(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  if (/\b(in the style of|style of|copy|clone|copyrighted|trademarked)\b/i.test(trimmed)) {
    return 'original visual direction reference removed';
  }
  return trimmed;
}

function renderList(title: string, values: string[]): string {
  return [`${title}:`, ...values.map(value => `- ${value}`)].join('\n');
}

export function renderImagePromptTemplate(
  templateId: string,
  rawInputs: Record<string, unknown>,
  options: RenderImagePromptOptions = {},
): RenderedImagePrompt {
  const template = findTemplate(templateId);
  const visualContext = options.visualContext ?? defaultImagePromptVisualContext;
  const inputs = template.requiredInputs.reduce<Record<string, string>>((out, key) => {
    const value = sanitizePromptInput(rawInputs[key]);
    if (!value) throw new Error(`Missing required prompt input "${key}"`);
    out[key] = value;
    return out;
  }, {});
  const style = options.imageSettings?.style ?? 'project-default';

  const prompt = [
    `RPGCreatorAI image prompt template: ${template.label} (${template.id} v${template.version})`,
    `Purpose: ${template.purpose}`,
    `Visual source: ${visualContext.source}`,
    renderList('Binding visual rules', visualContext.rules),
    'Asset brief:',
    `- Subject: ${inputs.subject}`,
    `- Use case: ${inputs.useCase}`,
    `- Palette: ${inputs.palette}`,
    `- Style notes: ${inputs.styleNotes}`,
    `Style guidance: ${style}`,
    renderList('Output requirements', template.outputGuidance),
    renderList('Style constraints', template.styleConstraints),
    renderList('Legal and safety constraints', template.legalConstraints),
  ].join('\n\n');

  return {
    templateId: template.id,
    templateVersion: template.version,
    templateKind: template.kind,
    prompt,
    manifest: {
      inputs,
      style,
      visualContextSource: visualContext.source,
      visualContextVersion: visualContext.version,
    },
    imageSettings: options.imageSettings ? { ...options.imageSettings } : undefined,
  };
}

export function buildImagePromptProvenance(
  rendered: RenderedImagePrompt,
  options: BuildImagePromptProvenanceOptions,
): GeneratedAssetMetadata {
  return {
    prompt: rendered.prompt,
    tool: 'image-prompt-template-library',
    createdAt: options.createdAt,
    promptTemplateId: rendered.templateId,
    promptTemplateVersion: rendered.templateVersion,
    promptTemplateKind: rendered.templateKind,
    promptInputs: { ...rendered.manifest.inputs },
    providerId: options.providerId,
    modelId: options.modelId,
    imageSettings: rendered.imageSettings
      ? {
          modelId: rendered.imageSettings.modelId,
          quality: rendered.imageSettings.quality,
          size: rendered.imageSettings.size,
          style: rendered.imageSettings.style,
          outputFormat: rendered.imageSettings.outputFormat,
          background: rendered.imageSettings.background,
          moderation: rendered.imageSettings.moderation,
        }
      : undefined,
    visualContextSource: rendered.manifest.visualContextSource,
    visualContextVersion: rendered.manifest.visualContextVersion,
  };
}
