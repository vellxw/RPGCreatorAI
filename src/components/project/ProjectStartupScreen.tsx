import { useRef, useState } from 'react';
import { Download, FilePlus2, FolderOpen, PackageOpen, Play } from 'lucide-react';
import { Button } from '../ui/Button';

interface ProjectStartupScreenProps {
  desktop: boolean;
  sampleTitle: string;
  statusMessage?: string | null;
  runtimeStatusMessage?: string | null;
  onUseSample(): void;
  onOpenProject(): void;
  onCreateProject(title: string): void;
  onImportProject(file: File): void;
}

export function ProjectStartupScreen({
  desktop,
  sampleTitle,
  statusMessage,
  runtimeStatusMessage,
  onUseSample,
  onOpenProject,
  onCreateProject,
  onImportProject,
}: ProjectStartupScreenProps) {
  const [title, setTitle] = useState('Untitled RPG');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const createLabel = desktop ? 'Create Project' : 'Create Browser Project';

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
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

          {statusMessage && (
            <div className="mt-5 rounded-md border border-gray-200 bg-white px-3 py-2 text-[12px] leading-5 text-gray-700 shadow-sm">
              {statusMessage}
            </div>
          )}

          {runtimeStatusMessage && (
            <div className="mt-3 rounded-md border border-emerald-100 bg-white px-3 py-2 text-[12px] leading-5 text-gray-700 shadow-sm">
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
                  <Button icon={<FolderOpen size={14} />} onClick={onOpenProject}>
                    Open Project Folder
                  </Button>
                )}
                <Button
                  icon={<Download size={14} />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Import Project Bundle
                </Button>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <label className="block text-[12px] font-semibold text-gray-500 mb-2">
                New project name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 px-2 text-[13px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <Button
                  variant="primary"
                  icon={<FilePlus2 size={14} />}
                  onClick={() => onCreateProject(title)}
                >
                  {createLabel}
                </Button>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <div className="text-[12px] font-semibold text-gray-500 mb-2">Bundled sample</div>
              <Button icon={<Play size={14} />} onClick={onUseSample}>
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
        onChange={handleImport}
      />
    </div>
  );
}
