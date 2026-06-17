/**
 * Phase 12 M03 — Command Router Clarification Card (PX-081, FRA-515).
 *
 * Presentational surface that renders a `CommandRouterClarification` payload
 * produced by the router. Lists every available option as an inert
 * `onSelect` affordance. Never mutates the project, never calls a provider,
 * never performs programmatic navigation. The host owns the dispatch.
 */

import type { ReactNode } from 'react';
import type { CommandRouterClarification } from './ambiguity';

export interface ClarificationCardProps {
  clarification: CommandRouterClarification;
  onSelect?: (optionId: string, pipeline: string) => void;
  'data-testid'?: string;
}

export function ClarificationCard({
  clarification,
  onSelect,
  'data-testid': testId = 'command-router-clarification',
}: ClarificationCardProps): ReactNode {
  return (
    <section
      data-testid={testId}
      data-state="clarification"
      data-option-count={clarification.options.length}
      aria-label="Clarification request from the AI Studio router"
      className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50/40 p-3"
    >
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
          Need a little more context
        </p>
        <p className="text-[13px] font-semibold text-gray-800">{clarification.question}</p>
        {clarification.contextMessage ? (
          <p
            className="text-[12px] leading-5 text-gray-600"
            data-testid={`${testId}-context`}
          >
            You said: <span className="italic">“{clarification.contextMessage}”</span>
          </p>
        ) : null}
      </header>
      <ul
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        role="list"
        aria-label="Clarification options"
      >
        {clarification.options.map((option) => (
          <li key={option.id} role="listitem">
            <button
              type="button"
              data-testid={`${testId}-option-${option.id}`}
              data-option-id={option.id}
              data-pipeline={option.pipeline}
              onClick={() => onSelect?.(option.id, option.pipeline)}
              className="w-full rounded-md border border-gray-200 bg-white p-3 text-left transition hover:border-amber-300 hover:bg-amber-50"
            >
              <p className="text-[12px] font-semibold text-gray-800">{option.label}</p>
              <p className="mt-1 text-[11px] leading-5 text-gray-500">{option.detail}</p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
