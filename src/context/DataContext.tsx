import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Proyek } from "../lib/columns";
import * as api from "../lib/api";

interface DataState {
  rows: Proyek[];
  byId: Map<string, Proyek>;
  loaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}
const Ctx = createContext<DataState>(null as unknown as DataState);
export const useData = () => useContext(Ctx);

export function DataProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<Proyek[]>([]);
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
        const data = await api.fetchAll();
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
    const off = api.subscribe(() => { clearTimeout(t); t = setTimeout(refresh, 600); });
    return () => { clearTimeout(t); off(); };
  }, [refresh]);

  const byId = useMemo(() => new Map(rows.map((r) => [r.id_proyek, r])), [rows]);
  return <Ctx.Provider value={{ rows, byId, loaded, error, refresh }}>{children}</Ctx.Provider>;
}
