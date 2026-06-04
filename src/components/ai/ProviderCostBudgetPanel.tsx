import { CircleDollarSign, Gauge } from 'lucide-react';
import { buildProviderCostBudgetStates } from '../../providers/providerCostBudget';
import type { ProviderMetadata } from '../../providers/providerRegistry';
import type { ProviderConfig } from '../../types/project';
import { Badge } from '../ui/Badge';

interface ProviderCostBudgetPanelProps {
  providers: ProviderConfig[];
  registry?: ProviderMetadata[];
}

function costVariant(label: string): 'success' | 'warning' | 'muted' {
  if (label === 'Free/offline') return 'success';
  if (label === 'Cost unknown') return 'warning';
  return 'muted';
}

function formatEstimatedCost(estimatedUsd: number | undefined): string | null {
  return estimatedUsd === undefined ? null : `$${estimatedUsd.toFixed(2)}`;
}

export function ProviderCostBudgetPanel({ providers, registry }: ProviderCostBudgetPanelProps) {
  const states = buildProviderCostBudgetStates(providers, registry);
  const confirmationCount = states.filter(state => state.budget.requiresConfirmation).length;

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CircleDollarSign size={15} className="text-emerald-600" />
            <h3 className="text-[13px] font-semibold text-gray-800">Cost & Budget</h3>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-gray-500">
            Unknown pricing stays visible before any provider-backed editor work.
          </p>
        </div>
        <Badge variant={confirmationCount > 0 ? 'warning' : 'success'} dot>
          {confirmationCount} confirm
        </Badge>
      </div>

      {states.length === 0 ? (
        <div className="rounded border border-dashed border-gray-200 bg-gray-50 px-3 py-3">
          <p className="text-[12px] font-medium text-gray-700">No provider budget state</p>
          <p className="mt-1 text-[11px] leading-4 text-gray-500">
            Local authoring has no provider cost exposure.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {states.map(state => (
            <article key={state.providerId} className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-gray-800">{state.providerName}</p>
                  <p className="mt-1 text-[11px] leading-4 text-gray-500">{state.cost.detail}</p>
                  {formatEstimatedCost(state.cost.estimatedUsd) && (
                    <p className="mt-1 text-[11px] font-medium leading-4 text-gray-700">
                      Estimated before execution: {formatEstimatedCost(state.cost.estimatedUsd)}
                      {state.cost.currency ? ` ${state.cost.currency}` : ''}
                    </p>
                  )}
                </div>
                <Badge variant={costVariant(state.cost.label)}>{state.cost.label}</Badge>
              </div>

              <div className="mt-2 grid gap-1.5">
                <div className="flex items-start gap-1.5 text-[11px] leading-4 text-gray-600">
                  <Gauge size={12} className="mt-0.5 flex-shrink-0 text-gray-400" />
                  <span>
                    <span className="font-medium text-gray-700">{state.rateLimit.label}</span>
                    {' · '}
                    {state.rateLimit.retryGuidance}
                  </span>
                </div>
                <div className="rounded border border-gray-200 bg-white px-2 py-1.5 text-[11px] leading-4 text-gray-600">
                  <span className="font-medium text-gray-700">{state.budget.label}</span>
                  <span> · {state.budget.detail}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
