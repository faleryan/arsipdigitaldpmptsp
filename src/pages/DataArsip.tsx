import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download, FileText, Link2, PlusCircle, Search, Trash2, X } from "lucide-react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import { RISIKO, RISIKO_COLOR, SKALA, type Proyek } from "../lib/columns";
import { fmtDateLong, fmtInt, hasArsip, kecLabel, yearOf } from "../lib/format";
import { DetailModal } from "../components/DetailModal";
import { Loading } from "../components/Loading";
import { StatusBanner } from "../components/StatusBanner";
import { Modal } from "../components/Modal";
import * as api from "../lib/api";

type SortKey = "id_proyek" | "nama_perusahaan" | "nama_proyek" | "kec_usaha" | "skala_usaha" | "risiko" | "investasi" | "tgl_pengajuan";

export default function DataArsip() {
  const { rows: all, loaded, refresh } = useData();
  const { canWrite, isAdmin } = useAuth();
  const { toast, confirm } = useUI();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [f, setF] = useState({ kec: "all", skala: "all", risiko: "all", sektor: "all", year: "all", arsip: "all" });
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "tgl_pengajuan", dir: -1 });
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [wipe, setWipe] = useState<{ done: number; total: number } | null>(null);
  const openId = params.get("id");
  const setOpen = (id: string | null) => { const p = new URLSearchParams(params); if (id) p.set("id", id); else p.delete("id"); setParams(p, { replace: !id }); };

  const kecs = useMemo(() => [...new Set(all.map((r) => kecLabel(r.kec_usaha)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id")), [all]);
  const sektors = useMemo(() => [...new Set(all.map((r) => r.sektor).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id")), [all]);
  const years = useMemo(() => [...new Set(all.map(yearOf).filter(Boolean))].sort().reverse(), [all]);

  const rows = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const out = all.filter((r) => {
      if (f.kec !== "all" && kecLabel(r.kec_usaha) !== f.kec) return false;
      if (f.skala !== "all" && r.skala_usaha !== f.skala) return false;
      if (f.risiko !== "all" && r.risiko !== f.risiko) return false;
      if (f.sektor !== "all" && r.sektor !== f.sektor) return false;
      if (f.year !== "all" && yearOf(r) !== f.year) return false;
      if (f.arsip === "ada" && !hasArsip(r)) return false;
      if (f.arsip === "belum" && hasArsip(r)) return false;
      if (terms.length) {
        const hay = [r.id_proyek, r.nib, r.nama_perusahaan, r.nama_proyek, r.kbli, r.judul_kbli, r.alamat_usaha, r.kel_usaha, r.kec_usaha].join(" ").toLowerCase();
        if (!terms.every((t) => hay.includes(t))) return false;
      }
      return true;
    });
    const { k, dir } = sort;
    return out.sort((a, b) => {
      let x: unknown = a[k], y: unknown = b[k];
      if (k === "kec_usaha") { x = kecLabel(a.kec_usaha); y = kecLabel(b.kec_usaha); }
      if (k === "investasi") return (((x as number) ?? -1) - ((y as number) ?? -1)) * dir;
      const sx = String(x ?? ""), sy = String(y ?? "");
      if (!sx && sy) return 1;
      if (sx && !sy) return -1;
      return sx.localeCompare(sy, "id") * dir;
    });
  }, [all, q, f, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / size));
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);
  const pageRows = rows.slice((page - 1) * size, page * size);
  const filtered = q || Object.values(f).some((v) => v !== "all");

  const setFilter = (k: keyof typeof f, v: string) => { setF({ ...f, [k]: v }); setPage(1); };
  const th = (k: SortKey, label: string, cls = "") => (
    <th className={"sortable " + cls} aria-sort={sort.k === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
      onClick={() => setSort(sort.k === k ? { k, dir: (sort.dir * -1) as 1 | -1 } : { k, dir: k === "investasi" || k === "tgl_pengajuan" ? -1 : 1 })}>
      {label}{sort.k === k ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );
  const exportXlsx = async () => {
    try { (await import("../lib/excel")).exportData(rows); } catch (e) { toast("Gagal export: " + (e as Error).message); }
  };
  const wipeAll = async () => {
    if (!(await confirm({ title: "Kosongkan semua data?", body: <>Seluruh <b>{fmtInt(all.length)}</b> data proyek beserta file dokumennya akan dihapus permanen.</>, ok: "Hapus semua", danger: true, typeWord: "HAPUS" }))) return;
    setWipe({ done: 0, total: all.length });
    try { await api.deleteAll(all, (done, total) => setWipe({ done, total })); toast("Semua data dihapus"); }
    catch (e) { toast(api.errMsg(e), 5000); }
    setWipe(null);
    refresh();
  };

  if (!loaded) return <Loading text="Memuat data arsip…" />;

  return (
    <>
      <StatusBanner />
      <div className="head">
        <div><h1>Data Arsip OSS RBA</h1><p>{fmtInt(rows.length)} dari {fmtInt(all.length)} proyek ditampilkan</p></div>
        <div className="head-actions">
          <button className="btn" onClick={exportXlsx} disabled={!rows.length}><Download size={16} />Export Excel</button>
          {canWrite && <Link className="btn primary" to="/oss/input"><PlusCircle size={16} />Tambah data</Link>}
        </div>
      </div>

      <div className="filters">
        <div className="search">
          <Search size={16} />
          <input className="inp" type="search" placeholder="Cari nama usaha, NIB, Id Proyek, KBLI, alamat…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Cari" />
        </div>
        <select className="inp" value={f.kec} onChange={(e) => setFilter("kec", e.target.value)} aria-label="Kecamatan"><option value="all">Semua kecamatan</option>{kecs.map((k) => <option key={k}>{k}</option>)}</select>
        <select className="inp" value={f.skala} onChange={(e) => setFilter("skala", e.target.value)} aria-label="Skala"><option value="all">Semua skala</option>{SKALA.map((k) => <option key={k}>{k}</option>)}</select>
        <select className="inp" value={f.risiko} onChange={(e) => setFilter("risiko", e.target.value)} aria-label="Risiko"><option value="all">Semua risiko</option>{RISIKO.map((k) => <option key={k}>{k}</option>)}</select>
        <select className="inp sektor" value={f.sektor} onChange={(e) => setFilter("sektor", e.target.value)} aria-label="Sektor"><option value="all">Semua sektor</option>{sektors.map((k) => <option key={k}>{k}</option>)}</select>
        <select className="inp" value={f.year} onChange={(e) => setFilter("year", e.target.value)} aria-label="Tahun"><option value="all">Semua tahun</option>{years.map((k) => <option key={k}>{k}</option>)}</select>
        <select className="inp" value={f.arsip} onChange={(e) => setFilter("arsip", e.target.value)} aria-label="Status arsip"><option value="all">Semua status arsip</option><option value="ada">Sudah berdokumen</option><option value="belum">Belum berdokumen</option></select>
        {filtered && <button className="btn ghost sm" onClick={() => { setQ(""); setF({ kec: "all", skala: "all", risiko: "all", sektor: "all", year: "all", arsip: "all" }); setPage(1); }}><X size={14} />Reset</button>}
      </div>

      <div className="card">
        {!all.length ? (
          <div className="empty big"><b>Belum ada data</b>{canWrite && <span><Link to="/oss/import">Import Excel</Link> atau <Link to="/oss/input">input manual</Link>.</span>}</div>
        ) : !rows.length ? (
          <div className="empty big">Tidak ada data yang cocok dengan pencarian/filter.</div>
        ) : (
          <>
            <div className="tbl-wrap desk-only">
              <table className="data-tbl">
                <thead><tr>
                  {th("id_proyek", "Id Proyek")}{th("nama_perusahaan", "Pelaku usaha")}{th("nama_proyek", "Proyek / KBLI")}{th("kec_usaha", "Lokasi usaha")}
                  {th("skala_usaha", "Skala")}{th("risiko", "Risiko")}{th("investasi", "Investasi (Rp)", "num")}{th("tgl_pengajuan", "Tgl pengajuan")}<th>Arsip</th>
                </tr></thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.id_proyek} className="clk" tabIndex={0} onClick={() => setOpen(r.id_proyek)} onKeyDown={(e) => e.key === "Enter" && setOpen(r.id_proyek)}>
                      <td className="nowrap"><span className="mono sm">{r.id_proyek}</span><div className="cell-sub">{r.jenis_proyek}</div></td>
                      <td><div className="cell-main">{r.nama_perusahaan}</div><div className="cell-sub mono">NIB {r.nib}</div></td>
                      <td><div>{r.nama_proyek}</div>{(r.kbli || r.judul_kbli) && <div className="cell-sub"><span className="mono">{r.kbli}</span> · {r.judul_kbli}</div>}</td>
                      <td>{kecLabel(r.kec_usaha)}<div className="cell-sub">{r.kel_usaha}</div></td>
                      <td>{(r.skala_usaha || "").replace("Usaha ", "")}</td>
                      <td><RiskBadge v={r.risiko} /></td>
                      <td className="num">{r.investasi != null ? fmtInt(r.investasi) : "—"}</td>
                      <td className="nowrap">{fmtDateLong(r.tgl_pengajuan)}</td>
                      <td><ArsipBadge r={r} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mob-list mob-only">
              {pageRows.map((r) => (
                <button key={r.id_proyek} className="mob-item" onClick={() => setOpen(r.id_proyek)}>
                  <div className="mob-top"><b>{r.nama_proyek || r.nama_perusahaan}</b><ArsipBadge r={r} /></div>
                  <div className="cell-sub">{r.nama_perusahaan} · NIB {r.nib}</div>
                  <div className="cell-sub">{r.kbli} · {r.judul_kbli}</div>
                  <div className="mob-meta"><RiskBadge v={r.risiko} /><span>{kecLabel(r.kec_usaha)}</span><span>{fmtDateLong(r.tgl_pengajuan)}</span></div>
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
      {isAdmin && all.length > 0 && <div className="danger-zone"><button className="btn sm danger" onClick={wipeAll}><Trash2 size={14} />Kosongkan semua data…</button></div>}

      {openId && <DetailModal id={openId} onClose={() => setOpen(null)} />}
      {wipe && (
        <Modal onClose={() => {}} size="sm"><div className="modal-b"><h2>Menghapus data…</h2><div className="progress"><i style={{ width: `${(wipe.done / Math.max(1, wipe.total)) * 100}%` }} /></div><div className="cell-sub">{fmtInt(wipe.done)} / {fmtInt(wipe.total)}</div></div></Modal>
      )}
    </>
  );
}

export function RiskBadge({ v }: { v: string }) {
  if (!v) return null;
  const c = RISIKO_COLOR[v];
  return <span className="badge"><i style={{ background: c ? c[0] : "var(--muted)" }} />{v}</span>;
}
function ArsipBadge({ r }: { r: Proyek }) {
  const n = r.oss_dokumen?.length || 0;
  if (n) return <span className="badge ok" title={`${n} dokumen`}><FileText size={13} />{n}</span>;
  if (r.arsip_dokumen) return <span className="badge" title="Ada tautan/keterangan arsip"><Link2 size={13} /></span>;
  return <span className="cell-sub">—</span>;
}
