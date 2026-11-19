import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Proyek } from "../lib/columns";
import type { Izin } from "../lib/sicantik";
import * as api from "../lib/api";

interface Store<T> {
  rows: T[];
  byId: Map<string, T>;
  loaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Membuat penyimpanan data (cache + realtime) untuk satu tabel */
function createStore<T>(name: string, tables: string[], fetcher: () => Promise<T[]>, keyOf: (r: T) => string) {
  const Ctx = createContext<Store<T>>(null as unknown as Store<T>);
  function Provider({ children }: { children: ReactNode }) {
    const [rows, setRows] = useState<T[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const busy = useRef(false);
    const again = useRef(false);
    const refresh = useCallback(async () => {
      if (busy.current) { again.current = true; return; }
      busy.current = true;
      try {
        do {
          again.current = false;
          const data = await fetcher();
          setRows(data);
          setError(null);
          setLoaded(true);
        } while (again.current);
      } catch (e) {
        setError(api.errMsg(e));
        setLoaded(true);
      } finally {
        busy.current = false;
      }
    }, []);
    useEffect(() => {
      refresh();
      let t: ReturnType<typeof setTimeout>;
      const off = api.subscribe(name, tables, () => { clearTimeout(t); t = setTimeout(refresh, 600); });
      return () => { clearTimeout(t); off(); };
    }, [refresh]);
    const byId = useMemo(() => new Map(rows.map((r) => [keyOf(r), r])), [rows]);
    return <Ctx.Provider value={{ rows, byId, loaded, error, refresh }}>{children}</Ctx.Provider>;
  }
  return { Provider, use: () => useContext(Ctx) };
}

const oss = createStore<Proyek>("oss-changes", ["oss_proyek", "oss_dokumen"], api.fetchAll, (r) => r.id_proyek);
const sic = createStore<Izin>("sicantik-changes", ["sicantik_izin", "sicantik_dokumen"], api.fetchAllSicantik, (r) => r.id_sicantik);

export const useData = oss.use;
export const useSicantik = sic.use;
export function DataProvider({ children }: { children: ReactNode }) {
  return <oss.Provider><sic.Provider>{children}</sic.Provider></oss.Provider>;
}
