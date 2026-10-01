// Optional native modules that are NOT present in Expo Go (or in a browser).
//
// The subtle part: react-native-tcp-socket runs `new NativeEventEmitter(undefined)`
// at module-evaluation time when its native module is absent, which throws. So we
// must check for the native module's presence WITHOUT importing that package.

import { NativeModules, Platform } from 'react-native';

type TcpModule = {
  createServer: (...args: any[]) => any;
  createConnection: (...args: any[]) => any;
};

let tcpCache: TcpModule | null | undefined;

function nativeModuleExists(name: string): boolean {
  try {
    return (NativeModules as Record<string, unknown>)[name] != null;
  } catch {
    return false;
  }
}

export function loadTcpSocket(): TcpModule | null {
  if (tcpCache === undefined) {
    // `NativeModules.TcpSockets` reads as undefined here and does not throw; only
    // importing the package (which wires up a NativeEventEmitter) would throw.
    if (Platform.OS === 'web' || !nativeModuleExists('TcpSockets')) {
      tcpCache = null;
    } else {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('react-native-tcp-socket');
        tcpCache = (mod?.default ?? mod) as TcpModule;
      } catch {
        tcpCache = null;
      }
    }
  }
  return tcpCache;
}

export function hasTcpSocket(): boolean {
  return loadTcpSocket() !== null;
}

export function hasWifiModule(): boolean {
  return Platform.OS !== 'web' && nativeModuleExists('WifiManager');
}