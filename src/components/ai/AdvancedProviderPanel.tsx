/**
 * Phase 12 M04 — Advanced Provider Panel (PX-091, PX-098, FRA-528, FRA-538).
 *
 * Editor surface that lives behind the Custom advanced mode boundary. Lets
 * creators override the provider/model for a single workflow at a time, with
 * explicit creator-facing copy and a "clear override" affordance. The host
 * owns the provider list, the per-workflow override list, and the dispatch
 * to the provider store. The panel never mutates provider configuration
 * directly; it only emits the new override through `onSetOverride` and
 * `onClearOverride`.
 */

import { useMemo, type ReactNode } from 'react';
import { providerWorkflowDefinitions } from '../../providers/modelCapabilityRegistry';
import type { ProviderConfig } from '../../types/project';
import type { ProviderMetadata } from '../../providers/providerRegistry';
import { Badge } from '../ui/Badge';

export interface AdvancedProviderPanelProps {
  providers: readonly ProviderConfig[];
  registry: readonly ProviderMetadata[];
  overrides: ReadonlyArray<{ workflowId: string; providerId: string; modelId: string }>;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  onSetOverride: (override: { workflowId: string; providerId: string; modelId: string }) => void;
  onClearOverride: (workflowId: string) => void;
  onClearAll: () => void;
  'data-testid'?: string;
}

function routableProviderIds(
  providers: readonly ProviderConfig[],
  registry: readonly ProviderMetadata[],
): ProviderMetadata[] {
  return registry.filter(meta => {
    if (meta.id === 'opencode') return true;
    const provider = providers.find(p => p.id === meta.id);
    if (!provider) return false;
    return provider.enabled && provider.credentialState !== 'missing';
  });
}

export function AdvancedProviderPanel({
  providers,
  registry,
  overrides,
  isOpen,
  onToggle,
  onSetOverride,
  onClearOverride,
  onClearAll,
  'data-testid': testId = 'advanced-provider-panel',
}: AdvancedProviderPanelProps): ReactNode {
  const routable = useMemo(() => routableProviderIds(providers, registry), [providers, registry]);

  return (
    <section
      data-testid={testId}
      data-state={isOpen ? 'open' : 'closed'}
      data-override-count={overrides.length}
      aria-label="Advanced provider overrides"
      className="rounded-md border border-gray-200 bg-white p-4"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-gray-800">Custom advanced</h3>
          <p className="mt-1 text-[11px] leading-4 text-gray-500">
            Override the provider or model for a single workflow without changing the rest.
            Local workflows and your project files are not affected.
          </p>
        </div>
        <button
          type="button"
          data-testid={`${testId}-toggle`}
          data-action="toggle"
          aria-expanded={isOpen}
          onClick={() => onToggle(!isOpen)}
          className="rounded border border-gray-200 bg-white px-2 py-1 text-[12px] text-gray-700 hover:border-indigo-300"
        >
          {isOpen ? 'Hide advanced' : 'Show advanced'}
        </button>
      </header>
      {isOpen ? (
        <div className="mt-3 space-y-2" data-testid={`${testId}-body`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] leading-4 text-gray-500">
              Pick a workflow, then choose a provider and model. Empty model fields fall back to
              the active creator mode.
            </p>
            <button
              type="button"
              data-testid={`${testId}-clear-all`}
              data-action="clear-all"
              disabled={overrides.length === 0}
              onClick={onClearAll}
              className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 hover:border-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear all overrides
            </button>
          </div>
          {providerWorkflowDefinitions.map(workflow => {
            const override = overrides.find(o => o.workflowId === workflow.id);
            return (
              <div
                key={workflow.id}
                data-testid={`${testId}-workflow-${workflow.id}`}
                data-overridden={override ? 'true' : 'false'}
                className="rounded border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-medium text-gray-700">{workflow.label}</p>
                  {override ? (
                    <Badge variant="warning" dot>Overridden</Badge>
                  ) : (
                    <Badge variant="muted">From active mode</Badge>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="text-[11px] text-gray-500">
                    Provider
                    <select
                      data-testid={`${testId}-select-provider-${workflow.id}`}
                      className="ml-1 rounded border border-gray-200 bg-white px-2 py-1 text-[12px] text-gray-800"
                      value={override?.providerId ?? ''}
                      onChange={(event) => {
                        const providerId = event.target.value;
                        if (!providerId) {
                          onClearOverride(workflow.id);
                          return;
                        }
                        onSetOverride({
                          workflowId: workflow.id,
                          providerId,
                          modelId: override?.modelId ?? '',
                        });
                      }}
                    >
                      <option value="">Default (from mode)</option>
                      {routable.map(meta => (
                        <option key={meta.id} value={meta.id}>{meta.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[11px] text-gray-500">
                    Model
                    <input
                      data-testid={`${testId}-input-model-${workflow.id}`}
                      type="text"
                      placeholder="(default model)"
                      className="ml-1 rounded border border-gray-200 bg-white px-2 py-1 text-[12px] text-gray-800"
                      value={override?.modelId ?? ''}
                      onChange={(event) => {
                        const modelId = event.target.value.trim();
                        if (!override) return;
                        if (modelId.length === 0) {
                          onClearOverride(workflow.id);
                          return;
                        }
                        onSetOverride({ workflowId: workflow.id, providerId: override.providerId, modelId });
                      }}
                    />
                  </label>
                  {override ? (
                    <button
                      type="button"
                      data-testid={`${testId}-clear-${workflow.id}`}
                      data-action="clear"
                      onClick={() => onClearOverride(workflow.id)}
                      className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 hover:border-indigo-300"
                    >
                      Clear override
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
