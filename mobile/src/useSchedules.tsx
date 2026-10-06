import React, { createContext, useContext, useEffect, useState } from 'react';
import { OutletSchedule, loadSchedules, saveSchedules } from './schedules';

// Shared schedule state so Plugs (tile badges) and Automation (the editor)
// always see the same list.

interface Ctx {
  schedules: OutletSchedule[];
  save: (list: OutletSchedule[]) => void;
  /** Adopt a server-authoritative list (server mode) without persisting locally. */
  hydrate: (list: OutletSchedule[]) => void;
  count: (mac: string, outlet: number) => number;
}

const Ctx = createContext<Ctx | null>(null);

export function SchedulesProvider({ children }: { children: React.ReactNode }) {
  const [schedules, setSchedules] = useState<OutletSchedule[]>([]);

  useEffect(() => {
    void loadSchedules().then(setSchedules);
  }, []);

  const save = (list: OutletSchedule[]) => {
    setSchedules(list);
    void saveSchedules(list);
  };

  const hydrate = (list: OutletSchedule[]) => setSchedules(list);

  const count = (mac: string, outlet: number) =>
    schedules.filter((s) => s.enabled && s.mac === mac && s.outlet === outlet).length;

  return (
    <Ctx.Provider value={{ schedules, save, hydrate, count }}>{children}</Ctx.Provider>
  );
}

export function useSchedules(): Ctx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSchedules outside provider');
  return v;
}
