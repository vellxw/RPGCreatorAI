import { AIStudioScreen } from './AIStudioScreen';
import type { ProviderConfig } from '../../types/project';

export interface AIStudioBoundaryProps {
  providers: readonly ProviderConfig[];
  projectId: string | null;
}

/**
 * Thin wrapper around `AIStudioScreen` used by `App.tsx` to code-split the
 * AI Studio into its own chunk via `React.lazy`. Mirrors the convention
 * established by `ProviderSettingsBoundary`, `AssetWorkspaceBoundary`, and
 * `PlaytestWorkspaceBoundary`.
 */
export function AIStudioBoundary(props: AIStudioBoundaryProps) {
  return <AIStudioScreen {...props} />;
}
