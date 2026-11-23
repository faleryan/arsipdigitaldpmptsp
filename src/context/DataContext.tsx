import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Pelaku, Proyek } from "../lib/columns";
import type { Izin, Pemohon } from "../lib/sicantik";
import * as api from "../lib/api";

export interface Store<T> {
  rows: T[];
  byId: Map<string, T>;
  loaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Penyimpanan data (cache + realtime) untuk satu tabel */
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
    const value = useMemo(() => ({ rows, byId, loaded, error, refresh }), [rows, byId, loaded, error, refresh]);
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }
  return { Provider, use: () => useContext(Ctx) };
}

/** Gabungkan dua store (induk + transaksi) menjadi satu baris datar */
function createJoined<T, M>(a: { use: () => Store<T> }, m: { use: () => Store<M> }, join: (r: T, master: Map<string, M>) => T, keyOf: (r: T) => string) {
  const Ctx = createContext<Store<T>>(null as unknown as Store<T>);
  function Provider({ children }: { children: ReactNode }) {
    const t = a.use(), ms = m.use();
    const rows = useMemo(() => t.rows.map((r) => join(r, ms.byId)), [t.rows, ms.byId]);
    const byId = useMemo(() => new Map(rows.map((r) => [keyOf(r), r])), [rows]);
    const refresh = useCallback(async () => { await Promise.all([t.refresh(), ms.refresh()]); }, [t.refresh, ms.refresh]);
    const value = useMemo(() => ({ rows, byId, loaded: t.loaded && ms.loaded, error: t.error || ms.error, refresh }), [rows, byId, t.loaded, ms.loaded, t.error, ms.error, refresh]);
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }
  return { Provider, use: () => useContext(Ctx) };
}

const pelaku = createStore<Pelaku>("pelaku-changes", ["pelaku_usaha"], api.fetchPelaku, (r) => r.nib);
const proyek = createStore<Proyek>("oss-changes", ["oss_proyek", "oss_dokumen"], api.fetchProyek, (r) => r.id_proyek);
const pemohon = createStore<Pemohon>("pemohon-changes", ["sicantik_pemohon"], api.fetchPemohon, (r) => r.id_pemohon);
const izin = createStore<Izin>("sicantik-changes", ["sicantik_izin", "sicantik_dokumen"], api.fetchIzin, (r) => r.id_sicantik);

const oss = createJoined(proyek, pelaku, (r, m) => {
  const p = m.get(r.nib);
  return p ? { ...r, ...p, nib: r.nib, created_at: r.created_at, updated_at: r.updated_at } : { ...r, nama_perusahaan: r.nama_perusahaan || "(pelaku tidak ditemukan)" } as Proyek;
}, (r) => r.id_proyek);
const sic = createJoined(izin, pemohon, (r, m) => {
  const p = m.get(r.pemohon_id);
  return { ...r, pemohon: p?.nama ?? "", no_ktp: p?.no_ktp ?? "", no_hp: p?.no_hp ?? "", email: p?.email ?? "" };
}, (r) => r.id_sicantik);

/** Proyek OSS lengkap dengan data pelaku usahanya */
export const useData = oss.use;
export const usePelaku = pelaku.use;
/** Permohonan SiCantik lengkap dengan data pemohonnya */
export const useSicantik = sic.use;
export const usePemohon = pemohon.use;

export function DataProvider({ children }: { children: ReactNode }) {
  return (
    <pelaku.Provider><proyek.Provider><oss.Provider>
      <pemohon.Provider><izin.Provider><sic.Provider>
        {children}
      </sic.Provider></izin.Provider></pemohon.Provider>
    </oss.Provider></proyek.Provider></pelaku.Provider>
  );
}
