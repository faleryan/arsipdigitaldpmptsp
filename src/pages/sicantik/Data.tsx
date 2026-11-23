import { useEffect, useMemo, useState } from "react";
import { katIzin } from "../../lib/master";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download, FileText, Link2, PlusCircle, Search, Trash2, X } from "lucide-react";
import { usePemohon, useSicantik } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { useUI } from "../../context/UIContext";
import { fmtDateLong, fmtInt, isISO } from "../../lib/format";
import { izinShort, JENIS_COLOR, JENIS_PERMOHONAN, STATUS, statusOf, type Izin } from "../../lib/sicantik";
import { IzinDetail } from "../../components/IzinDetail";
import { Loading } from "../../components/Loading";
import { StatusBanner } from "../../components/StatusBanner";
import { Modal } from "../../components/Modal";
import * as api from "../../lib/api";

type SortKey = "id_sicantik" | "pemohon" | "izin" | "jenis" | "lokasi" | "tanggal" | "tgl_penetapan";
const EMPTY = { kat: "all", izin: "all", jenis: "all", status: "all", year: "all", arsip: "all" };
const hasArsipIzin = (r: Izin) => (r.sicantik_dokumen?.length || 0) > 0 || !!r.keterangan;

export default function SicantikData() {
  const { rows: all, loaded, refresh } = useSicantik();
  const pemohonStore = usePemohon();
  const { canWrite, isAdmin } = useAuth();
  const { toast, confirm } = useUI();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [f, setF] = useState(EMPTY);
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "tanggal", dir: -1 });
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [wipe, setWipe] = useState<{ done: number; total: number } | null>(null);
  const openId = params.get("id");
  const setOpen = (id: string | null) => { const p = new URLSearchParams(params); if (id) p.set("id", id); else p.delete("id"); setParams(p, { replace: !id }); };

  const perPemohon = useMemo(() => { const m = new Map<string, number>(); all.forEach((r) => m.set(r.pemohon_id, (m.get(r.pemohon_id) || 0) + 1)); return m; }, [all]);
  const kats = useMemo(() => [...new Set(all.map((r) => katIzin(r)))].sort(), [all]);
  const izins = useMemo(() => [...new Set(all.map((r) => r.izin).filter(Boolean))].sort((a, b) => izinShort(a).localeCompare(izinShort(b), "id")), [all]);
  const years = useMemo(() => [...new Set(all.map((r) => (isISO(r.tanggal) ? r.tanggal.slice(0, 4) : "")).filter(Boolean))].sort().reverse(), [all]);

  const rows = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const out = all.filter((r) => {
      if (f.kat !== "all" && katIzin(r) !== f.kat) return false;
      if (f.izin !== "all" && r.izin !== f.izin) return false;
      if (f.jenis !== "all" && r.jenis !== f.jenis) return false;
      if (f.status !== "all" && statusOf(r) !== f.status) return false;
      if (f.year !== "all" && !(isISO(r.tanggal) && r.tanggal.startsWith(f.year))) return false;
      if (f.arsip === "ada" && !hasArsipIzin(r)) return false;
      if (f.arsip === "belum" && hasArsipIzin(r)) return false;
      if (terms.length) {
        const hay = [r.id_sicantik, r.pemohon, r.izin, r.nomor_izin, r.no_permohonan, r.no_ktp, r.lokasi, r.email, r.no_hp].join(" ").toLowerCase();
        if (!terms.every((t) => hay.includes(t))) return false;
      }
      return true;
    });
    const { k, dir } = sort;
    return out.sort((a, b) => {
      const sx = String(a[k] ?? ""), sy = String(b[k] ?? "");
      if (!sx && sy) return 1;
      if (sx && !sy) return -1;
      return sx.localeCompare(sy, "id", { numeric: true }) * dir;
    });
  }, [all, q, f, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / size));
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);
  const pageRows = rows.slice((page - 1) * size, page * size);
  const filtered = q || Object.values(f).some((v) => v !== "all");
  const setFilter = (k: keyof typeof f, v: string) => { setF({ ...f, [k]: v }); setPage(1); };
  const th = (k: SortKey, label: string) => (
    <th className="sortable" aria-sort={sort.k === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
      onClick={() => setSort(sort.k === k ? { k, dir: (sort.dir * -1) as 1 | -1 } : { k, dir: k === "tanggal" || k === "tgl_penetapan" ? -1 : 1 })}>
      {label}{sort.k === k ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );
  const exportXlsx = async () => { try { (await import("../../lib/excel")).exportIzin(rows); } catch (e) { toast("Gagal export: " + (e as Error).message); } };
  const wipeAll = async () => {
    if (!(await confirm({ title: "Kosongkan semua data SiCantik?", body: <>Seluruh <b>{fmtInt(all.length)}</b> permohonan, <b>{fmtInt(pemohonStore.rows.length)}</b> pemohon, beserta file dokumennya akan dihapus permanen.</>, ok: "Hapus semua", danger: true, typeWord: "HAPUS" }))) return;
    setWipe({ done: 0, total: all.length + pemohonStore.rows.length });
    try { await api.deleteAllSicantik(all, pemohonStore.rows, (done, total) => setWipe({ done, total })); toast("Semua data SiCantik dihapus"); }
    catch (e) { toast(api.errMsg(e), 5000); }
    setWipe(null);
    refresh();
  };

  if (!loaded) return <Loading text="Memuat data SiCantik…" />;

  return (
    <>
      <StatusBanner kind="sicantik" />
      <div className="head">
        <div><h1>Data Arsip SiCantik</h1><p>{fmtInt(rows.length)} dari {fmtInt(all.length)} permohonan ditampilkan</p></div>
        <div className="head-actions">
          <button className="btn" onClick={exportXlsx} disabled={!rows.length}><Download size={16} />Export Excel</button>
          {canWrite && <Link className="btn primary" to="/sicantik/input"><PlusCircle size={16} />Tambah data</Link>}
        </div>
      </div>
      <div className="filters">
        <div className="search"><Search size={16} />
          <input className="inp" type="search" placeholder="Cari pemohon, nomor izin, no. permohonan, KTP, lokasi…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Cari" />
        </div>
        <select className="inp" value={f.kat} onChange={(e) => setFilter("kat", e.target.value)} aria-label="Kategori"><option value="all">Semua kategori</option>{kats.map((k) => <option key={k}>{k}</option>)}</select>
        <select className="inp sektor" value={f.izin} onChange={(e) => setFilter("izin", e.target.value)} aria-label="Jenis izin"><option value="all">Semua jenis izin</option>{izins.map((k) => <option key={k} value={k}>{izinShort(k)}</option>)}</select>
        <select className="inp" value={f.jenis} onChange={(e) => setFilter("jenis", e.target.value)} aria-label="Jenis permohonan"><option value="all">Semua permohonan</option>{JENIS_PERMOHONAN.map((k) => <option key={k}>{k}</option>)}</select>
        <select className="inp" value={f.status} onChange={(e) => setFilter("status", e.target.value)} aria-label="Status"><option value="all">Semua status</option>{STATUS.map((k) => <option key={k}>{k}</option>)}</select>
        <select className="inp" value={f.year} onChange={(e) => setFilter("year", e.target.value)} aria-label="Tahun"><option value="all">Semua tahun</option>{years.map((k) => <option key={k}>{k}</option>)}</select>
        <select className="inp" value={f.arsip} onChange={(e) => setFilter("arsip", e.target.value)} aria-label="Status arsip"><option value="all">Semua status arsip</option><option value="ada">Sudah berdokumen</option><option value="belum">Belum berdokumen</option></select>
        {filtered && <button className="btn ghost sm" onClick={() => { setQ(""); setF(EMPTY); setPage(1); }}><X size={14} />Reset</button>}
      </div>

      <div className="card">
        {!all.length ? (
          <div className="empty big"><b>Belum ada data</b>{canWrite && <span><Link to="/sicantik/import">Import Excel</Link> atau <Link to="/sicantik/input">input manual</Link>.</span>}</div>
        ) : !rows.length ? (
          <div className="empty big">Tidak ada data yang cocok dengan pencarian/filter.</div>
        ) : (
          <>
            <div className="tbl-wrap desk-only">
              <table className="data-tbl sic">
                <thead><tr>{th("pemohon", "Pemohon")}{th("izin", "Izin / nomor")}{th("jenis", "Permohonan")}{th("lokasi", "Lokasi")}{th("tanggal", "Tgl permohonan")}{th("tgl_penetapan", "Tgl penetapan")}<th>Arsip</th></tr></thead>
                <tbody>{pageRows.map((r) => (
                  <tr key={r.id_sicantik} className="clk" tabIndex={0} onClick={() => setOpen(r.id_sicantik)} onKeyDown={(e) => e.key === "Enter" && setOpen(r.id_sicantik)}>
                    <td><div className="cell-main">{r.pemohon}</div><div className="cell-sub mono">ID {r.id_sicantik}{(perPemohon.get(r.pemohon_id) || 0) > 1 && <span className="multi"> · {perPemohon.get(r.pemohon_id)} izin</span>}</div></td>
                    <td><div title={r.izin}>{izinShort(r.izin)}</div><div className="cell-sub mono">{r.nomor_izin || "—"}</div></td>
                    <td><JenisBadge v={r.jenis} /></td>
                    <td>{r.lokasi || <span className="cell-sub">—</span>}</td>
                    <td className="nowrap">{fmtDateLong(r.tanggal)}</td>
                    <td className="nowrap">{r.tgl_penetapan ? fmtDateLong(r.tgl_penetapan) : <span className="badge warn">Belum</span>}</td>
                    <td><ArsipBadge r={r} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="mob-list mob-only">
              {pageRows.map((r) => (
                <button key={r.id_sicantik} className="mob-item" onClick={() => setOpen(r.id_sicantik)}>
                  <div className="mob-top"><b>{r.pemohon}</b><ArsipBadge r={r} /></div>
                  <div className="cell-sub">{izinShort(r.izin)}</div>
                  <div className="cell-sub mono">{r.nomor_izin || "Belum ada nomor izin"}</div>
                  <div className="mob-meta"><JenisBadge v={r.jenis} /><span>{fmtDateLong(r.tanggal)}</span>{!r.tgl_penetapan && <span className="badge warn">Belum ditetapkan</span>}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {rows.length > 0 && (
        <div className="pager">
          <span>Halaman {page} dari {pages} · <select className="inp xs" value={size} onChange={(e) => { setSize(+e.target.value); setPage(1); }} aria-label="Baris per halaman">{[20, 50, 100].map((n) => <option key={n}>{n}</option>)}</select> baris</span>
          <span className="row-gap">
            <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} />Sebelumnya</button>
            <button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Berikutnya<ChevronRight size={16} /></button>
          </span>
        </div>
      )}
      {isAdmin && all.length > 0 && <div className="danger-zone"><button className="btn sm danger" onClick={wipeAll}><Trash2 size={14} />Kosongkan semua data SiCantik…</button></div>}
      {openId && <IzinDetail id={openId} onClose={() => setOpen(null)} />}
      {wipe && <Modal onClose={() => {}} size="sm"><div className="modal-b"><h2>Menghapus data…</h2><div className="progress"><i style={{ width: `${(wipe.done / Math.max(1, wipe.total)) * 100}%` }} /></div><div className="cell-sub">{fmtInt(wipe.done)} / {fmtInt(wipe.total)}</div></div></Modal>}
    </>
  );
}

export function JenisBadge({ v }: { v: string }) {
  if (!v) return null;
  const c = JENIS_COLOR[v];
  return <span className="badge"><i style={{ background: c ? c[0] : "var(--muted)" }} />{v}</span>;
}
function ArsipBadge({ r }: { r: Izin }) {
  const n = r.sicantik_dokumen?.length || 0;
  if (n) return <span className="badge ok" title={`${n} dokumen`}><FileText size={13} />{n}</span>;
  if (r.keterangan) return <span className="badge" title="Ada tautan/keterangan arsip"><Link2 size={13} /></span>;
  return <span className="cell-sub">—</span>;
}
