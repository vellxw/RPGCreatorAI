import appIconUrl from '../../../src-tauri/icons/icon-source.svg';

interface AppSplashShellProps {
  title?: string;
  detail?: string;
}

export function AppSplashShell({
  title = 'Preparing your workspace',
  detail = 'Loading project data and editor state.',
}: AppSplashShellProps) {
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
              {title}
            </h1>
          </div>
        </div>

        <p className="mt-5 max-w-[520px] text-[14px] leading-6 text-gray-600">{detail}</p>

        <div className="mt-7 h-1.5 w-full max-w-[420px] overflow-hidden rounded-full bg-gray-200">
          <div className="h-full w-2/5 rounded-full bg-[#51b788] animate-pulse" />
        </div>
      </main>
    </div>
  );
}
