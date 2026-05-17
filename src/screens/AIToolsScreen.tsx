import { useState, type ReactNode } from 'react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { useProviderStore } from '../stores/providerStore';
import {
  Play,
  RefreshCw,
  HelpCircle,
  ChevronRight,
  ExternalLink,
  Wrench,
  Laptop,
  Clock3,
  ShieldAlert,
  LockKeyhole,
  Sparkles,
} from 'lucide-react';
import type { ProviderConfig } from '../types/project';

function ProviderCard({ provider, onTest }: { provider: ProviderConfig; onTest: () => void }) {
  const statusBadge = {
    connected: <Badge variant="success" dot>Connected</Badge>,
    'not-connected': <Badge variant="error" dot>Not connected</Badge>,
    'coming-later': <Badge variant="muted">Coming later</Badge>,
    'not-tested': <Badge variant="warning" dot>Not tested</Badge>,
  };

  const logos: Record<string, ReactNode> = {
    openai: <span className="w-4 h-4 rounded-full bg-emerald-500" />,
    claude: <span className="w-4 h-4 rounded-full bg-violet-500" />,
    gemini: <Sparkles size={18} className="text-amber-500" />,
    nvidia: <span className="w-4 h-4 rounded-sm bg-green-500" />,
    custom: <Wrench size={18} className="text-slate-600" />,
    local: <Laptop size={18} className="text-slate-600" />,
  };

  const capColors: Record<string, string> = {
    Text: 'bg-blue-50 text-blue-700',
    Code: 'bg-purple-50 text-purple-700',
    Vision: 'bg-green-50 text-green-700',
    Image: 'bg-amber-50 text-amber-700',
    Planning: 'bg-indigo-50 text-indigo-700',
    Embeddings: 'bg-cyan-50 text-cyan-700',
    Video: 'bg-pink-50 text-pink-700',
  };

  return (
    <div className={`bg-white border rounded-xl p-5 ${provider.status === 'coming-later' ? 'opacity-60' : 'border-gray-200 hover:shadow-md transition-shadow'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{logos[provider.id] || <span className="w-4 h-4 rounded bg-gray-300" />}</span>
          <span className="text-[14px] font-semibold text-gray-800">{provider.name}</span>
        </div>
        {statusBadge[provider.status]}
      </div>

      {provider.status !== 'coming-later' && (
        <>
          {provider.capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              <span className="text-[11px] text-gray-500 mr-1">Capabilities</span>
              {provider.capabilities.map(cap => (
                <span key={cap} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${capColors[cap] || 'bg-gray-50 text-gray-600'}`}>
                  {cap}
                </span>
              ))}
            </div>
          )}

          {provider.model && (
            <div className="mb-3">
              <label className="text-[11px] text-gray-500 block mb-1">Model</label>
              <select className="w-full px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-md bg-white">
                <option>{provider.model}</option>
              </select>
            </div>
          )}

          {provider.id === 'custom' && (
            <div className="space-y-2 mb-3">
              <Input label="Base URL" defaultValue="https://api.example.com/v1" />
              <div>
                <label className="text-[11px] text-gray-500 block mb-1">API Key</label>
                <input
                  type="password"
                  defaultValue="sk-xxxxxxxxxxxxxxxx"
                  className="w-full px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-md"
                />
              </div>
              <Input label="Model Name" defaultValue="custom-model" />
            </div>
          )}

          {provider.lastTested && (
            <div className="flex items-center gap-1.5 mb-3">
              <span className={`w-1.5 h-1.5 rounded-full ${provider.status === 'connected' ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-[11px] text-gray-500">Last tested {provider.lastTested}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {provider.status === 'not-connected' ? (
              <Button size="sm" variant="primary">Connect</Button>
            ) : (
              <Button size="sm" icon={<Play size={11} />} onClick={onTest}>Test</Button>
            )}
          </div>
        </>
      )}

      {provider.status === 'coming-later' && (
        <div className="mt-2">
          <div className="flex items-center gap-1.5 text-amber-600 mb-2">
            <span className="text-[12px] font-medium inline-flex items-center gap-1">
              <Clock3 size={12} />
              Coming soon
            </span>
          </div>
          <p className="text-[11px] text-gray-500">
            Local model management, quantization and runtime settings are on the roadmap. Stay tuned!
          </p>
        </div>
      )}
    </div>
  );
}

function SettingsNav() {
  const [active, setActive] = useState('ai-tools');
  const sections = [
    { title: 'GENERAL', items: [{ id: 'general', label: 'General' }, { id: 'project', label: 'Project' }] },
    { title: 'RUNTIME', items: [{ id: 'runtime', label: 'Runtime Settings' }, { id: 'gamedata', label: 'Game Data' }] },
    { title: 'EDITOR', items: [{ id: 'editor-prefs', label: 'Editor Preferences' }, { id: 'shortcuts', label: 'Shortcuts' }, { id: 'ai-tools', label: 'AI Tools' }, { id: 'asset-gen', label: 'Asset Generation' }] },
    { title: 'INTEGRATIONS', items: [{ id: 'github', label: 'GitHub' }] },
    { title: 'SECURITY', items: [{ id: 'security', label: 'Security' }, { id: 'audit', label: 'Audit Log' }] },
  ];

  return (
    <div className="w-[180px] flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto py-3">
      {sections.map(section => (
        <div key={section.title} className="mb-4">
          <div className="px-4 mb-1 text-[10px] font-bold text-gray-400 tracking-wider">{section.title}</div>
          {section.items.map(item => (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={`w-full text-left px-4 py-1.5 text-[13px] cursor-pointer transition-colors ${
                active === item.id
                  ? 'bg-indigo-50 text-indigo-700 font-medium border-r-2 border-indigo-500'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ))}
      {/* Help */}
      <div className="px-4 pt-4 border-t border-gray-100 mt-4">
        <div className="flex items-center gap-2 text-[12px] text-gray-500 cursor-pointer hover:text-indigo-600">
          <HelpCircle size={14} />
          <span>Need help?</span>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Read the documentation or visit our community forum.</p>
      </div>
    </div>
  );
}

function ProviderRouting() {
  const { routing } = useProviderStore();

  const routes = [
    { label: 'Code generation', value: routing.codeGeneration },
    { label: 'Dialogue generation', value: routing.dialogueGeneration },
    { label: 'Image generation', value: routing.imageGeneration },
    { label: 'Embeddings', value: routing.embeddings },
    { label: 'Fallback model', value: routing.fallbackModel },
  ];

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[13px] font-semibold text-gray-700">Provider Routing</span>
        <HelpCircle size={12} className="text-gray-400" />
      </div>
      <p className="text-[11px] text-gray-500 mb-3">Choose the preferred provider for each capability.</p>
      <div className="space-y-3">
        {routes.map(route => (
          <div key={route.label}>
            <label className="text-[11px] text-gray-500 block mb-1">{route.label}</label>
            <select className="w-full px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-md bg-white">
              <option>{route.value}</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsageSafety() {
  const { safety } = useProviderStore();

  return (
    <div>
      <span className="text-[13px] font-semibold text-gray-700 block mb-3">Usage & Safety</span>
      <div className="space-y-4">
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Monthly budget limit (USD)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              defaultValue={safety.monthlyBudget}
              className="flex-1 px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-md"
            />
            <span className="text-[12px] text-gray-500">$</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">You will be notified at 80% and blocked at 100%.</p>
        </div>

        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-md">
          <p className="text-[11px] text-amber-700 font-medium inline-flex items-center gap-1">
            <ShieldAlert size={12} />
            Per-task cost warning
          </p>
          <p className="text-[10px] text-amber-600">Tasks may exceed $0.50 depending on model and size.</p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] text-gray-700 font-medium">Never send secrets</p>
            <p className="text-[10px] text-gray-500">Avoid sending API keys or secrets to providers.</p>
          </div>
          <ToggleSwitch checked={safety.neverSendSecrets} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] text-gray-700 font-medium">Require confirmation before GitHub push</p>
            <p className="text-[10px] text-gray-500">Adds a confirmation step before pushing.</p>
          </div>
          <ToggleSwitch checked={safety.requireConfirmBeforePush} />
        </div>

        <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
          <p className="text-[10px] text-gray-500 flex items-start gap-1.5">
            <LockKeyhole size={12} className="text-gray-400 mt-0.5" />
            API keys are stored locally and are never included in exported games.
          </p>
        </div>
      </div>
    </div>
  );
}

function ConnectionStatus() {
  const { providers } = useProviderStore();
  const connected = providers.filter(p => p.status === 'connected');

  return (
    <div className="border-t border-gray-200 bg-white px-6 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-medium text-gray-600">Connection Status</span>
        <span className="text-[10px] text-gray-400">Last checked just now</span>
        <Button size="sm" icon={<RefreshCw size={11} />}>Refresh</Button>
      </div>
      <div className="flex items-center gap-6">
        {providers.filter(p => p.status !== 'coming-later').map(p => (
          <div key={p.id} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${p.status === 'connected' ? 'bg-green-500' : p.status === 'not-connected' ? 'bg-red-400' : 'bg-gray-400'}`} />
            <div>
              <span className="text-[11px] font-medium text-gray-700">{p.name}</span>
              <span className="text-[10px] text-gray-500 block">
                {p.status === 'connected' ? 'Connection OK' : p.status === 'not-connected' ? 'Missing API key' : 'Not tested'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToggleSwitch({ checked }: { checked: boolean }) {
  const [on, setOn] = useState(checked);
  return (
    <button
      onClick={() => setOn(!on)}
      className={`w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${on ? 'bg-indigo-500' : 'bg-gray-300'}`}
    >
      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${on ? 'translate-x-4.5 ml-0.5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export function AIToolsScreen() {
  const { providers, testConnection } = useProviderStore();

  return (
    <div className="flex-1 flex overflow-hidden">
      <SettingsNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-[18px] font-bold text-gray-800">AI Tools</h2>
              <p className="text-[13px] text-gray-500 mt-1">Connect providers to generate maps, events, dialogue, code, images and future 3D assets.</p>
            </div>

            {/* Provider cards grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
              {providers.map(provider => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  onTest={() => testConnection(provider.id)}
                />
              ))}
            </div>
          </div>
        </div>
        <ConnectionStatus />
      </div>

      {/* Right panel */}
      <div className="w-[260px] flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto p-4">
        <ProviderRouting />
        <UsageSafety />
      </div>
    </div>
  );
}
