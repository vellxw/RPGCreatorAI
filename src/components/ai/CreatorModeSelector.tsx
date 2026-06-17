/**
 * Phase 12 M04 — Creator Mode Selector (PX-086, FRA-525).
 *
 * Presentational component that surfaces the five creator-first provider
 * modes (Recommended, Fast/cheap, Best quality, Local/mock, Custom
 * advanced). The host owns the dispatch; this component stays inert and
 * never mutates provider configuration directly.
 */

import type { ReactNode } from 'react';
import {
  CREATOR_MODE_DESCRIPTORS,
  type CreatorProviderMode,
  type ResolvedWorkflowRoute,
} from '../../providers/providerMode';
import { Badge } from '../ui/Badge';

export interface CreatorModeSelectorProps {
  selectedMode: CreatorProviderMode;
  onSelect: (mode: CreatorProviderMode) => void;
  resolvedRoutes?: readonly ResolvedWorkflowRoute[];
  'data-testid'?: string;
}

function freeRouteCount(routes: readonly ResolvedWorkflowRoute[]): number {
  return routes.filter(r => r.free).length;
}

function paidRouteCount(routes: readonly ResolvedWorkflowRoute[]): number {
  return routes.filter(r => !r.free).length;
}

export function CreatorModeSelector({
  selectedMode,
  onSelect,
  resolvedRoutes,
  'data-testid': testId = 'creator-mode-selector',
}: CreatorModeSelectorProps): ReactNode {
  return (
    <section
      data-testid={testId}
      data-state={selectedMode}
      data-mode={selectedMode}
      aria-label="Creator AI mode"
      className="rounded-md border border-gray-200 bg-white p-4"
    >
      <header className="mb-3 flex flex-col gap-1">
        <h2 className="text-[13px] font-semibold text-gray-800">Choose AI mode</h2>
        <p className="text-[11px] leading-4 text-gray-500">
          Pick a mode that matches what you want from AI. You can switch any time. Local
          workflows and your project files are always available.
        </p>
      </header>
      <ul
        role="radiogroup"
        aria-label="Creator AI mode options"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {CREATOR_MODE_DESCRIPTORS.map(descriptor => {
          const isSelected = descriptor.id === selectedMode;
          return (
            <li key={descriptor.id} role="presentation">
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                data-testid={`${testId}-option-${descriptor.id}`}
                data-mode={descriptor.id}
                data-selected={isSelected ? 'true' : 'false'}
                onClick={() => onSelect(descriptor.id)}
                className={
                  'flex w-full flex-col items-start gap-1 rounded-md border p-3 text-left transition ' +
                  (isSelected
                    ? 'border-indigo-400 bg-indigo-50/40'
                    : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30')
                }
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-gray-800">{descriptor.label}</span>
                  {isSelected ? (
                    <Badge variant="success" dot>Selected</Badge>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wide text-gray-400">Tap to choose</span>
                  )}
                </div>
                <p className="text-[12px] leading-5 text-gray-700">{descriptor.beginnerSummary}</p>
                <p className="text-[11px] leading-4 text-gray-500">{descriptor.detail}</p>
              </button>
            </li>
          );
        })}
      </ul>
      {resolvedRoutes ? (
        <p
          className="mt-3 text-[11px] leading-4 text-gray-500"
          data-testid={`${testId}-summary`}
          data-free-routes={freeRouteCount(resolvedRoutes)}
          data-paid-routes={paidRouteCount(resolvedRoutes)}
        >
          {freeRouteCount(resolvedRoutes)} free routes · {paidRouteCount(resolvedRoutes)} paid routes
        </p>
      ) : null}
    </section>
  );
}
