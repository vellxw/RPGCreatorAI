import { useRef, useState } from 'react';
import { Download, FilePlus2, FolderOpen, PackageOpen, Play } from 'lucide-react';
import { Button } from '../ui/Button';
import type { StartupRecoveryState } from '../../startup/startupRecovery';
import type { ProjectTemplateId } from '../../adapters/types';

export type StartupPendingAction = 'open' | 'create' | 'import';

interface ProjectStartupScreenProps {
  desktop: boolean;
  sampleTitle: string;
  statusMessage?: string | null;
  recoveryState?: StartupRecoveryState | null;
  pendingAction?: StartupPendingAction | null;
  runtimeStatusMessage?: string | null;
  onUseSample(): void;
  onOpenProject(): void;
  onCreateProject(title: string): void;
  onCreateProjectTemplate?(title: string, templateId: ProjectTemplateId): void;
  onImportProject(file: File): void;
}

export function ProjectStartupScreen({
  desktop,
  sampleTitle,
  statusMessage,
  recoveryState,
  pendingAction,
  runtimeStatusMessage,
  onUseSample,
  onOpenProject,
  onCreateProject,
  onCreateProjectTemplate,
  onImportProject,
}: ProjectStartupScreenProps) {
  const [title, setTitle] = useState('Untitled RPG');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputId = 'startup-project-title';
  const createLabel = desktop ? 'Create Project' : 'Create Browser Project';
  const busy = pendingAction != null;
  const pendingCopy: Record<StartupPendingAction, string> = {
    open: 'Opening project folder...',
    create: 'Creating project...',
    import: 'Importing project bundle...',
  };
  const recoveryOptions =
    recoveryState?.options
      .filter(option => desktop || option !== 'Open Project Folder')
      .map(option => (!desktop && option === 'Create Project' ? 'Create Browser Project' : option)) ??
    [];

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (busy) return;
    const file = e.target.files?.[0];
    if (file) onImportProject(file);
    e.target.value = '';
  };

  return (
    <div className="h-screen w-full bg-[#f5f5f7] text-gray-800 flex items-center justify-center px-6">
      <main className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] gap-6 lg:gap-8">
        <section className="flex flex-col justify-center min-h-[260px] lg:min-h-[520px]">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-md bg-indigo-500 flex items-center justify-center">
              <PackageOpen size={17} className="text-white" />
            </div>
            <span className="text-[13px] font-semibold text-gray-700">RPGCreatorAI</span>
          </div>
          <h1 className="text-[32px] leading-tight font-semibold text-gray-950 mb-3">
            Start a project
          </h1>
          <p className="text-[14px] leading-6 text-gray-600 max-w-xl">
            Open a desktop project folder, create a new local project, or keep exploring with
            the bundled sample.
          </p>

          {!desktop && (
            <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-900">
              Browser mode cannot open folders or write project files. New projects are saved to
              browser memory until you export a bundle.
            </div>
          )}

          {pendingAction && (
            <div
              data-testid="startup-action-pending"
              className="mt-5 rounded-md border border-indigo-100 bg-white px-3 py-2 text-[12px] leading-5 text-gray-700 shadow-sm"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <span className="font-semibold text-gray-900">{pendingCopy[pendingAction]}</span>
              <span className="ml-1 text-gray-600">
                Keep this window open while RPGCreatorAI finishes the local project action.
              </span>
            </div>
          )}

          {recoveryState && (
            <div
              className="mt-5 rounded-md border border-rose-200 bg-white px-3 py-3 text-[12px] leading-5 text-gray-700 shadow-sm"
              role="status"
              aria-live="polite"
            >
              <div className="font-semibold text-rose-900">{recoveryState.title}</div>
              <p className="mt-1">{recoveryState.detail}</p>
              <div className="mt-2 font-semibold text-gray-700">Recovery options</div>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {recoveryOptions.map(option => (
                  <li key={option}>{option}</li>
                ))}
              </ul>
            </div>
          )}

          {!recoveryState && statusMessage && (
            <div
              className="mt-5 rounded-md border border-gray-200 bg-white px-3 py-2 text-[12px] leading-5 text-gray-700 shadow-sm"
              role="status"
              aria-live="polite"
            >
              {statusMessage}
            </div>
          )}

          {runtimeStatusMessage && (
            <div
              className="mt-3 rounded-md border border-emerald-100 bg-white px-3 py-2 text-[12px] leading-5 text-gray-700 shadow-sm"
              role="status"
              aria-live="polite"
            >
              {runtimeStatusMessage}
            </div>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 self-center">
          <div className="space-y-5">
            <div>
              <div className="text-[12px] font-semibold text-gray-500 mb-2">Existing project</div>
              <div className="flex flex-wrap gap-2">
                {desktop && (
                  <Button
                    icon={<FolderOpen size={14} />}
                    onClick={onOpenProject}
                    autoFocus
                    disabled={busy}
                  >
                    Open Project Folder
                  </Button>
                )}
                <Button
                  icon={<Download size={14} />}
                  onClick={() => fileInputRef.current?.click()}
                  autoFocus={!desktop}
                  disabled={busy}
                >
                  Import Project Bundle
                </Button>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <label
                htmlFor={titleInputId}
                className="block text-[12px] font-semibold text-gray-500 mb-2"
              >
                New project name
              </label>
              <div className="flex gap-2">
                <input
                  id={titleInputId}
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  disabled={busy}
                  className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 px-2 text-[13px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <Button
                  variant="primary"
                  icon={<FilePlus2 size={14} />}
                  onClick={() => onCreateProject(title)}
                  disabled={busy}
                >
                  {createLabel}
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  variant="default"
                  onClick={() => {
                    if (onCreateProjectTemplate) {
                      onCreateProjectTemplate(title, 'horror-bl');
                    } else {
                      onCreateProject(title);
                    }
                  }}
                  disabled={busy}
                >
                  Start Horror / BL Template
                </Button>
                <span className="text-[11px] text-gray-500">
                  {desktop
                    ? 'Copies a complete chapter blueprint: 3 maps, 4 choices, a puzzle, a chase, 2 endings, docs, and schema.'
                    : 'Starts with the horror visual profile; the desktop wizard also copies the complete chapter docs and data.'}
                </span>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <div className="text-[12px] font-semibold text-gray-500 mb-2">Bundled sample</div>
              <Button icon={<Play size={14} />} onClick={onUseSample} disabled={busy}>
                Use {sampleTitle}
              </Button>
            </div>
          </div>
        </section>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        disabled={busy}
        onChange={handleImport}
      />
    </div>
  );
}
