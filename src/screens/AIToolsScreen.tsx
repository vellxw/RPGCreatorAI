import { Badge } from '../components/ui/Badge';
import { CheckCircle2, ClipboardList, Clock3, TerminalSquare } from 'lucide-react';

const mvpSurfaces = [
  { label: 'Validation', detail: 'Project and map checks before playtest.', icon: CheckCircle2 },
  { label: 'Runtime Log', detail: 'Native runtime output from the current session.', icon: TerminalSquare },
  { label: 'Event Trace', detail: 'Deterministic event command execution rows.', icon: ClipboardList },
];

export function AIToolsScreen() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f5f7]">
      <div className="max-w-3xl px-6 py-6">
        <div className="mb-5 flex items-center gap-3">
          <h2 className="text-[18px] font-bold text-gray-800">Future AI Workspace</h2>
          <Badge variant="muted">Future phase</Badge>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-start gap-3">
            <Clock3 size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[13px] font-semibold text-gray-800">Unavailable in the MVP editor</p>
              <p className="text-[12px] text-gray-500 mt-1">
                Assistance features are intentionally kept out of this release until
                the real provider layer and product rules exist. No provider call,
                network request, or API key is used from this screen.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {mvpSurfaces.map(surface => {
              const Icon = surface.icon;
              return (
                <div key={surface.label} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon size={14} className="text-indigo-500" />
                    <span className="text-[12px] font-semibold text-gray-800">{surface.label}</span>
                  </div>
                  <p className="text-[11px] text-gray-500">{surface.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
