import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Power,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { AIRequestQueuePanel } from '../components/ai/AIRequestQueuePanel';
import { ProviderCapabilityGatesPanel } from '../components/ai/ProviderCapabilityGatesPanel';
import {
  defaultProviderConfigs,
  providerStatusFor,
  providerWithEnabled,
  type ProviderStoreValue,
} from '../stores/providerStore';
import { useAiRequestQueue, type AiRequestQueueState } from '../stores/aiRequestQueueStore';
import type { ProviderConfig } from '../types/project';
import {
  getCredentialStoreAdapter,
  type CredentialStoreAdapter,
} from '../adapters/CredentialStoreAdapter';
import type { CredentialStatus } from '../adapters/types';
import { redactSecrets } from '../security/redaction';

interface SettingsScreenProps {
  providerStore?: Pick<ProviderStoreValue, 'providers' | 'setProviders'>;
  initialProviders?: ProviderConfig[];
  credentialStore?: CredentialStoreAdapter;
  aiQueueStore?: {
    queue: AiRequestQueueState;
    cancel: (jobId: string) => void;
    retry: (jobId: string) => void;
  };
}

function cloneProviders(providers: ProviderConfig[]): ProviderConfig[] {
  return providers.map(provider => ({
    ...provider,
    capabilities: [...provider.capabilities],
  }));
}

function statusMeta(provider: ProviderConfig): {
  label: string;
  badge: 'success' | 'warning' | 'muted';
  icon: typeof CheckCircle2;
} {
  const status = providerStatusFor(provider);
  if (status === 'configured') {
    return { label: 'Configured', badge: 'success', icon: CheckCircle2 };
  }
  if (status === 'missing-credentials') {
    return { label: 'Needs credentials', badge: 'warning', icon: AlertTriangle };
  }
  return { label: 'Disabled', badge: 'muted', icon: Power };
}

function capabilityClass(provider: ProviderConfig): string {
  const status = providerStatusFor(provider);
  if (status === 'configured') return 'border-green-100 bg-green-50 text-green-700';
  if (status === 'missing-credentials') return 'border-amber-100 bg-amber-50 text-amber-800';
  return 'border-gray-200 bg-gray-50 text-gray-500';
}

export function SettingsScreen({ providerStore, initialProviders, credentialStore, aiQueueStore }: SettingsScreenProps) {
  const [localProviders, setLocalProviders] = useState<ProviderConfig[]>(() =>
    cloneProviders(initialProviders ?? defaultProviderConfigs),
  );
  const activeCredentialStore = useMemo(
    () => credentialStore ?? getCredentialStoreAdapter(),
    [credentialStore],
  );
  const providers = providerStore?.providers ?? localProviders;
  const setProviders = providerStore?.setProviders ?? setLocalProviders;
  const [credentialStatuses, setCredentialStatuses] = useState<Record<string, CredentialStatus>>({});
  const [credentialInputs, setCredentialInputs] = useState<Record<string, string>>({});
  const [credentialFeedback, setCredentialFeedback] = useState<Record<string, string>>({});
  const internalAiQueue = useAiRequestQueue();
  const activeAiQueue = aiQueueStore ?? internalAiQueue;

  useEffect(() => {
    let cancelled = false;
    Promise.all(providers.map(provider => activeCredentialStore.getStatus(provider.id)))
      .then(statuses => {
        if (cancelled) return;
        setCredentialStatuses(Object.fromEntries(statuses.map(status => [status.providerId, status])));
      })
      .catch(error => {
        if (cancelled) return;
        setCredentialFeedback({
          _global: redactSecrets((error as Error).message),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [activeCredentialStore, providers]);

  const providerWithCredentialStatus = (provider: ProviderConfig): ProviderConfig => {
    const status = credentialStatuses[provider.id];
    const credentialState: ProviderConfig['credentialState'] =
      provider.credentialState === 'not-required'
        ? 'not-required'
        : status?.configured
          ? 'configured'
          : status
            ? 'missing'
            : provider.credentialState;
    const next = { ...provider, credentialState };
    return { ...next, status: providerStatusFor(next) };
  };

  const summary = useMemo(() => {
    const configured = providers.filter(provider => providerStatusFor(providerWithCredentialStatus(provider)) === 'configured').length;
    const missing = providers.filter(provider => providerStatusFor(providerWithCredentialStatus(provider)) === 'missing-credentials').length;
    return { configured, missing, total: providers.length };
  }, [credentialStatuses, providers]);

  const updateProvider = (id: string, map: (provider: ProviderConfig) => ProviderConfig) => {
    setProviders(prev => prev.map(provider => (provider.id === id ? map(provider) : provider)));
  };

  const toggleProvider = (id: string) => {
    updateProvider(id, provider => providerWithEnabled(provider, !provider.enabled));
  };

  const updateModel = (id: string, model: string) => {
    updateProvider(id, provider => ({
      ...provider,
      model: model.trim(),
      status: providerStatusFor(provider),
    }));
  };

  const setCredentialInput = (providerId: string, value: string) => {
    setCredentialInputs(prev => ({ ...prev, [providerId]: value }));
  };

  const saveCredential = async (provider: ProviderConfig) => {
    const secret = credentialInputs[provider.id] ?? '';
    if (!secret.trim()) {
      setCredentialFeedback(prev => ({ ...prev, [provider.id]: 'Credential value is required.' }));
      return;
    }
    const result = await activeCredentialStore.setCredential(provider.id, secret);
    setCredentialInputs(prev => ({ ...prev, [provider.id]: '' }));
    if (!result.success) {
      setCredentialFeedback(prev => ({
        ...prev,
        [provider.id]: result.error ? redactSecrets(result.error, [secret]) : 'Credential storage failed.',
      }));
      return;
    }
    if (result.status) {
      setCredentialStatuses(prev => ({ ...prev, [provider.id]: result.status! }));
    }
    setCredentialFeedback(prev => ({ ...prev, [provider.id]: 'Credential stored locally.' }));
  };

  const deleteCredential = async (provider: ProviderConfig) => {
    const status = await activeCredentialStore.deleteCredential(provider.id);
    setCredentialStatuses(prev => ({ ...prev, [provider.id]: status }));
    setCredentialInputs(prev => ({ ...prev, [provider.id]: '' }));
    setCredentialFeedback(prev => ({ ...prev, [provider.id]: 'Credential removed.' }));
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f5f7]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 pb-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Settings2 size={18} className="text-indigo-600" />
              <h2 className="text-[18px] font-bold text-gray-800">Provider Settings</h2>
            </div>
            <p className="max-w-2xl text-[12px] leading-5 text-gray-600">
              Providers are optional editor tooling. Maps, database, assets, and playtest stay available with no providers configured.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info" dot>Editor-only</Badge>
            <Badge variant="muted">Runtime independent</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="flex min-w-0 flex-col gap-3">
            {providers.length === 0 ? (
              <div role="status" className="rounded-md border border-dashed border-gray-300 bg-white px-4 py-5">
                <p className="text-[13px] font-semibold text-gray-800">No providers configured</p>
                <p className="mt-1 text-[12px] text-gray-500">
                  Local authoring remains active; provider-backed commands stay hidden until a configured capability is available.
                </p>
              </div>
            ) : (
              providers.map(rawProvider => {
                const provider = providerWithCredentialStatus(rawProvider);
                const meta = statusMeta(provider);
                const StatusIcon = meta.icon;
                const status = providerStatusFor(provider);
                const credentialStatus = credentialStatuses[provider.id];
                const credentialUnavailable = !activeCredentialStore.isAvailable();
                const credentialValue = credentialInputs[provider.id] ?? '';
                return (
                  <article key={provider.id} className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[14px] font-semibold text-gray-800">{provider.name}</h3>
                          <Badge variant={meta.badge} dot>{meta.label}</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <KeyRound size={13} />
                            {provider.credentialEnvVar
                              ? `Credential source: ${provider.credentialEnvVar}`
                              : 'Credential source: not required'}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <StatusIcon size={13} />
                            Runtime impact: none
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={`${provider.enabled ? 'Disable' : 'Enable'} ${provider.name} provider`}
                        onClick={() => toggleProvider(provider.id)}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium ${
                          provider.enabled
                            ? 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                            : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                        }`}
                      >
                        <Power size={13} />
                        {provider.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase text-gray-500">Capabilities</div>
                        <div className="flex flex-wrap gap-1.5">
                          {provider.capabilities.length > 0 ? (
                            provider.capabilities.map(capability => (
                              <span
                                key={capability}
                                className={`rounded border px-2 py-0.5 text-[11px] font-medium ${capabilityClass(provider)}`}
                              >
                                {capability}
                              </span>
                            ))
                          ) : (
                            <span className="text-[12px] text-gray-400">No capabilities declared</span>
                          )}
                        </div>
                      </div>
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">Model label</span>
                        <input
                          aria-label={`Model for ${provider.name}`}
                          value={provider.model}
                          disabled={!provider.enabled}
                          onChange={event => updateModel(provider.id, event.target.value)}
                          placeholder={status === 'configured' ? 'Configured model' : 'Optional'}
                          className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-[12px] text-gray-700 disabled:bg-gray-50 disabled:text-gray-400"
                        />
                      </label>
                    </div>
                    {provider.credentialEnvVar && (
                      <div className="mt-3 rounded-md border border-gray-100 bg-gray-50 p-3">
                        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                          <label className="block">
                            <span className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">Credential</span>
                            <input
                              aria-label={`Credential for ${provider.name}`}
                              type="password"
                              autoComplete="off"
                              value={credentialValue}
                              disabled={!provider.enabled || credentialUnavailable}
                              onChange={event => setCredentialInput(provider.id, event.target.value)}
                              placeholder={
                                credentialStatus?.configured
                                  ? 'Stored locally'
                                  : credentialUnavailable
                                    ? 'Desktop storage unavailable'
                                    : 'Paste credential'
                              }
                              className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-[12px] text-gray-700 disabled:bg-gray-100 disabled:text-gray-400"
                            />
                          </label>
                          <button
                            type="button"
                            disabled={!provider.enabled || credentialUnavailable || !credentialValue.trim()}
                            onClick={() => saveCredential(provider)}
                            className="mt-5 inline-flex h-8 items-center justify-center rounded-md border border-gray-200 bg-white px-2.5 text-[12px] font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Save Credential
                          </button>
                          <button
                            type="button"
                            disabled={!provider.enabled || credentialUnavailable || !credentialStatus?.configured}
                            onClick={() => deleteCredential(provider)}
                            className="mt-5 inline-flex h-8 items-center justify-center rounded-md border border-gray-200 bg-white px-2.5 text-[12px] font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Forget
                          </button>
                        </div>
                        <div className="mt-2 text-[11px] text-gray-500">
                          {credentialFeedback[provider.id] ??
                            (credentialUnavailable
                              ? activeCredentialStore.getUnavailableReason()
                              : credentialStatus?.configured
                                ? 'Credential is stored outside project data.'
                                : 'No credential stored.')}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </section>

        <aside className="flex flex-col gap-3">
          <div className="rounded-md border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <SlidersHorizontal size={15} className="text-indigo-600" />
                <h3 className="text-[13px] font-semibold text-gray-800">Availability</h3>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded border border-gray-100 bg-gray-50 px-2 py-2">
                  <dt className="text-[10px] uppercase text-gray-400">Total</dt>
                  <dd className="text-[16px] font-semibold text-gray-800">{summary.total}</dd>
                </div>
                <div className="rounded border border-green-100 bg-green-50 px-2 py-2">
                  <dt className="text-[10px] uppercase text-green-600">Ready</dt>
                  <dd className="text-[16px] font-semibold text-green-700">{summary.configured}</dd>
                </div>
                <div className="rounded border border-amber-100 bg-amber-50 px-2 py-2">
                  <dt className="text-[10px] uppercase text-amber-700">Missing</dt>
                  <dd className="text-[16px] font-semibold text-amber-800">{summary.missing}</dd>
                </div>
              </dl>
            </div>

            <ProviderCapabilityGatesPanel providers={providers.map(providerWithCredentialStatus)} />

            <div className="rounded-md border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck size={15} className="text-green-600" />
                <h3 className="text-[13px] font-semibold text-gray-800">Safety</h3>
              </div>
              <ul className="space-y-2 text-[12px] leading-5 text-gray-600">
                <li>Secret values are not stored in project data.</li>
                <li>Normal editor validation uses mocks and fixtures.</li>
                <li>Native runtime stays provider-independent.</li>
              </ul>
            </div>

            <AIRequestQueuePanel
              queue={activeAiQueue.queue}
              onCancel={activeAiQueue.cancel}
              onRetry={activeAiQueue.retry}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
