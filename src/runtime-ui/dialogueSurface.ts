export interface RuntimeDialogueSurfaceState {
  speaker?: string;
  text: string;
  portraitUrl?: string;
  portraitAlt?: string;
  kind?: 'dialogue' | 'choice' | 'ending';
  choices?: ReadonlyArray<{ id: string; text: string; selected: boolean }>;
  endingId?: string;
}

export interface RuntimeDialogueSurface {
  readonly element: HTMLElement;
  render(state?: RuntimeDialogueSurfaceState): void;
  destroy(): void;
}

function initial(value: string | undefined): string {
  return Array.from(value?.trim() || '?')[0]?.toLocaleUpperCase() ?? '?';
}

/**
 * Creates the accessible DOM dialogue layer used beside the Phaser canvas.
 * It intentionally accepts a pre-resolved local URL so provider/network
 * concerns never cross into the exported runtime UI.
 */
export function mountRuntimeDialogueSurface(container: HTMLElement): RuntimeDialogueSurface {
  const document = container.ownerDocument;
  const element = document.createElement('section');
  element.hidden = true;
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  element.setAttribute('aria-atomic', 'true');
  element.dataset.rpgCreatorDialogue = 'true';
  element.style.cssText = [
    'position:absolute',
    'z-index:30',
    'left:clamp(12px,4vw,48px)',
    'right:clamp(12px,4vw,48px)',
    'bottom:clamp(12px,3vh,32px)',
    'min-height:clamp(92px,19vh,172px)',
    'display:grid',
    'grid-template-columns:minmax(70px,18%) 1fr',
    'align-items:end',
    'gap:clamp(10px,2vw,24px)',
    'padding:clamp(12px,2vw,24px)',
    'border:1px solid rgba(191,111,123,.72)',
    'background:linear-gradient(180deg,rgba(37,11,16,.94),rgba(18,8,12,.98))',
    'box-shadow:0 18px 48px rgba(0,0,0,.55)',
    'color:#f7eee8',
    'font-family:system-ui,-apple-system,sans-serif',
    'pointer-events:none',
  ].join(';');

  const portrait = document.createElement('div');
  portrait.style.cssText = [
    'position:relative',
    'height:clamp(74px,17vh,150px)',
    'overflow:hidden',
    'border:1px solid rgba(255,255,255,.16)',
    'background:rgba(5,7,12,.78)',
  ].join(';');
  const portraitFallback = document.createElement('span');
  portraitFallback.setAttribute('aria-hidden', 'true');
  portraitFallback.style.cssText = [
    'position:absolute',
    'inset:0',
    'display:grid',
    'place-items:center',
    'font:700 clamp(24px,6vw,56px)/1 serif',
    'color:#b8757e',
  ].join(';');
  const portraitImage = document.createElement('img');
  let failedPortraitUrl: string | undefined;
  portraitImage.decoding = 'async';
  portraitImage.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center bottom';
  portraitImage.addEventListener('error', () => {
    failedPortraitUrl = portraitImage.getAttribute('src') ?? undefined;
    portraitImage.hidden = true;
    portraitFallback.hidden = false;
  });
  portrait.append(portraitFallback, portraitImage);

  const copy = document.createElement('div');
  copy.style.cssText = 'align-self:center;min-width:0';
  const speaker = document.createElement('strong');
  speaker.style.cssText = 'display:block;margin:0 0 .45rem;color:#e7b1b8;font-size:clamp(12px,1.8vw,18px);letter-spacing:.08em;text-transform:uppercase';
  const text = document.createElement('p');
  text.style.cssText = 'margin:0;font:500 clamp(14px,2.2vw,22px)/1.45 Georgia,serif;text-wrap:pretty';
  const choices = document.createElement('ol');
  choices.setAttribute('aria-label', 'Opciones de diálogo');
  choices.style.cssText = [
    'display:grid',
    'gap:.45rem',
    'margin:.8rem 0 0',
    'padding:0',
    'list-style:none',
  ].join(';');
  copy.append(speaker, text, choices);
  element.append(portrait, copy);
  container.appendChild(element);
  let renderedKey = '';

  return {
    element,
    render(state): void {
      const nextKey = state
        ? `${state.kind ?? 'dialogue'}\u0000${state.speaker ?? ''}\u0000${state.text}\u0000${state.portraitUrl ?? ''}\u0000${state.endingId ?? ''}\u0000${JSON.stringify(state.choices ?? [])}`
        : '';
      if (nextKey === renderedKey) return;
      renderedKey = nextKey;
      if (!state) {
        element.hidden = true;
        portraitImage.removeAttribute('src');
        return;
      }
      speaker.textContent = state.speaker ?? '';
      speaker.hidden = !state.speaker;
      text.textContent = state.text;
      element.dataset.kind = state.kind ?? 'dialogue';
      choices.replaceChildren();
      for (const choice of state.choices ?? []) {
        const item = document.createElement('li');
        item.dataset.choiceId = choice.id;
        item.dataset.selected = String(choice.selected);
        item.setAttribute('aria-current', choice.selected ? 'true' : 'false');
        item.textContent = `${choice.selected ? '▶' : ' '} ${choice.text}`;
        item.style.cssText = [
          'padding:.35rem .55rem',
          'border-left:3px solid',
          choice.selected ? 'border-color:#e7b1b8' : 'border-color:transparent',
          choice.selected ? 'background:rgba(184,117,126,.18)' : 'background:transparent',
          choice.selected ? 'color:#fff7f2' : 'color:#d6c8c5',
          'font:600 clamp(13px,1.8vw,18px)/1.35 system-ui,-apple-system,sans-serif',
        ].join(';');
        choices.appendChild(item);
      }
      choices.hidden = choices.childElementCount === 0;
      portraitFallback.textContent = initial(state.speaker);
      if (state.portraitUrl && failedPortraitUrl !== state.portraitUrl) {
        portraitImage.alt = state.portraitAlt ?? state.speaker ?? 'Character portrait';
        portraitImage.hidden = false;
        portraitFallback.hidden = true;
        if (portraitImage.getAttribute('src') !== state.portraitUrl) {
          failedPortraitUrl = undefined;
          portraitImage.src = state.portraitUrl;
        }
      } else {
        portraitImage.removeAttribute('src');
        portraitImage.hidden = true;
        portraitFallback.hidden = false;
      }
      element.hidden = false;
    },
    destroy(): void {
      element.remove();
    },
  };
}
