import { AIStudioScreen, type AIStudioScreenProps } from './AIStudioScreen';
import { defaultProviderConfigs } from '../../stores/providerStore';
import type { ProviderConfig } from '../../types/project';

export interface AIStudioBoundaryProps extends Omit<AIStudioScreenProps, 'providers'> {
  providers?: readonly ProviderConfig[];
}

/**
 * Thin wrapper around `AIStudioScreen` used by `App.tsx` to code-split the
 * AI Studio into its own chunk via `React.lazy`. Mirrors the convention
 * established by `ProviderSettingsBoundary`, `AssetWorkspaceBoundary`, and
 * `PlaytestWorkspaceBoundary`.
 */
export function AIStudioBoundary({
  providers = defaultProviderConfigs,
  ...props
}: AIStudioBoundaryProps) {
  return <AIStudioScreen {...props} providers={providers} />;
}
