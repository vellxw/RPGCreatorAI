import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimationsEditor } from '../AnimationsEditor';
import type { AnimationDatabaseData, AssetCatalogEntry } from '../../../types/project';
import type { SpritesheetImportRunner } from '../../../adapters/spritesheetImport';
import type {
  SpriteSheetGenerationCandidate,
  SpriteSheetGenerationRunner,
} from '../../../providers/spriteSheetGenerationWorkflow';

function render(ui: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function input(container: HTMLElement, label: string): HTMLInputElement {
  const found = container.querySelector(`input[aria-label="${label}"]`);
  if (!(found instanceof HTMLInputElement)) throw new Error(`Missing input: ${label}`);
  return found;
}

function textarea(container: HTMLElement, label: string): HTMLTextAreaElement {
  const found = container.querySelector(`textarea[aria-label="${label}"]`);
  if (!(found instanceof HTMLTextAreaElement)) throw new Error(`Missing textarea: ${label}`);
  return found;
}

function select(container: HTMLElement, label: string): HTMLSelectElement {
  const found = container.querySelector(`select[aria-label="${label}"]`);
  if (!(found instanceof HTMLSelectElement)) throw new Error(`Missing select: ${label}`);
  return found;
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = container.querySelector(`button[aria-label="${label}"]`);
  if (!(found instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`);
  return found;
}

function click(container: HTMLElement, label: string) {
  const found = button(container, label);
  act(() => found.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

async function clickAsync(container: HTMLElement, label: string) {
  const found = button(container, label);
  await act(async () => {
    found.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function changeText(el: HTMLInputElement, value: string) {
  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(el, 'value')?.set;
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(el, value);
    } else {
      valueSetter?.call(el, value);
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function changeTextarea(el: HTMLTextAreaElement, value: string) {
  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(el, 'value')?.set;
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(el, value);
    } else {
      valueSetter?.call(el, value);
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function changeSelect(el: HTMLSelectElement, value: string) {
  act(() => {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const database: AnimationDatabaseData = {
  sets: [
    {
      id: 'player_adventurer',
      display: { heightTiles: 1.5, widthTiles: 1, yOffsetPx: 0 },
      clips: [
        {
          action: 'idle',
          direction: 'down',
          asset: 'player_adventurer_idle_down',
          frameSize: { width: 64, height: 64 },
          frameCount: 4,
          fps: 4,
          loop: true,
          anchor: { x: 32, y: 54 },
        },
      ],
    },
  ],
};

const sourceConceptAsset: AssetCatalogEntry = {
  id: 'arc_concept',
  name: 'Arc Concept',
  kind: 'image',
  path: 'assets/generated/concepts/arc_concept.png',
  source: 'generated',
  tags: ['generated', 'character-concept', 'reviewed'],
  width: 1024,
  height: 1536,
  generated: {
    promptTemplateId: 'character-concept-v1',
    promptTemplateKind: 'concept',
    ownerKind: 'actor',
    ownerId: 'arc',
    ownerName: 'Arc',
  },
};

describe('AnimationsEditor', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('edits display metadata and clip frame data while rendering a clipped sheet preview', () => {
    const onChange = vi.fn();
    const view = render(<AnimationsEditor value={database} onChange={onChange} />);

    expect(view.container.querySelector('svg[aria-label="Animation preview"]')).not.toBeNull();
    const previewImage = view.container.querySelector('image');
    expect(previewImage?.getAttribute('href')).toContain('player_adventurer_idle_down');

    changeText(input(view.container, 'Display height tiles'), '2');
    expect(onChange).toHaveBeenLastCalledWith({
      sets: [
        {
          ...database.sets[0],
          display: { heightTiles: 2, widthTiles: 1, yOffsetPx: 0 },
        },
      ],
    });

    changeText(input(view.container, 'Frame count 1'), '6');
    expect(onChange).toHaveBeenLastCalledWith({
      sets: [
        {
          ...database.sets[0],
          clips: [{ ...database.sets[0].clips[0], frameCount: 6 }],
        },
      ],
    });

    changeSelect(select(view.container, 'Clip asset 1'), 'player_adventurer_walk_down');
    expect(onChange).toHaveBeenLastCalledWith({
      sets: [
        {
          ...database.sets[0],
          clips: [{ ...database.sets[0].clips[0], asset: 'player_adventurer_walk_down' }],
        },
      ],
    });
  });

  it('adds, duplicates, renames, and deletes animation sets without JSON editing', () => {
    const onChange = vi.fn();
    const view = render(<AnimationsEditor value={database} onChange={onChange} />);

    click(view.container, 'Add animation set');
    expect(onChange.mock.lastCall?.[0].sets).toHaveLength(2);

    click(view.container, 'Duplicate animation set player_adventurer');
    expect(onChange.mock.lastCall?.[0].sets.at(-1).id).toBe('player_adventurer_copy');

    changeText(input(view.container, 'Animation set ID'), 'hero');
    expect(onChange.mock.lastCall?.[0].sets[0].id).toBe('hero');

    click(view.container, 'Delete animation set player_adventurer');
    expect(onChange).toHaveBeenLastCalledWith({ sets: [] });
  });

  it('filters animation sets and keeps hidden selection understandable', () => {
    const value: AnimationDatabaseData = {
      sets: Array.from({ length: 24 }, (_, index) => ({
        ...database.sets[0],
        id: `animation_${String(index + 1).padStart(2, '0')}`,
      })),
    };
    const view = render(<AnimationsEditor value={value} onChange={vi.fn()} />);

    expect(view.container.textContent).toContain('Showing 24 of 24 animation sets');

    changeText(input(view.container, 'Search animation sets'), 'animation_21');

    expect(view.container.textContent).toContain('Showing 1 of 24 animation sets');
    const clearSearch = view.container.querySelector<HTMLButtonElement>('button[aria-label="Clear animation set search"]');
    expect(clearSearch?.className).toContain('h-6');
    expect(view.container.textContent).toContain('Selected animation_01 is hidden by this filter.');
    click(view.container, 'Select animation set animation_21');
    expect(view.container.textContent).toContain('animation_21');

    changeText(input(view.container, 'Search animation sets'), 'missing');
    expect(view.container.textContent).toContain('No animation sets match "missing"');

    view.unmount();
  });

  it('blocks animation set deletes when references are present', () => {
    const onChange = vi.fn();
    const view = render(
      <AnimationsEditor
        value={database}
        referenceSources={{ player_adventurer: ['database/system/playerAnimationSet'] }}
        onChange={onChange}
      />,
    );

    expect(view.container.textContent).toContain('1 ref');

    click(view.container, 'Delete animation set player_adventurer blocked by 1 reference');

    expect(alert).toHaveBeenCalledWith(expect.stringContaining('database/system/playerAnimationSet'));
    expect(onChange).not.toHaveBeenCalled();

    view.unmount();
  });

  it('imports a spritesheet into the asset catalog and animation database', async () => {
    const importedAsset: AssetCatalogEntry = {
      id: 'hero_run_sheet',
      name: 'Hero Run Sheet',
      kind: 'spritesheet',
      path: 'assets/imported/spritesheets/hero-run-sheet.png',
      source: 'imported',
      tags: ['imported', 'spritesheet'],
      frameWidth: 64,
      frameHeight: 64,
      frames: 6,
    };
    const spritesheetImporter: SpritesheetImportRunner = vi.fn(async () => ({
      success: true,
      cancelled: false,
      asset: importedAsset,
    }));
    const onAssetImported = vi.fn();
    const onChange = vi.fn();
    const view = render(
      <AnimationsEditor
        value={{ sets: [] }}
        assets={[]}
        spritesheetImporter={spritesheetImporter}
        onAssetImported={onAssetImported}
        onChange={onChange}
      />,
    );

    click(view.container, 'Import spritesheet');
    expect(view.container.querySelector('[aria-label="Spritesheet metadata preview"]')).not.toBeNull();
    changeText(input(view.container, 'Spritesheet set ID'), 'hero_run');
    changeText(input(view.container, 'Spritesheet name'), 'Hero Run Sheet');
    changeText(input(view.container, 'Spritesheet action'), 'run');
    changeSelect(select(view.container, 'Spritesheet direction'), 'right');
    changeText(input(view.container, 'Spritesheet frame count'), '6');
    changeText(input(view.container, 'Spritesheet FPS'), '10');

    await clickAsync(view.container, 'Accept spritesheet import');

    expect(spritesheetImporter).toHaveBeenCalledWith([], {
      idBase: 'hero_run_sheet',
      name: 'Hero Run Sheet',
      frameWidth: 64,
      frameHeight: 64,
      frameCount: 6,
    });
    expect(onAssetImported).toHaveBeenCalledWith(importedAsset);
    expect(onChange).toHaveBeenLastCalledWith({
      sets: [
        {
          id: 'hero_run',
          display: { heightTiles: 1.5, widthTiles: 1, yOffsetPx: 0 },
          clips: [
            {
              action: 'run',
              direction: 'right',
              asset: 'hero_run_sheet',
              frameSize: { width: 64, height: 64 },
              frameCount: 6,
              fps: 10,
              loop: true,
              anchor: { x: 32, y: 54 },
            },
          ],
        },
      ],
    });
    expect(view.container.textContent).toContain('Imported Hero Run Sheet');

    view.unmount();
  });

  it('validates spritesheet metadata before opening the file picker', async () => {
    const spritesheetImporter: SpritesheetImportRunner = vi.fn();
    const view = render(
      <AnimationsEditor
        value={database}
        assets={[]}
        spritesheetImporter={spritesheetImporter}
        onAssetImported={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    click(view.container, 'Import spritesheet');
    changeText(input(view.container, 'Spritesheet frame count'), '0');

    await clickAsync(view.container, 'Accept spritesheet import');

    expect(spritesheetImporter).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain('Frame count must be a positive integer.');

    view.unmount();
  });

  it('generates a spritesheet candidate and inserts it into animations only after visual and animation QA acceptance', async () => {
    const candidate: SpriteSheetGenerationCandidate = {
      id: 'sprite-gen-arc',
      reviewState: 'pending',
      owner: { kind: 'actor', id: 'arc', name: 'Arc' },
      sourceConceptAsset,
      referenceAssets: [],
      asset: {
        id: 'arc_idle_sheet',
        name: 'Arc Idle Sheet',
        kind: 'spritesheet',
        path: 'assets/generated/spritesheets/arc_idle_sheet.png',
        source: 'generated',
        tags: ['generated', 'spritesheet', 'character-spritesheet', 'actor', 'idle', 'down', 'ai-draft', 'pending-review'],
        width: 256,
        height: 64,
        frameWidth: 64,
        frameHeight: 64,
        frames: 4,
        generated: {
          promptTemplateId: 'character-spritesheet-v1',
          promptTemplateKind: 'spritesheet',
          providerId: 'local',
          modelId: 'offline-image-mock',
          operation: 'image.generate',
          ownerKind: 'actor',
          ownerId: 'arc',
          ownerName: 'Arc',
          sourceAssetId: 'arc_concept',
          sourceAssetPath: 'assets/generated/concepts/arc_concept.png',
          spriteSheet: {
            frameWidth: 64,
            frameHeight: 64,
            frameCount: 4,
            action: 'idle',
            direction: 'down',
            frameLayout: 'horizontal-strip',
            transparentBackgroundRequired: true,
          },
        },
      },
      animationSet: {
        id: 'arc_idle',
        display: { heightTiles: 1.5, widthTiles: 1, yOffsetPx: 0 },
        clips: [
          {
            action: 'idle',
            direction: 'down',
            asset: 'arc_idle_sheet',
            frameSize: { width: 64, height: 64 },
            frameCount: 4,
            fps: 8,
            loop: true,
            anchor: { x: 32, y: 54 },
          },
        ],
      },
      qaPreview: {
        assetRef: 'mock://generated/sprite-gen-arc.png',
        width: 256,
        height: 64,
        frameWidth: 64,
        frameHeight: 64,
        frameCount: 4,
        frameLayout: 'horizontal-strip',
        transparentBackgroundRequired: true,
        providerFixture: 'offline-image',
      },
    };
    const spriteSheetGenerator: SpriteSheetGenerationRunner = vi.fn(async () => ({
      success: true,
      candidate,
    }));
    const onAssetImported = vi.fn();
    const onChange = vi.fn();
    const view = render(
      <AnimationsEditor
        value={{ sets: [] }}
        assets={[sourceConceptAsset]}
        spriteSheetGenerator={spriteSheetGenerator}
        onAssetImported={onAssetImported}
        onChange={onChange}
      />,
    );

    click(view.container, 'Generate sprite sheet');
    expect(view.container.querySelector('[aria-label="Sprite sheet generation metadata preview"]')).not.toBeNull();
    expect(select(view.container, 'Sprite sheet source concept').value).toBe('arc_concept');
    changeText(input(view.container, 'Sprite sheet set ID'), 'arc_idle');
    changeText(input(view.container, 'Sprite sheet name'), 'Arc Idle Sheet');
    changeText(input(view.container, 'Sprite sheet action'), 'idle');
    changeSelect(select(view.container, 'Sprite sheet direction'), 'down');

    await clickAsync(view.container, 'Run sprite sheet generation');

    expect(spriteSheetGenerator).toHaveBeenCalledWith(['arc_concept'], [], expect.objectContaining({
      animationSetId: 'arc_idle',
      name: 'Arc Idle Sheet',
      action: 'idle',
      direction: 'down',
      sourceConceptAsset,
    }));
    expect(onAssetImported).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(view.container.querySelector('[aria-label="Generated sprite sheet review"]')).not.toBeNull();
    expect(view.container.textContent).toContain('Visual QA checklist');
    expect(view.container.textContent).toContain('Character animation QA');
    expect(view.container.textContent).toContain('Runtime compatibility');
    expect(button(view.container, 'Accept generated sprite sheet').disabled).toBe(true);

    await clickAsync(view.container, 'Accept character animation QA');

    await clickAsync(view.container, 'Accept generated sprite sheet');

    expect(onAssetImported).toHaveBeenCalledWith(expect.objectContaining({
      id: 'arc_idle_sheet',
      kind: 'spritesheet',
      runtimeCompatible: true,
      tags: expect.arrayContaining(['reviewed', 'qa-reviewed', 'animation-qa-reviewed']),
      generated: expect.objectContaining({
        animationQa: expect.objectContaining({
          status: 'accepted',
          notes: '',
        }),
      }),
    }));
    expect(onChange).toHaveBeenLastCalledWith({ sets: [candidate.animationSet] });

    view.unmount();
  });

  it('rejects generated spritesheet candidates with animation QA notes without mutating project data', async () => {
    const candidate: SpriteSheetGenerationCandidate = {
      id: 'sprite-gen-arc',
      reviewState: 'pending',
      owner: { kind: 'actor', id: 'arc', name: 'Arc' },
      sourceConceptAsset,
      referenceAssets: [],
      asset: {
        id: 'arc_idle_sheet',
        name: 'Arc Idle Sheet',
        kind: 'spritesheet',
        path: 'assets/generated/spritesheets/arc_idle_sheet.png',
        source: 'generated',
        tags: ['generated', 'spritesheet', 'character-spritesheet', 'actor', 'idle', 'down', 'ai-draft', 'pending-review'],
        width: 256,
        height: 64,
        frameWidth: 64,
        frameHeight: 64,
        frames: 4,
        generated: {
          promptTemplateId: 'character-spritesheet-v1',
          promptTemplateKind: 'spritesheet',
          providerId: 'local',
          modelId: 'offline-image-mock',
          operation: 'image.generate',
          ownerKind: 'actor',
          ownerId: 'arc',
          ownerName: 'Arc',
          sourceAssetId: 'arc_concept',
          sourceAssetPath: 'assets/generated/concepts/arc_concept.png',
          spriteSheet: {
            frameWidth: 64,
            frameHeight: 64,
            frameCount: 4,
            action: 'idle',
            direction: 'down',
            frameLayout: 'horizontal-strip',
            transparentBackgroundRequired: true,
          },
        },
      },
      animationSet: {
        id: 'arc_idle',
        display: { heightTiles: 1.5, widthTiles: 1, yOffsetPx: 0 },
        clips: [
          {
            action: 'idle',
            direction: 'down',
            asset: 'arc_idle_sheet',
            frameSize: { width: 64, height: 64 },
            frameCount: 4,
            fps: 8,
            loop: true,
            anchor: { x: 32, y: 54 },
          },
        ],
      },
      qaPreview: {
        assetRef: 'mock://generated/sprite-gen-arc.png',
        width: 256,
        height: 64,
        frameWidth: 64,
        frameHeight: 64,
        frameCount: 4,
        frameLayout: 'horizontal-strip',
        transparentBackgroundRequired: true,
        providerFixture: 'offline-image',
      },
    };
    const spriteSheetGenerator: SpriteSheetGenerationRunner = vi.fn(async () => ({
      success: true,
      candidate,
    }));
    const onAssetImported = vi.fn();
    const onChange = vi.fn();
    const view = render(
      <AnimationsEditor
        value={{ sets: [] }}
        assets={[sourceConceptAsset]}
        spriteSheetGenerator={spriteSheetGenerator}
        onAssetImported={onAssetImported}
        onChange={onChange}
      />,
    );

    click(view.container, 'Generate sprite sheet');
    await clickAsync(view.container, 'Run sprite sheet generation');
    changeTextarea(textarea(view.container, 'Character animation QA notes'), 'Foot anchors slide between frames.');

    await clickAsync(view.container, 'Reject character animation QA');

    expect(onAssetImported).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain('Animation QA rejected');
    expect(view.container.textContent).toContain('Foot anchors slide between frames.');
    expect(button(view.container, 'Accept generated sprite sheet').disabled).toBe(true);

    view.unmount();
  });
});
