import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useProviderStore } from '../providerStore';

type ProviderStoreSnapshot = ReturnType<typeof useProviderStore>;

function captureProviderStore(): ProviderStoreSnapshot {
  let snapshot: ProviderStoreSnapshot | null = null;

  function Capture() {
    snapshot = useProviderStore();
    return null;
  }

  renderToStaticMarkup(<Capture />);
  if (!snapshot) throw new Error('provider store did not render');
  return snapshot as ProviderStoreSnapshot;
}

describe('useProviderStore', () => {
  it('starts with providers disconnected and without required model defaults', () => {
    const { providers, routing } = captureProviderStore();

    expect(providers).not.toHaveLength(0);
    expect(providers.every(provider => provider.apiKey === '')).toBe(true);
    expect(providers.every(provider => provider.model === '')).toBe(true);
    expect(providers.every(provider => provider.status !== 'connected')).toBe(true);
    expect(Object.values(routing).every(value => value === 'disabled')).toBe(true);
  });
});
