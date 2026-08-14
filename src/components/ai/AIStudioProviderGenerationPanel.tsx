import { useState, type FormEvent, type ReactNode } from 'react';
import type { AiStudioGenerationKind } from '../../providers/aiStudio';

export interface AIStudioProviderGenerationPanelProps {
  disabled?: boolean;
  isGenerating: boolean;
  outcome?: { tone: 'success' | 'error' | 'muted'; message: string } | null;
  selectedMapName?: string | null;
  onGenerate: (kind: AiStudioGenerationKind, prompt: string) => string | null;
}

export function AIStudioProviderGenerationPanel({
  disabled = false,
  isGenerating,
  outcome = null,
  selectedMapName,
  onGenerate,
}: AIStudioProviderGenerationPanelProps): ReactNode {
  const [kind, setKind] = useState<AiStudioGenerationKind>('text');
  const [prompt, setPrompt] = useState('');
  const canSubmit = !disabled && !isGenerating && prompt.trim().length > 0;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    onGenerate(kind, prompt.trim());
  };

  return (
    <section
      data-testid="ai-studio-provider-generation"
      data-provider-mode="offline"
      className="rounded-md border border-indigo-100 bg-indigo-50/40 p-3"
      aria-label="AI provider generation"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-semibold text-gray-800">Generate a review candidate</h2>
          <p className="mt-0.5 text-[11px] leading-4 text-gray-600">
            Local offline mock · deterministic fixture · no credentials or network calls.
          </p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
          Offline safe
        </span>
      </div>

      <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Generation type">
          {(['text', 'image'] as const).map(option => (
            <button
              key={option}
              type="button"
              data-testid={`ai-studio-generation-kind-${option}`}
              aria-pressed={kind === option}
              onClick={() => setKind(option)}
              disabled={isGenerating}
              className={`rounded border px-2 py-1 text-[11px] font-medium ${
                kind === option
                  ? 'border-indigo-300 bg-white text-indigo-700'
                  : 'border-transparent bg-transparent text-gray-600 hover:bg-white/70'
              }`}
            >
              {option === 'text' ? 'Event text' : 'Concept image'}
            </button>
          ))}
        </div>

        <label>
          <span className="sr-only">Generation prompt</span>
          <textarea
            data-testid="ai-studio-generation-prompt"
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
            rows={2}
            maxLength={24_000}
            disabled={disabled || isGenerating}
            placeholder={kind === 'text'
              ? 'Draft a short interaction for the selected map…'
              : 'Describe a concept image for the project…'}
            className="block w-full resize-none rounded border border-gray-200 bg-white p-2 text-[12px] text-gray-800 focus:border-indigo-300 focus:outline-none disabled:bg-gray-100"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] text-gray-500">
            {kind === 'text'
              ? selectedMapName
                ? `Accepting adds a reviewable event to ${selectedMapName}.`
                : 'Select a map before accepting the generated event.'
              : 'Generated image references enter the asset catalog only after acceptance.'}
          </p>
          <button
            type="submit"
            data-testid="ai-studio-generation-submit"
            disabled={!canSubmit}
            className="rounded border border-indigo-500 bg-indigo-600 px-3 py-1.5 text-[11px] font-medium text-white disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-200 disabled:text-gray-500"
          >
            {isGenerating ? 'Generating…' : 'Generate candidate'}
          </button>
        </div>
      </form>

      {outcome ? (
        <p
          role={outcome.tone === 'error' ? 'alert' : 'status'}
          data-testid="ai-studio-generation-outcome"
          data-tone={outcome.tone}
          className={`mt-2 text-[11px] ${
            outcome.tone === 'error'
              ? 'text-red-700'
              : outcome.tone === 'success'
                ? 'text-emerald-700'
                : 'text-gray-600'
          }`}
        >
          {outcome.message}
        </p>
      ) : null}
    </section>
  );
}
