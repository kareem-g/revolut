import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasTcpSocket } from './native';

// Connection settings for both modes:
//  - 'direct': this phone runs the powerk server (TCP 10086). No PC or VPS.
//  - 'server': an external powerk.py (PC / Raspberry Pi / VPS) via its JSON API.

export type Mode = 'direct' | 'server';

export interface ServerConfig {
  host: string;
  port: number;
  token: string;
}

export interface WifiCreds {
  ssid: string;
  password: string;
}

const DEFAULTS: ServerConfig = { host: '', port: 8080, token: '' };
const EMPTY_WIFI: WifiCreds = { ssid: '', password: '' };

interface ConnCtx extends ServerConfig {
  mode: Mode;
  setMode: (m: Mode) => void;
  save: (host: string, port: number, token: string) => void;
  configured: boolean;
  base: string;
  /** LAN IP written into the strip during provisioning (direct mode). */
  provisionedIp: string;
  setProvisionedIp: (ip: string) => void;
  /** Home Wi-Fi, cached after the first provisioning so re-provisioning needs no typing. */
  homeWifi: WifiCreds;
  setHomeWifi: (w: WifiCreds) => void;
}

const Ctx = createContext<ConnCtx | null>(null);

export function coercePort(value: number | null | undefined): number {
  const p = Math.round(value ?? NaN);
  return Number.isFinite(p) ? Math.min(65535, Math.max(1, p)) : 8080;
}

export function ConnProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>(
    Platform.OS === 'web' || !hasTcpSocket() ? 'server' : 'direct',
  );
  const [config, setConfig] = useState<ServerConfig>(DEFAULTS);
  const [provisionedIp, setProvisionedIpState] = useState('');
  const [homeWifi, setHomeWifiState] = useState<WifiCreds>(EMPTY_WIFI);
  useEffect(() => {
    // Hydrate persisted settings; children render immediately with defaults so
    // the splash can hide on the very first frame (never return null above).
    (async () => {
      try {
        const [m, host, port, token, ip, wifi] = await Promise.all([
          AsyncStorage.getItem('mode'),
          AsyncStorage.getItem('host'),
          AsyncStorage.getItem('port'),
          AsyncStorage.getItem('token'),
          AsyncStorage.getItem('provisioned_ip'),
          AsyncStorage.getItem('home_wifi'),
        ]);
        if (Platform.OS === 'web' || !hasTcpSocket()) setModeState('server');
        else if (m === 'server' || m === 'direct') setModeState(m);
        setConfig({
          host: host ?? '',
          port: coercePort(port ? Number(port) : 8080),
          token: token ?? '',
        });
        setProvisionedIpState(ip ?? '');
        if (wifi) {
          try {
            const parsed = JSON.parse(wifi);
            if (parsed && typeof parsed.ssid === 'string')
              setHomeWifiState({ ssid: parsed.ssid, password: parsed.password ?? '' });
          } catch {}
        }
      } catch {}
    })();
  }, []);

  const value = useMemo<ConnCtx>(() => {
    const setMode = (m: Mode) => {
      setModeState(m);
      AsyncStorage.setItem('mode', m);
    };
    return {
      mode,
      setMode,
      ...config,
      save: (host, port, token) => {
        const clean: ServerConfig = {
          host: host.trim(),
          port: coercePort(port),
          token: token.trim(),
        };
        setConfig(clean);
        AsyncStorage.setItem('host', clean.host);
        AsyncStorage.setItem('port', String(clean.port));
        AsyncStorage.setItem('token', clean.token);
      },
      configured: config.host.trim().length > 0,
      base: `http://${config.host.trim()}:${coercePort(config.port)}`,
      provisionedIp,
      setProvisionedIp: (ip: string) => {
        setProvisionedIpState(ip);
        AsyncStorage.setItem('provisioned_ip', ip);
      },
      homeWifi,
      setHomeWifi: (w: WifiCreds) => {
        setHomeWifiState(w);
        AsyncStorage.setItem('home_wifi', JSON.stringify(w));
      },
    };
  }, [mode, config, provisionedIp, homeWifi]);

  // Children render immediately with default config; settings hydrate after mount.
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConn(): ConnCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useConn outside provider');
  return v;
}
