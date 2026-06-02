import { Route } from 'lucide-react';
import { Badge } from '../ui/Badge';
import {
  buildProviderCapabilityGates,
  type ModelCapabilityDescriptor,
} from '../../providers/modelCapabilityRegistry';
import type { ProviderConfig } from '../../types/project';

interface ProviderCapabilityGatesPanelProps {
  providers: ProviderConfig[];
  registry?: ModelCapabilityDescriptor[];
}

export function ProviderCapabilityGatesPanel({ providers, registry }: ProviderCapabilityGatesPanelProps) {
  const gates = buildProviderCapabilityGates(providers, registry);
  const readyCount = gates.filter(gate => gate.available).length;

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Route size={15} className="text-indigo-600" />
            <h3 className="text-[13px] font-semibold text-gray-800">Capability Gates</h3>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-gray-500">
            Availability is driven by model capabilities, not provider names.
          </p>
        </div>
        <Badge variant={readyCount > 0 ? 'success' : 'muted'} dot>{readyCount} ready</Badge>
      </div>

      <div className="space-y-1.5">
        {gates.map(gate => (
          <div key={gate.id} className="rounded border border-gray-100 bg-gray-50 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-gray-700">{gate.label}</span>
              <Badge variant={gate.available ? 'success' : 'muted'}>
                {gate.available ? 'Ready' : 'Unavailable'}
              </Badge>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-gray-500">
              {gate.providerName && gate.modelId
                ? `${gate.providerName} · ${gate.modelId}`
                : gate.reason}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
