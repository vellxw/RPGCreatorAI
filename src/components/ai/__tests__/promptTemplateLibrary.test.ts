import { describe, it, expect } from 'vitest';
import {
  buildPromptTemplateLibrary,
  renderPromptTemplate,
  type PromptTemplate,
  type PromptTemplateKind,
} from '../promptTemplateLibrary';

describe('buildPromptTemplateLibrary', () => {
  it('returns a stable, non-empty library with at least one template per supported kind', () => {
    const lib = buildPromptTemplateLibrary();
    expect(lib.templates.length).toBeGreaterThanOrEqual(5);
    const kinds = new Set(lib.templates.map((t) => t.kind));
    for (const required of ['map', 'event', 'database', 'asset', 'balancing'] as PromptTemplateKind[]) {
      expect(kinds.has(required)).toBe(true);
    }
  });

  it('every template has a stable id and a non-empty body', () => {
    const lib = buildPromptTemplateLibrary();
    for (const t of lib.templates) {
      expect(t.id).toMatch(/^[a-z0-9-]+$/);
      expect(t.body.length).toBeGreaterThan(20);
    }
  });

  it('every template lists at least one placeholder used in the body', () => {
    const lib = buildPromptTemplateLibrary();
    for (const t of lib.templates) {
      const placeholders = t.placeholders;
      expect(placeholders.length).toBeGreaterThan(0);
      for (const ph of placeholders) {
        expect(t.body).toContain(`{{${ph}}}`);
      }
    }
  });

  it('template kinds map to a stable, documented intent name', () => {
    const lib = buildPromptTemplateLibrary();
    const mapTemplate = lib.templates.find((t) => t.kind === 'map') as PromptTemplate | undefined;
    expect(mapTemplate).toBeTruthy();
    expect(mapTemplate?.intent).toMatch(/^map\./);
  });
});

describe('renderPromptTemplate', () => {
  it('substitutes every placeholder with the provided values', () => {
    const t: PromptTemplate = {
      id: 'demo',
      kind: 'map',
      label: 'Demo',
      intent: 'map.draft',
      body: 'Draft a {{size}} map named {{title}} for project {{projectTitle}}.',
      placeholders: ['size', 'title', 'projectTitle'],
    };
    const out = renderPromptTemplate(t, { size: '20x15', title: 'Town Square', projectTitle: 'My RPG' });
    expect(out).toBe('Draft a 20x15 map named Town Square for project My RPG.');
  });

  it('returns the body unchanged when no placeholders are provided', () => {
    const t: PromptTemplate = {
      id: 'plain',
      kind: 'event',
      label: 'Plain',
      intent: 'event.draft',
      body: 'Generate a small event for the selected page.',
      placeholders: [],
    };
    const out = renderPromptTemplate(t, {});
    expect(out).toBe('Generate a small event for the selected page.');
  });

  it('keeps an unknown placeholder as the raw token (does not throw)', () => {
    const t: PromptTemplate = {
      id: 'partial',
      kind: 'database',
      label: 'Partial',
      intent: 'database.balance',
      body: 'Balance {{table}} rows for {{projectTitle}}.',
      placeholders: ['table', 'projectTitle'],
    };
    const out = renderPromptTemplate(t, { table: 'actors' });
    expect(out).toBe('Balance actors rows for {{projectTitle}}.');
  });

  it('does not introduce raw infrastructure prompts (asserted by string check)', () => {
    const lib = buildPromptTemplateLibrary();
    for (const t of lib.templates) {
      expect(t.body).not.toMatch(/system:|assistant:|user:|<\|/i);
    }
  });
});
