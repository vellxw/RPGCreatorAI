import { CircleAlert, CircleCheck, Plug, Sparkles, TriangleAlert } from 'lucide-react';
import type { ProviderConfig } from '../../types/project';

export type ProviderAvailabilityState =
  | 'ready'
  | 'mock-only'
  | 'needs-credentials'
  | 'no-providers';

export interface ProviderAvailabilityView {
  state: ProviderAvailabilityState;
  readyProviderIds: string[];
  mockProviderIds: string[];
  unconfiguredProviderIds: string[];
}

export function selectProviderAvailability(
  providers: ProviderConfig[],
): ProviderAvailabilityView {
  const enabled = providers.filter((p) => p.enabled);
  const mockIds = enabled
    .filter((p) => p.credentialState === 'not-required' && p.status === 'configured')
    .map((p) => p.id);
  const readyIds = enabled
    .filter(
      (p) =>
        p.status === 'configured' &&
        p.credentialState !== 'missing' &&
        p.credentialState !== 'not-required',
    )
    .map((p) => p.id);
  const unconfiguredIds = enabled
    .filter((p) => p.status === 'missing-credentials' || p.credentialState === 'missing')
    .map((p) => p.id);

  let state: ProviderAvailabilityState;
  if (enabled.length === 0) {
    state = 'no-providers';
  } else if (readyIds.length > 0) {
    state = 'ready';
  } else if (unconfiguredIds.length > 0) {
    state = 'needs-credentials';
  } else {
    state = 'mock-only';
  }

  return {
    state,
    readyProviderIds: readyIds,
    mockProviderIds: mockIds,
    unconfiguredProviderIds: unconfiguredIds,
  };
}

export interface ProviderAvailabilityBannerProps {
  view: ProviderAvailabilityView;
  onOpenSettings: () => void;
  onSelectProvider: (providerId: string) => void;
}

function pickBannerIcon(state: ProviderAvailabilityState) {
  if (state === 'mock-only') return <Sparkles size={16} className="text-indigo-600" />;
  if (state === 'needs-credentials') return <TriangleAlert size={16} className="text-amber-600" />;
  if (state === 'no-providers') return <Plug size={16} className="text-gray-500" />;
  return null;
}

export function ProviderAvailabilityBanner({
  view,
  onOpenSettings,
  onSelectProvider,
}: ProviderAvailabilityBannerProps) {
  if (view.state === 'ready') return null;

  if (view.state === 'mock-only') {
    return (
      <section
        role="status"
        data-testid="provider-availability-banner"
        data-state="mock-only"
        className="rounded-md border border-indigo-200 bg-indigo-50/70 p-3"
      >
        <div className="flex items-start gap-2.5">
          {pickBannerIcon(view.state)}
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-gray-800">
              Running on local mock providers
            </p>
            <p className="mt-1 text-[12px] leading-5 text-gray-600">
              Live generation is not configured. AI Studio uses local mock contracts for drafts
              and previews. Configure a provider in Settings to enable live generation.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <select
                data-action="select-provider"
                aria-label="Active provider"
                defaultValue={view.mockProviderIds[0] ?? ''}
                onChange={(e) => onSelectProvider(e.target.value)}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-[12px] text-gray-700"
              >
                {view.mockProviderIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
                {view.unconfiguredProviderIds.map((id) => (
                  <option key={id} value={id} disabled>
                    {id} (no credentials)
                  </option>
                ))}
              </select>
              <button
                type="button"
                data-action="open-settings"
                onClick={onOpenSettings}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-[12px] text-gray-700 hover:border-indigo-300"
              >
                Open Settings
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (view.state === 'needs-credentials') {
    return (
      <section
        role="status"
        data-testid="provider-availability-banner"
        data-state="needs-credentials"
        className="rounded-md border border-amber-200 bg-amber-50/70 p-3"
      >
        <div className="flex items-start gap-2.5">
          {pickBannerIcon(view.state)}
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-gray-800">
              Provider credentials required
            </p>
            <p className="mt-1 text-[12px] leading-5 text-gray-600">
              One or more providers are enabled but missing credentials. Local mock workflows
              remain available until credentials are added in Settings. Credentials are stored
              through the credential adapter and are never displayed in this UI.
            </p>
            <div className="mt-2 flex items-center gap-2">
              {view.unconfiguredProviderIds.map((id) => (
                <span
                  key={id}
                  data-testid="unconfigured-provider"
                  className="rounded bg-white px-2 py-0.5 text-[11px] text-gray-700 border border-gray-200"
                >
                  {id}
                </span>
              ))}
              <button
                type="button"
                data-action="open-settings"
                onClick={onOpenSettings}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-[12px] text-gray-700 hover:border-indigo-300"
              >
                <CircleAlert size={12} className="mr-1 inline-block" />
                Open Settings
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // no-providers
  return (
    <section
      role="status"
      data-testid="provider-availability-banner"
      data-state="no-providers"
      className="rounded-md border border-gray-200 bg-gray-50 p-3"
    >
      <div className="flex items-start gap-2.5">
        {pickBannerIcon(view.state)}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-gray-800">No providers configured</p>
          <p className="mt-1 text-[12px] leading-5 text-gray-600">
            Add a provider in Settings to enable live AI generation. Local mock workflows
            remain available as a safe default.
          </p>
          <div className="mt-2">
            <button
              type="button"
              data-action="open-settings"
              onClick={onOpenSettings}
              className="rounded border border-gray-200 bg-white px-2 py-1 text-[12px] text-gray-700 hover:border-indigo-300"
            >
              <CircleCheck size={12} className="mr-1 inline-block" />
              Open Settings
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
