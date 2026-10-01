import { Platform } from 'react-native';
import { hasWifiModule } from './native';

// Thin wrapper over react-native-wifi-reborn so the rest of the app never
// touches the library directly (swappable if native builds change).

interface WifiReborn {
  connectToProtectedSSID(ssid: string, password: string, isWep: boolean): Promise<void>;
  disconnectFromHiddenNetwork(ssid: string, remove: boolean): Promise<boolean>;
}

function wifiModule(): WifiReborn {
  if (!hasWifiModule()) throw new Error('web_no_wifi');
  // Autolinked native module; required lazily so jest/node never loads it.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('react-native-wifi-reborn');
  return (mod.default ?? mod) as WifiReborn;
}

export async function joinNetwork(ssid: string, password: string): Promise<void> {
  if (Platform.OS === 'web') throw new Error('web_no_wifi');
  // iOS: NEHotspotConfigurationManager — the system dialog asks the user to approve.
  // Android: WifiManager direct connect; may need location services on.
  await wifiModule().connectToProtectedSSID(ssid, password, false);
}

/** Drops a remembered network configuration (iOS hotspot config cleanup). */
export function forgetNetwork(ssid: string): void {
  if (Platform.OS !== 'ios') return;
  try {
    wifiModule().disconnectFromHiddenNetwork(ssid, true);
  } catch {}
}

export async function rejoinHome(home: { ssid: string; password: string }): Promise<void> {
  if (Platform.OS === 'web') throw new Error('web_no_wifi');
  await wifiModule().connectToProtectedSSID(home.ssid, home.password, false);
}

export function isWifiError(e: unknown): boolean {
  const code = (e as { code?: string })?.code ?? '';
  return typeof code === 'string' && code.length > 0;
}
