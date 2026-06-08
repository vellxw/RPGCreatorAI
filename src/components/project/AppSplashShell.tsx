import appIconUrl from '../../../src-tauri/icons/icon-source.svg';
import type { StartupPhase } from '../../startup/startupPhases';

interface AppSplashShellProps {
  phase: StartupPhase;
}

export function AppSplashShell({ phase }: AppSplashShellProps) {
  return (
    <div
      data-testid="app-splash-shell"
      role="status"
      aria-live="polite"
      className="h-screen w-full overflow-hidden bg-[#f5f5f7] text-gray-900 flex items-center justify-center px-6"
    >
      <main className="w-full max-w-[760px]">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 rounded-2xl bg-[#12202d] p-2 shadow-lg shadow-slate-900/10">
            <img
              src={appIconUrl}
              alt=""
              aria-hidden="true"
              className="h-full w-full rounded-xl"
              draggable={false}
            />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[#2a6f66]">RPGCreatorAI</div>
            <h1 className="mt-1 text-[28px] leading-tight font-semibold text-gray-950">
              {phase.title}
            </h1>
          </div>
        </div>

        <p className="mt-5 max-w-[520px] text-[14px] leading-6 text-gray-600">
          {phase.detail}
        </p>

        <div
          role="progressbar"
          aria-label="Startup progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={phase.progress}
          className="mt-7 h-1.5 w-full max-w-[420px] overflow-hidden rounded-full bg-gray-200"
        >
          <div
            className="h-full rounded-full bg-[#51b788] animate-pulse"
            style={{ width: `${phase.progress}%` }}
          />
        </div>
      </main>
    </div>
  );
}
