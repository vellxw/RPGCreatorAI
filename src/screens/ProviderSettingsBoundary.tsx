import { SettingsScreen } from './SettingsScreen';
import { useProviderStore } from '../stores/providerStore';

export default function ProviderSettingsBoundary() {
  const providerStore = useProviderStore();
  return <SettingsScreen providerStore={providerStore} />;
}
