import type { ReactNode } from 'react';
import {
  FIRST_RUN_PATHS,
  type FirstRunPath,
  type FirstRunStarterPath,
} from '../../firstRun/firstRunTypes';

export interface FirstRunPathSelectorProps {
  selectedPath: FirstRunStarterPath | null;
  hasCompletedFirstRun: boolean;
  onSelectPath?: (pathId: FirstRunStarterPath) => void;
  onConfirm?: (pathId: FirstRunStarterPath) => void;
  onSkip?: () => void;
}

export function FirstRunPathSelector({
  selectedPath,
  hasCompletedFirstRun,
  onSelectPath,
  onConfirm,
  onSkip,
}: FirstRunPathSelectorProps): ReactNode {
  return (
    <section
      data-testid="first-run-path-selector"
      data-has-completed={hasCompletedFirstRun}
      data-selected-path={selectedPath ?? ''}
      aria-label="First-run starter path"
    >
      <header>
        <h2>Welcome to RPGCreatorAI</h2>
        <p data-testid="first-run-summary">
          Pick a starter path to reach your first save and playtest. None of these require
          a provider, account, or network connection.
        </p>
      </header>
      <ul
        data-testid="first-run-path-list"
        className="first-run-path-list"
        aria-label="Starter paths"
      >
        {FIRST_RUN_PATHS.map(path => (
          <FirstRunPathCard
            key={path.id}
            path={path}
            selected={selectedPath === path.id}
            onSelect={() => onSelectPath?.(path.id)}
          />
        ))}
      </ul>
      <div className="first-run-path-selector__actions">
        <button
          type="button"
          data-testid="first-run-confirm"
          data-action="confirm"
          disabled={selectedPath === null}
          onClick={() => {
            if (selectedPath !== null) onConfirm?.(selectedPath);
          }}
        >
          Use this starter path
        </button>
        {hasCompletedFirstRun ? (
          <button
            type="button"
            data-testid="first-run-skip"
            data-action="skip"
            onClick={() => onSkip?.()}
          >
            Skip the first-run flow
          </button>
        ) : null}
      </div>
    </section>
  );
}

interface FirstRunPathCardProps {
  path: FirstRunPath;
  selected: boolean;
  onSelect: () => void;
}

function FirstRunPathCard({ path, selected, onSelect }: FirstRunPathCardProps): ReactNode {
  return (
    <li data-testid="first-run-path-item" data-path={path.id} data-selected={selected}>
      <label>
        <input
          type="radio"
          name="first-run-path"
          value={path.id}
          checked={selected}
          onChange={onSelect}
          data-testid={`first-run-path-radio-${path.id}`}
        />
        <strong>{path.title}</strong>
        <p data-testid={`first-run-path-summary-${path.id}`}>{path.summary}</p>
        <ul data-testid={`first-run-path-bullets-${path.id}`}>
          {path.bullets.map(bullet => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
        <span
          data-testid={`first-run-path-default-title-${path.id}`}
          data-default-title={path.defaultTitle}
          hidden
        >
          {path.defaultTitle}
        </span>
      </label>
    </li>
  );
}
