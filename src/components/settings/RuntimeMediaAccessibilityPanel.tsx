import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Accessibility,
  AudioLines,
  Captions,
  CheckCircle2,
  Eye,
  PauseCircle,
  RotateCcw,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  resolveMotionPolicy,
  validateRuntimeAccessibilityPreferences,
  type GoreMode,
  type MotionPreference,
} from '../../runtime-ui/accessibilityContracts';
import {
  validateAudioFocusPolicy,
  type AudioResumeMode,
} from '../../media/audioFocus';
import {
  useRuntimeMediaPreferences,
  type RuntimeMediaPreferencesStorage,
} from '../../stores/runtimeMediaPreferencesStore';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export type ReducedMotionHost = Pick<Window, 'matchMedia'>;

function browserReducedMotionHost(): ReducedMotionHost | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window;
}

/** Offline and test hosts may omit matchMedia; absence resolves to the non-reduced system default. */
export function readSystemReducedMotion(
  host: ReducedMotionHost | null = browserReducedMotionHost(),
): boolean {
  if (!host) return false;
  try {
    return host.matchMedia(REDUCED_MOTION_QUERY).matches;
  } catch {
    return false;
  }
}

interface Choice<T extends string> {
  value: T;
  label: string;
  description: string;
}

interface ChoiceGroupProps<T extends string> {
  legend: string;
  value: T;
  choices: readonly Choice<T>[];
  onChange: (value: T) => void;
}

function ChoiceGroup<T extends string>({ legend, value, choices, onChange }: ChoiceGroupProps<T>) {
  const selected = choices.find(choice => choice.value === value) ?? choices[0];
  return (
    <fieldset>
      <legend className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{legend}</legend>
      <div
        className="mt-2 grid gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1"
        style={{ gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))` }}
      >
        {choices.map(choice => (
          <button
            key={choice.value}
            type="button"
            aria-pressed={choice.value === value}
            onClick={() => onChange(choice.value)}
            className={`min-h-9 rounded-md px-2 text-[12px] font-semibold transition-colors motion-reduce:transition-none ${
              choice.value === value
                ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200'
                : 'text-gray-500 hover:bg-white/70 hover:text-gray-800'
            }`}
          >
            {choice.label}
          </button>
        ))}
      </div>
      <p className="mt-2 min-h-8 text-[11px] leading-4 text-gray-500">{selected?.description}</p>
    </fieldset>
  );
}

interface ToggleRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({ id, label, description, checked, disabled = false, onChange }: ToggleRowProps) {
  return (
    <label
      htmlFor={id}
      className={`flex min-h-11 items-start gap-3 rounded-md px-2 py-2 ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-gray-50'
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={event => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600"
      />
      <span>
        <span className="block text-[12px] font-semibold text-gray-800">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-gray-500">{description}</span>
      </span>
    </label>
  );
}

interface PanelSectionProps {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}

function PanelSection({ icon, title, description, children, className = '' }: PanelSectionProps) {
  return (
    <section className={`min-w-0 p-4 ${className}`}>
      <div className="mb-4 flex items-start gap-2.5">
        <span className="mt-0.5 text-indigo-600" aria-hidden="true">{icon}</span>
        <div>
          <h4 className="text-[13px] font-semibold text-gray-900">{title}</h4>
          <p className="mt-0.5 text-[11px] leading-4 text-gray-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

const MOTION_CHOICES: readonly Choice<MotionPreference>[] = [
  {
    value: 'system',
    label: 'System',
    description: 'Follow the operating system reduced-motion preference.',
  },
  {
    value: 'reduce',
    label: 'Reduced',
    description: 'Disable camera shake, parallax, and decorative loops.',
  },
  {
    value: 'full',
    label: 'Full',
    description: 'Use authored motion while preserving static state cues.',
  },
];

const GORE_CHOICES: readonly Choice<GoreMode>[] = [
  {
    value: 'full',
    label: 'Full',
    description: 'Use the authored graphic variants when available.',
  },
  {
    value: 'reduced',
    label: 'Reduced',
    description: 'Prefer less graphic art without removing gameplay clues.',
  },
  {
    value: 'off',
    label: 'Off',
    description: 'Use safe visuals or non-graphic descriptions only.',
  },
];

const RESUME_CHOICES: readonly Choice<AudioResumeMode>[] = [
  {
    value: 'user-gesture',
    label: 'Ask first',
    description: 'Return paused after calls, app switching, or output changes.',
  },
  {
    value: 'automatic',
    label: 'Automatic',
    description: 'Resume when focus returns if the platform permits it.',
  },
];

function useSystemReducedMotion(hostOverride?: ReducedMotionHost | null): boolean {
  const host = hostOverride === undefined ? browserReducedMotionHost() : hostOverride;
  const [reduced, setReduced] = useState(() => readSystemReducedMotion(host));

  useEffect(() => {
    if (!host) {
      setReduced(false);
      return;
    }
    let query: MediaQueryList;
    try {
      query = host.matchMedia(REDUCED_MOTION_QUERY);
    } catch {
      setReduced(false);
      return;
    }
    const update = (event: MediaQueryListEvent) => setReduced(event.matches);
    setReduced(query.matches);
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }
    query.addListener(update);
    return () => query.removeListener(update);
  }, [host]);

  return reduced;
}

export interface RuntimeMediaAccessibilityPanelProps {
  storage?: RuntimeMediaPreferencesStorage | null;
  reducedMotionHost?: ReducedMotionHost | null;
}

export function RuntimeMediaAccessibilityPanel({
  storage,
  reducedMotionHost,
}: RuntimeMediaAccessibilityPanelProps = {}) {
  const {
    preferences,
    persistence,
    setAccessibility,
    setAudioFocus,
    reset,
  } = useRuntimeMediaPreferences({ storage });
  const systemReducedMotion = useSystemReducedMotion(reducedMotionHost);
  const { accessibility, audioFocus } = preferences;
  const motionPolicy = useMemo(
    () => resolveMotionPolicy(accessibility.motion.preference, systemReducedMotion),
    [accessibility.motion.preference, systemReducedMotion],
  );
  const valid = validateRuntimeAccessibilityPreferences(accessibility).valid
    && validateAudioFocusPolicy(audioFocus).valid;

  return (
    <section
      aria-labelledby="runtime-media-accessibility-title"
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 bg-gradient-to-r from-indigo-50/80 via-white to-white px-4 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-100 bg-white text-indigo-600 shadow-sm" aria-hidden="true">
            <Accessibility size={18} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 id="runtime-media-accessibility-title" className="text-[14px] font-semibold text-gray-900">
                Playtest media & accessibility
              </h3>
              <Badge variant={valid ? 'success' : 'error'} dot>
                {valid ? 'Contract valid' : 'Needs attention'}
              </Badge>
            </div>
            <p className="mt-1 max-w-3xl text-[12px] leading-5 text-gray-600">
              Set local runtime defaults for subtitles, motion, graphic content, and audio interruptions.
              Playtest and export adapters can consume the same versioned preference contract.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span role="status" aria-live="polite">
            <Badge variant={persistence === 'saved' ? 'info' : 'warning'} dot>
              {persistence === 'saved' ? 'Saved on this device' : 'Session only'}
            </Badge>
          </span>
          <Button type="button" size="sm" icon={<RotateCcw size={13} />} onClick={reset}>
            Restore safe defaults
          </Button>
        </div>
      </div>

      <div className="grid divide-y divide-gray-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <PanelSection
          icon={<Captions size={16} />}
          title="Subtitles & sound cues"
          description="Speech, speaker identity, and meaningful off-screen sounds stay legible."
        >
          <div className="space-y-1">
            <ToggleRow
              id="runtime-subtitles-enabled"
              label="Show subtitles"
              description="Forced safety and gameplay cues can still appear when ordinary speech subtitles are off."
              checked={accessibility.subtitles.enabled}
              onChange={enabled => setAccessibility({ subtitles: { enabled } })}
            />
            <ToggleRow
              id="runtime-subtitle-speakers"
              label="Show speaker names"
              description="Identify who is speaking before each subtitle line."
              checked={accessibility.subtitles.speakerLabels}
              disabled={!accessibility.subtitles.enabled}
              onChange={speakerLabels => setAccessibility({ subtitles: { speakerLabels } })}
            />
            <ToggleRow
              id="runtime-subtitle-sound-cues"
              label="Caption important sounds"
              description="Describe doors, impacts, alarms, and other gameplay-relevant audio."
              checked={accessibility.subtitles.soundCues}
              disabled={!accessibility.subtitles.enabled}
              onChange={soundCues => setAccessibility({ subtitles: { soundCues } })}
            />
          </div>

          <div className="mt-4 grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-[minmax(0,1fr)_120px]">
            <label htmlFor="runtime-subtitle-scale" className="block">
              <span className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Text size
                <output htmlFor="runtime-subtitle-scale" className="text-indigo-700">
                  {Math.round(accessibility.subtitles.textScale * 100)}%
                </output>
              </span>
              <input
                id="runtime-subtitle-scale"
                type="range"
                min="0.75"
                max="2"
                step="0.05"
                value={accessibility.subtitles.textScale}
                disabled={!accessibility.subtitles.enabled}
                aria-valuetext={`${Math.round(accessibility.subtitles.textScale * 100)} percent`}
                onChange={event => setAccessibility({ subtitles: { textScale: Number(event.target.value) } })}
                className="mt-3 w-full accent-indigo-600 disabled:opacity-50"
              />
            </label>
            <label htmlFor="runtime-subtitle-lines" className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Max lines</span>
              <select
                id="runtime-subtitle-lines"
                value={accessibility.subtitles.maxLines}
                disabled={!accessibility.subtitles.enabled}
                onChange={event => setAccessibility({ subtitles: { maxLines: Number(event.target.value) } })}
                className="mt-2 h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-[12px] text-gray-700 disabled:bg-gray-50 disabled:text-gray-400"
              >
                {[1, 2, 3, 4].map(lines => <option key={lines} value={lines}>{lines}</option>)}
              </select>
            </label>
          </div>
        </PanelSection>

        <PanelSection
          icon={<Eye size={16} />}
          title="Motion & graphic content"
          description="Comfort settings never remove the only clue or state change."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <ChoiceGroup
              legend="Motion"
              value={accessibility.motion.preference}
              choices={MOTION_CHOICES}
              onChange={preference => setAccessibility({ motion: { preference } })}
            />
            <ChoiceGroup
              legend="Gore"
              value={accessibility.gore.mode}
              choices={GORE_CHOICES}
              onChange={mode => setAccessibility({ gore: { mode } })}
            />
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-md border border-gray-100 bg-gray-50 px-3 py-2.5 text-[11px] leading-4 text-gray-600">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-green-600" aria-hidden="true" />
            <span>
              Effective motion: <strong className="font-semibold text-gray-800">{motionPolicy.reduced ? 'reduced' : 'full'}</strong>.
              {accessibility.motion.preference === 'system'
                ? ` This device currently reports ${systemReducedMotion ? 'reduced motion' : 'full motion'}.`
                : ' This explicit choice overrides the system preference for playtest.'}
            </span>
          </div>
        </PanelSection>
      </div>

      <PanelSection
        icon={<AudioLines size={16} />}
        title="Audio focus & interruptions"
        description="Choose what happens when another app, a call, or the operating system takes audio focus."
        className="border-t border-gray-200"
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(220px,0.8fr)]">
          <fieldset>
            <legend className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Temporary focus loss</legend>
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
              <button
                type="button"
                aria-pressed={audioFocus.transientLoss === 'suspend'}
                onClick={() => setAudioFocus({ transientLoss: 'suspend' })}
                className={`min-h-9 rounded-md px-2 text-[12px] font-semibold transition-colors motion-reduce:transition-none ${
                  audioFocus.transientLoss === 'suspend'
                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200'
                    : 'text-gray-500 hover:bg-white/70 hover:text-gray-800'
                }`}
              >
                Pause audio
              </button>
              <button
                type="button"
                aria-pressed={audioFocus.transientLoss === 'duck'}
                onClick={() => setAudioFocus({ transientLoss: 'duck' })}
                className={`min-h-9 rounded-md px-2 text-[12px] font-semibold transition-colors motion-reduce:transition-none ${
                  audioFocus.transientLoss === 'duck'
                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200'
                    : 'text-gray-500 hover:bg-white/70 hover:text-gray-800'
                }`}
              >
                Lower volume
              </button>
            </div>
            <label htmlFor="runtime-audio-duck-gain" className="mt-3 block">
              <span className="flex items-center justify-between text-[11px] text-gray-500">
                Volume while lowered
                <output htmlFor="runtime-audio-duck-gain" className="font-semibold text-gray-700">
                  {Math.round(audioFocus.duckGain * 100)}%
                </output>
              </span>
              <input
                id="runtime-audio-duck-gain"
                type="range"
                min="0"
                max="0.9"
                step="0.05"
                value={audioFocus.duckGain}
                disabled={audioFocus.transientLoss !== 'duck'}
                aria-valuetext={`${Math.round(audioFocus.duckGain * 100)} percent`}
                onChange={event => setAudioFocus({ duckGain: Number(event.target.value) })}
                className="mt-2 w-full accent-indigo-600 disabled:opacity-40"
              />
            </label>
          </fieldset>

          <ChoiceGroup
            legend="Resume after interruption"
            value={audioFocus.resumeMode}
            choices={RESUME_CHOICES}
            onChange={resumeMode => setAudioFocus({ resumeMode })}
          />

          <div className="space-y-1">
            <ToggleRow
              id="runtime-audio-hidden"
              label="Pause when hidden"
              description="Stop playback when the app is minimized, covered, or the screen locks."
              checked={audioFocus.suspendWhenHidden}
              onChange={suspendWhenHidden => setAudioFocus({ suspendWhenHidden })}
            />
            <ToggleRow
              id="runtime-audio-voice-duck"
              label="Lower background under voice"
              description="Keep narration clear without changing the voice bus."
              checked={audioFocus.duckForVoice}
              onChange={duckForVoice => setAudioFocus({ duckForVoice })}
            />
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 border-t border-gray-100 pt-3 text-[11px] leading-4 text-gray-500">
          <PauseCircle size={14} className="mt-0.5 shrink-0 text-indigo-500" aria-hidden="true" />
          <p>
            Full focus loss and hidden-app states always resolve through the audio-focus contract.
            Hardware volume remains owned by the operating system; this panel never changes system volume.
          </p>
        </div>
      </PanelSection>
    </section>
  );
}
