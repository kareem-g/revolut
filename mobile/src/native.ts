// Optional native modules that are NOT present in Expo Go (or in a browser).
// Loading them lazily lets the same bundle run in Expo Go with graceful
// degradation, while the real native build keeps full functionality.

type TcpModule = {
  createServer: (...args: any[]) => any;
  createConnection: (...args: any[]) => any;
};

let tcpCache: TcpModule | null | undefined;

export function loadTcpSocket(): TcpModule | null {
  if (tcpCache === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('react-native-tcp-socket');
      tcpCache = (mod?.default ?? mod) as TcpModule;
    } catch {
      tcpCache = null;
    }
  }
  return tcpCache;
}

export function hasTcpSocket(): boolean {
  return loadTcpSocket() !== null;
}