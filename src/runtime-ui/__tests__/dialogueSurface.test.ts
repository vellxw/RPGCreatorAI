// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mountRuntimeDialogueSurface } from '../dialogueSurface';

describe('runtime dialogue surface', () => {
  it('shows a local portrait and falls back to readable text when the image fails', () => {
    const container = document.createElement('div');
    const surface = mountRuntimeDialogueSurface(container);

    surface.render({
      speaker: 'Damián',
      text: 'La clínica recuerda por nosotros.',
      portraitUrl: './assets/portraits/damian.webp',
    });

    const image = container.querySelector('img');
    expect(surface.element.hidden).toBe(false);
    expect(image?.getAttribute('src')).toBe('./assets/portraits/damian.webp');
    expect(surface.element.textContent).toContain('Damián');
    expect(surface.element.textContent).toContain('La clínica recuerda por nosotros.');

    image?.dispatchEvent(new Event('error'));
    expect(image?.hidden).toBe(true);
    expect(surface.element.textContent).toContain('D');

    surface.render(undefined);
    expect(surface.element.hidden).toBe(true);
    surface.destroy();
    expect(container.childElementCount).toBe(0);
  });

  it('renders and updates the selected visual-novel choice accessibly', () => {
    const container = document.createElement('div');
    const surface = mountRuntimeDialogueSurface(container);

    surface.render({
      kind: 'choice',
      text: 'Elegí con cuidado.',
      choices: [
        { id: 'remember', text: 'Nunca te olvidé.', selected: true },
        { id: 'deny', text: 'No sé quién sos.', selected: false },
      ],
    });

    expect(surface.element.dataset.kind).toBe('choice');
    expect(container.querySelector('[data-choice-id="remember"]')?.getAttribute('aria-current')).toBe('true');
    expect(surface.element.textContent).toContain('▶ Nunca te olvidé.');

    surface.render({
      kind: 'choice',
      text: 'Elegí con cuidado.',
      choices: [
        { id: 'remember', text: 'Nunca te olvidé.', selected: false },
        { id: 'deny', text: 'No sé quién sos.', selected: true },
      ],
    });

    expect(container.querySelector('[data-choice-id="deny"]')?.getAttribute('aria-current')).toBe('true');
    expect(surface.element.textContent).toContain('▶ No sé quién sos.');
  });
});
