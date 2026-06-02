import { describe, expect, it } from 'vitest';
import { normalizeAssetCatalog } from '../../adapters/defaultAssetCatalog';
import type { ProviderImageGenerationSettings } from '../../types/project';
import {
  buildImagePromptProvenance,
  defaultImagePromptVisualContext,
  imagePromptTemplates,
  renderImagePromptTemplate,
} from '../imagePromptTemplates';

const imageSettings: ProviderImageGenerationSettings = {
  modelId: 'gpt-image-2',
  quality: 'high',
  size: '1024x1024',
  style: 'pixel-art',
  outputFormat: 'png',
  background: 'auto',
  moderation: 'auto',
  styleIsApiParameter: false,
  docsCheckedAt: '2026-06-02',
};

describe('imagePromptTemplates', () => {
  it('ships versioned templates for each required RPG asset kind', () => {
    expect(imagePromptTemplates.map(template => [template.id, template.kind, template.version])).toEqual([
      ['tileset-rpg-map-v1', 'tileset', 1],
      ['icon-item-v1', 'icon', 1],
      ['portrait-character-v1', 'portrait', 1],
      ['character-concept-v1', 'concept', 1],
      ['character-spritesheet-v1', 'spritesheet', 1],
      ['asset-edit-v1', 'edit', 1],
      ['ui-panel-v1', 'ui-panel', 1],
      ['reference-board-v1', 'reference', 1],
    ]);

    for (const template of imagePromptTemplates) {
      expect(template.requiredInputs.length).toBeGreaterThan(0);
      expect(template.styleConstraints.join(' ')).toContain('original');
      expect(template.legalConstraints.join(' ')).not.toMatch(/copyright guarantee|licensed by/i);
    }
  });

  it('includes binding visual design context in every rendered prompt', () => {
    expect(defaultImagePromptVisualContext.source).toBe('docs/GAME_VISUAL_DESIGN.md');
    expect(defaultImagePromptVisualContext.rules.join(' ')).toContain('original assets');
    expect(defaultImagePromptVisualContext.rules.join(' ')).toContain('pixel-perfect alignment');

    const rendered = renderImagePromptTemplate('tileset-rpg-map-v1', {
      subject: 'snowy village ground and wall set',
      useCase: '16:9 story RPG town map',
      palette: 'cold blue snow, warm lamplight, dark stone outlines',
      styleNotes: 'copy in the style of Famous Studio',
    }, { imageSettings });

    expect(rendered.prompt).toContain('docs/GAME_VISUAL_DESIGN.md');
    expect(rendered.prompt).toContain('original RPGCreatorAI asset');
    expect(rendered.prompt).toContain('pixel-perfect alignment');
    expect(rendered.prompt).toContain('snowy village ground and wall set');
    expect(rendered.prompt).not.toMatch(/Famous Studio|copy in the style of/i);
    expect(rendered.prompt).toContain('Style guidance: pixel-art');
    expect(rendered.manifest.inputs.styleNotes).toBe('original visual direction reference removed');
  });

  it('fails closed when required prompt inputs are missing', () => {
    expect(() => renderImagePromptTemplate('icon-item-v1', {
      subject: 'healing potion',
      useCase: '',
      palette: 'ruby red glass',
    })).toThrow('Missing required prompt input "useCase"');
  });

  it('builds auditable generated-asset provenance without secrets or live endpoints', () => {
    const rendered = renderImagePromptTemplate('portrait-character-v1', {
      subject: 'older village healer portrait',
      useCase: 'dialogue bust for a local-first RPG',
      palette: 'muted greens, ivory cloth, warm face lighting',
      styleNotes: 'gentle readable silhouette',
    }, { imageSettings });

    const provenance = buildImagePromptProvenance(rendered, {
      providerId: 'openai',
      modelId: 'gpt-image-2',
      createdAt: '2026-06-02T17:55:00.000Z',
    });

    expect(provenance).toMatchObject({
      tool: 'image-prompt-template-library',
      createdAt: '2026-06-02T17:55:00.000Z',
      promptTemplateId: 'portrait-character-v1',
      promptTemplateVersion: 1,
      providerId: 'openai',
      modelId: 'gpt-image-2',
      visualContextSource: 'docs/GAME_VISUAL_DESIGN.md',
      promptInputs: {
        subject: 'older village healer portrait',
        useCase: 'dialogue bust for a local-first RPG',
      },
      imageSettings: {
        quality: 'high',
        size: '1024x1024',
        style: 'pixel-art',
      },
    });
    expect(provenance.prompt).toContain('older village healer portrait');
    expect(JSON.stringify(provenance)).not.toMatch(/apiKey|OPENAI_API_KEY|https:\/\/api|sk-/i);
  });

  it('normalizes asset catalogs while preserving prompt provenance manifests', () => {
    const rendered = renderImagePromptTemplate('icon-item-v1', {
      subject: 'ether crystal item icon',
      useCase: 'inventory icon',
      palette: 'cyan core, dark rim, readable small silhouette',
      styleNotes: 'project-default',
    }, { imageSettings });
    const generated = buildImagePromptProvenance(rendered, {
      providerId: 'local',
      modelId: 'offline-image-mock',
      createdAt: '2026-06-02T17:56:00.000Z',
    });

    const normalized = normalizeAssetCatalog({
      schemaVersion: 1,
      assets: [
        {
          id: 'generated_ether_crystal',
          name: 'Generated Ether Crystal',
          kind: 'image',
          path: 'assets/generated/images/ether-crystal.png',
          source: 'generated',
          generated,
        },
      ],
    });

    expect(normalized.assets[0].generated).toMatchObject({
      promptTemplateId: 'icon-item-v1',
      promptTemplateVersion: 1,
      modelId: 'offline-image-mock',
    });
  });
});
