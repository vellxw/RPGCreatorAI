import { Badge } from '../components/ui/Badge';
import {
  CheckCircle2,
  ClipboardList,
  History,
  KeyRound,
  Layers3,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from 'lucide-react';

const setupStates = [
  {
    label: 'Provider setup',
    detail: 'Enable providers from Settings after explicit context disclosure.',
    icon: KeyRound,
    badge: 'Opt-in',
  },
  {
    label: 'Cost & Budget',
    detail: 'Known estimates, unknown-cost states, budgets, quotas, and retry guidance stay visible.',
    icon: WalletCards,
    badge: 'Gated',
  },
  {
    label: 'Generation history',
    detail: 'Prompts, outputs, costs, failures, and accepted links are retained as redacted editor metadata.',
    icon: History,
    badge: 'Redacted',
  },
];

const workflowGroups = [
  {
    label: 'Content drafts',
    detail: 'Map drafts, quests, event commands, database drafts, balancing suggestions, and validation repair guidance.',
    items: ['Map drafts', 'Quest drafts', 'Event commands', 'Database drafts'],
  },
  {
    label: 'Image assets',
    detail: 'Tileset, item icon, portrait, and image edit variation workflows use review-gated candidates.',
    items: ['Image assets', 'Tilesets', 'Portraits', 'Item icons'],
  },
  {
    label: 'Characters and animation',
    detail: 'Character concepts, sprite sheets, normalization manifests, previews, and QA stay local until accepted.',
    items: ['Character concepts', 'Sprite sheets', 'Animation QA', 'Runtime BMP export'],
  },
];

const safetyStates = [
  'Runtime independent',
  'Mock validated',
  'Credentials outside project JSON',
  'Review-gated writes',
];

export function AIToolsScreen() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f5f7]">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-6">
        <div className="border-b border-gray-200 pb-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Sparkles size={18} className="text-indigo-600" />
            <h2 className="text-[18px] font-bold text-gray-800">Optional AI Editor Tooling</h2>
            <Badge variant="info" dot>Editor-only</Badge>
            <Badge variant="muted">No runtime dependency</Badge>
          </div>
          <p className="max-w-3xl text-[12px] leading-5 text-gray-600">
            AI workflows are optional authoring aids. Provider configuration lives in Settings,
            normal validation uses local mocks, and generated output remains a candidate until review.
          </p>
        </div>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {setupStates.map(state => {
            const Icon = state.icon;
            return (
              <article key={state.label} className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon size={15} className="shrink-0 text-indigo-600" />
                    <h3 className="truncate text-[13px] font-semibold text-gray-800">{state.label}</h3>
                  </div>
                  <Badge variant="muted">{state.badge}</Badge>
                </div>
                <p className="text-[12px] leading-5 text-gray-600">{state.detail}</p>
              </article>
            );
          })}
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Layers3 size={15} className="text-indigo-600" />
            <h3 className="text-[13px] font-semibold text-gray-800">Review-gated workflows</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {workflowGroups.map(group => (
              <article key={group.label} className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                <h4 className="text-[13px] font-semibold text-gray-800">{group.label}</h4>
                <p className="mt-1 text-[12px] leading-5 text-gray-600">{group.detail}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {group.items.map(item => (
                    <span key={item} className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                      {item}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-green-100 bg-green-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck size={15} className="text-green-700" />
            <h3 className="text-[13px] font-semibold text-green-900">Safety boundary</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            {safetyStates.map(state => (
              <div key={state} className="flex items-center gap-2 text-[12px] font-medium text-green-800">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>{state}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList size={15} className="text-indigo-600" />
            <h3 className="text-[13px] font-semibold text-gray-800">Validation status</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {['Offline provider contracts', 'Queue recovery states', 'Failed-call history'].map(item => (
              <div key={item} className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
                <p className="text-[12px] font-semibold text-gray-800">{item}</p>
                <p className="mt-0.5 text-[11px] text-gray-500">Covered by local tests and docs.</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
