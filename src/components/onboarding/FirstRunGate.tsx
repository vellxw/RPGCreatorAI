import type { ReactNode } from 'react';
import { FirstRunPathSelector } from './FirstRunPathSelector';
import type { FirstRunStarterPath } from '../../firstRun/firstRunTypes';

export interface FirstRunGateProps {
  /**
   * `true` while the creator has not yet completed the first-run starter-path
   * selection. Driven by `useFirstRun().isFirstRun` in the host. When `true`,
   * the gate renders the starter-path selector and hides the children. When
   * `false`, the children render untouched.
   */
  isFirstRun: boolean;
  /**
   * Currently-selected starter path. Driven by `useFirstRun().preferences.selectedPath`.
   * Passed through to the underlying `FirstRunPathSelector` so the radio
   * remains in sync with persisted state.
   */
  selectedPath: FirstRunStarterPath | null;
  /**
   * Fired when the creator picks a starter path. The host is expected to
   * call `useFirstRun().selectPath(id)` (or its equivalent reducer dispatch)
   * and persist the choice.
   */
  onSelectPath: (pathId: FirstRunStarterPath) => void;
  /**
   * Fired when the creator confirms the selected starter path. The host is
   * expected to call `useFirstRun().complete()` and trigger the matching
   * `performCreateProject` / `performOpenRecent` / `useBundledSample` flow.
   */
  onConfirm: (pathId: FirstRunStarterPath) => void;
  /**
   * The app shell the gate should render when first-run is complete. The gate
   * is intentionally inert: it does not call providers, stores, or
   * navigation. All side effects are routed through the callbacks above.
   */
  children: ReactNode;
}

export function FirstRunGate({
  isFirstRun,
  selectedPath,
  onSelectPath,
  onConfirm,
  children,
}: FirstRunGateProps): ReactNode {
  if (!isFirstRun) return children;
  return (
    <FirstRunPathSelector
      selectedPath={selectedPath}
      hasCompletedFirstRun={false}
      onSelectPath={onSelectPath}
      onConfirm={onConfirm}
    />
  );
}
