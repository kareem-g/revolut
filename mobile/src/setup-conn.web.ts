// Web: provisioning needs raw TCP to the strip's setup AP + Wi-Fi control,
// neither of which a browser can do. Keep the surface so imports resolve.

import { WifiCreds } from './provision';

export type LogSink = (key: string, ...args: string[]) => void;

export async function provisionStrip(
  _serverIp: string,
  _home: WifiCreds,
  _onLog: LogSink,
): Promise<void> {
  throw new Error('web_no_provision');
}