import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useConn } from './server';

// Strip + outlet naming. Server mode: names live in powerk.py and ride the
// snapshot. Direct mode: the hub protocol has no names, so this provider keeps
// a per-device overlay in AsyncStorage and applies it at display time.

interface StripNames {
  strip?: string;
  outlets?: Record<string, string>;
}
type NamesMap = Record<string, StripNames>; // key: MAC (upper case)

const KEY = 'device_names';

interface Ctx {
  /** Display name for a strip (overlay in direct mode, fallback otherwise). */
  stripName: (mac: string, fallback: string) => string;
  /** Display name for one outlet (overlay in direct mode, fallback otherwise). */
  outletName: (mac: string, n: number, fallback: string) => string;
  /** Persists a local overlay (direct mode). null clears a name. */
  saveLocal: (
    mac: string,
    patch: { strip?: string | null; outlets?: Record<number, string | null> },
  ) => Promise<void>;
}

const Ctx = createContext<Ctx | null>(null);

export function NamesProvider({ children }: { children: React.ReactNode }) {
  const conn = useConn();
  const direct = conn.mode === 'direct';
  const [names, setNames] = useState<NamesMap>({});

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setNames(JSON.parse(raw) as NamesMap);
      })
      .catch(() => undefined);
  }, []);

  const saveLocal: Ctx['saveLocal'] = async (mac, patch) => {
    const key = mac.toUpperCase();
    setNames((prev) => {
      const entry: StripNames = { ...prev[key] };
      if (patch.strip !== undefined) entry.strip = patch.strip || undefined;
      if (patch.outlets) {
        const outlets = { ...(entry.outlets ?? {}) };
        for (const [n, name] of Object.entries(patch.outlets)) {
          if (name) outlets[n] = name;
          else delete outlets[n];
        }
        entry.outlets = outlets;
      }
      const next = { ...prev, [key]: entry };
      void AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  };

  const stripName = (mac: string, fallback: string) =>
    (direct && names[mac.toUpperCase()]?.strip) || fallback;

  const outletName = (mac: string, n: number, fallback: string) =>
    (direct && names[mac.toUpperCase()]?.outlets?.[String(n)]) || fallback;

  return (
    <Ctx.Provider value={{ stripName, outletName, saveLocal }}>{children}</Ctx.Provider>
  );
}

export function useNames(): Ctx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useNames outside provider');
  return v;
}
