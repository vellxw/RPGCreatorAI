/**
 * Phase 12 M04 — Per-Pipeline Model Defaults (PX-092, FRA-531).
 *
 * Read-only list of the resolved workflow routes for the active creator
 * mode. The host owns the override editing through a separate advanced
 * panel; this component stays inert and never mutates provider state on
 * its own.
 */

import type { ReactNode } from 'react';
import type { ResolvedWorkflowRoute } from '../../providers/providerMode';
import { Badge } from '../ui/Badge';

export interface PerPipelineModelDefaultsProps {
  routes: readonly ResolvedWorkflowRoute[];
  'data-testid'?: string;
}

function sourceLabel(source: ResolvedWorkflowRoute['source']): string {
  switch (source) {
    case 'recommended':
      return 'Recommended';
    case 'fast-cheap':
      return 'Fast/cheap';
    case 'best-quality':
      return 'Best quality';
    case 'local-mock':
      return 'Local / mock';
    case 'custom-advanced':
      return 'Custom advanced';
    case 'override':
      return 'Custom override';
    case 'fallback-local':
      return 'Local fallback';
    default:
      return 'Default';
  }
}

export function PerPipelineModelDefaults({
  routes,
  'data-testid': testId = 'per-pipeline-model-defaults',
}: PerPipelineModelDefaultsProps): ReactNode {
  return (
    <section
      data-testid={testId}
      aria-label="Resolved per-pipeline model defaults"
      className="rounded-md border border-gray-200 bg-white p-4"
    >
      <header className="mb-3 flex flex-col gap-1">
        <h3 className="text-[13px] font-semibold text-gray-800">Per-workflow model defaults</h3>
        <p className="text-[11px] leading-4 text-gray-500">
          The active creator mode resolves to one provider/model per workflow. Use the advanced
          panel below to change a single workflow.
        </p>
      </header>
      <ul className="space-y-1.5" data-testid={`${testId}-list`}>
        {routes.map(route => (
          <li
            key={route.workflowId}
            data-testid={`${testId}-row-${route.workflowId}`}
            data-pipeline={route.workflowId}
            data-source={route.source}
            data-free={route.free ? 'true' : 'false'}
            className="flex items-center justify-between gap-3 rounded border border-gray-100 bg-gray-50 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium text-gray-700">{route.label}</p>
              <p className="mt-0.5 truncate text-[11px] leading-4 text-gray-500">
                {route.providerName} · {route.modelLabel}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={route.free ? 'success' : 'warning'}>
                {route.free ? 'Free' : 'Paid'}
              </Badge>
              <Badge variant="muted">{sourceLabel(route.source)}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
