import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HORROR_BL_VERTICAL_SLICE_SCHEMA_VERSION,
  validateHorrorBlVerticalSlice,
} from '../horrorBlVerticalSlice';

const contentPath = resolve(process.cwd(), 'templates/horror-bl/data/content/vertical-slice.json');
const schemaPath = resolve(process.cwd(), 'templates/horror-bl/data/schema/vertical-slice.schema.json');

function loadJson(path: string): Record<string, any> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, any>;
}

describe('horror/BL vertical slice schema', () => {
  it('keeps a formal, versioned JSON Schema beside the canonical content', () => {
    const schema = loadJson(schemaPath);
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.properties.schemaVersion.const).toBe(HORROR_BL_VERTICAL_SLICE_SCHEMA_VERSION);
    expect(schema.properties.endings.minItems).toBe(2);
    expect(schema.properties.endings.maxItems).toBe(2);
    expect(schema.$defs.character.properties.age.minimum).toBe(18);
  });

  it('accepts the complete canonical chapter', () => {
    const content = loadJson(contentPath);
    expect(validateHorrorBlVerticalSlice(content)).toEqual([]);
    expect(content.storyBeats.filter((beat: { type: string }) => beat.type === 'choice')).toHaveLength(4);
    expect(content.puzzles).toHaveLength(1);
    expect(content.chases).toHaveLength(1);
    expect(content.endings).toHaveLength(2);
  });

  it('rejects underage romance characters', () => {
    const content = loadJson(contentPath);
    content.characters[1].age = 17;
    expect(validateHorrorBlVerticalSlice(content)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'character.not-adult' }),
    ]));
  });

  it('rejects broken narrative references and undeclared state effects', () => {
    const content = loadJson(contentPath);
    content.storyBeats[1].options[0].nextBeatId = 'missing_beat';
    content.storyBeats[1].options[0].effects[0].target = 'secret_affection';
    const issues = validateHorrorBlVerticalSlice(content);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'choice.destination' }),
      expect.objectContaining({ code: 'effect.target' }),
    ]));
  });

  it('rejects external asset policy and remote URLs', () => {
    const content = loadJson(contentPath);
    content.assetPolicy.remoteUrlsAllowed = true;
    content.characters[0].portraitSlot = 'https://example.invalid/damian.png';
    const issues = validateHorrorBlVerticalSlice(content);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'asset.external' }),
      expect.objectContaining({ code: 'asset.remote-url' }),
    ]));
  });
});
