import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BadgeCheck, ChevronDown, ChevronLeft, ChevronRight, Download, FileText, Layers, Link2, List, PlusCircle, Search, Trash2, X } from "lucide-react";
import { useData, useKbli, usePelaku } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import { RISIKO, RISIKO_COLOR, SKALA, type Proyek } from "../lib/columns";
import { fmtDateLong, fmtInt, fmtRpShort, hasArsip, kecLabel, yearOf } from "../lib/format";
import { PelakuModal } from "../components/PelakuModal";
import { DetailModal } from "../components/DetailModal";
import { Loading } from "../components/Loading";
import { StatusBanner } from "../components/StatusBanner";
import { Modal } from "../components/Modal";
import * as api from "../lib/api";

type SortKey = "id_proyek" | "nama_perusahaan" | "nama_proyek" | "kec_usaha" | "skala_usaha" | "risiko" | "investasi" | "tgl_pengajuan";
type GSortKey = "nama" | "n" | "inv" | "last";
interface Group { nib: string; first: Proyek; rows: Proyek[]; inv: number; last: string; kecs: string[]; kbli: string[]; docsProyek: number; docsPelaku: number }
const VIEW_KEY = "arsip-oss-view";

export default function DataArsip() {
  const { rows: all, loaded, refresh } = useData();
  const pelakuStore = usePelaku();
  const kb = useKbli();
  const { canWrite, isAdmin } = useAuth();
  const { toast, confirm } = useUI();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [f, setF] = useState({ kec: "all", skala: "all", risiko: "all", sektor: "all", year: "all", arsip: "all", katKbli: "all" });
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "tgl_pengajuan", dir: -1 });
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [wipe, setWipe] = useState<{ done: number; total: number } | null>(null);
  const [view, setViewState] = useState<"nib" | "proyek">(() => { try { return localStorage.getItem(VIEW_KEY) === "proyek" ? "proyek" : "nib"; } catch { return "nib"; } });
  const setView = (v: "nib" | "proyek") => { setViewState(v); setPage(1); try { localStorage.setItem(VIEW_KEY, v); } catch { /* abaikan */ } };
  const [gsort, setGsort] = useState<{ k: GSortKey; dir: 1 | -1 }>({ k: "last", dir: -1 });
  const [open, setOpenSet] = useState<Set<string>>(new Set());
  const [pelakuOpen, setPelakuOpen] = useState<string | null>(null);
  const openId = params.get("id");
  const setOpen = (id: string | null) => { const p = new URLSearchParams(params); if (id) p.set("id", id); else p.delete("id"); setParams(p, { replace: !id }); };

  const perNib = useMemo(() => { const m = new Map<string, number>(); all.forEach((r) => m.set(r.nib, (m.get(r.nib) || 0) + 1)); return m; }, [all]);
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
      if (f.katKbli !== "all" && kb.index.kategoriOf(r.kbli) !== f.katKbli) return false;
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
  }, [all, q, f, sort, kb.index]);

  // kelompok per NIB (pelaku usaha) dari proyek yang lolos filter
  const groups = useMemo<Group[]>(() => {
    const m = new Map<string, Group>();
    for (const r of rows) {
      let g = m.get(r.nib);
      if (!g) { g = { nib: r.nib, first: r, rows: [], inv: 0, last: "", kecs: [], kbli: [], docsProyek: 0, docsPelaku: r.pelaku_dokumen?.length || 0 }; m.set(r.nib, g); }
      g.rows.push(r); g.inv += r.investasi || 0; g.docsProyek += r.oss_dokumen?.length || 0;
      if ((r.tgl_pengajuan || "") > g.last) g.last = r.tgl_pengajuan || "";
      const k = kecLabel(r.kec_usaha); if (k && !g.kecs.includes(k)) g.kecs.push(k);
      if (r.kbli && !g.kbli.includes(r.kbli)) g.kbli.push(r.kbli);
    }
    const { k, dir } = gsort;
    return [...m.values()].sort((a, b) => {
      if (k === "n") return (a.rows.length - b.rows.length) * dir || a.first.nama_perusahaan.localeCompare(b.first.nama_perusahaan, "id");
      if (k === "inv") return (a.inv - b.inv) * dir;
      if (k === "last") return a.last.localeCompare(b.last) * dir;
      return a.first.nama_perusahaan.localeCompare(b.first.nama_perusahaan, "id") * dir;
    });
  }, [rows, gsort]);
  const unitCount = view === "nib" ? groups.length : rows.length;
  const pages = Math.max(1, Math.ceil(unitCount / size));
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);
  const pageRows = rows.slice((page - 1) * size, page * size);
  const pageGroups = groups.slice((page - 1) * size, page * size);
  const toggle = (nib: string) => setOpenSet((o) => { const n = new Set(o); if (n.has(nib)) n.delete(nib); else n.add(nib); return n; });
  const allOpen = pageGroups.length > 0 && pageGroups.every((g) => open.has(g.nib));
  const gth = (k: GSortKey, label: string, cls = "") => (
    <th className={"sortable " + cls} aria-sort={gsort.k === k ? (gsort.dir === 1 ? "ascending" : "descending") : "none"}
      onClick={() => setGsort(gsort.k === k ? { k, dir: (gsort.dir * -1) as 1 | -1 } : { k, dir: k === "nama" ? 1 : -1 })}>
      {label}{gsort.k === k ? (gsort.dir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );
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
    if (!(await confirm({ title: "Kosongkan semua data?", body: <>Seluruh <b>{fmtInt(all.length)}</b> proyek, <b>{fmtInt(pelakuStore.rows.length)}</b> pelaku usaha, beserta file dokumennya akan dihapus permanen.</>, ok: "Hapus semua", danger: true, typeWord: "HAPUS" }))) return;
    setWipe({ done: 0, total: all.length + pelakuStore.rows.length });
    try { await api.deleteAllOss(all, pelakuStore.rows, (done, total) => setWipe({ done, total })); toast("Semua data OSS dihapus"); }
    catch (e) { toast(api.errMsg(e), 5000); }
    setWipe(null);
    refresh();
  };

  if (!loaded) return <Loading text="Memuat data arsip…" />;

  return (
    <>
      <StatusBanner />
      <div className="head">
        <div><h1>Data Arsip OSS RBA</h1><p>{fmtInt(rows.length)} dari {fmtInt(all.length)} proyek · {fmtInt(groups.length)} pelaku usaha (NIB)</p></div>
        <div className="head-actions">
          <button className="btn" onClick={exportXlsx} disabled={!rows.length}><Download size={16} />Export Excel</button>
          {canWrite && <Link className="btn primary" to="/oss/input"><PlusCircle size={16} />Tambah data</Link>}
        </div>
      </div>

      <div className="filters">
        <div className="search">
          <Search size={16} />
          <input className="inp" type="search" placeholder="Cari nama usaha, NIB, nomor permohonan, KBLI, alamat…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Cari" />
        </div>
        <select className="inp" value={f.kec} onChange={(e) => setFilter("kec", e.target.value)} aria-label="Kecamatan"><option value="all">Semua kecamatan</option>{kecs.map((k) => <option key={k}>{k}</option>)}</select>
        <select className="inp" value={f.skala} onChange={(e) => setFilter("skala", e.target.value)} aria-label="Skala"><option value="all">Semua skala</option>{SKALA.map((k) => <option key={k}>{k}</option>)}</select>
        <select className="inp" value={f.risiko} onChange={(e) => setFilter("risiko", e.target.value)} aria-label="Risiko"><option value="all">Semua risiko</option>{RISIKO.map((k) => <option key={k}>{k}</option>)}</select>
        <select className="inp sektor" value={f.sektor} onChange={(e) => setFilter("sektor", e.target.value)} aria-label="Sektor"><option value="all">Semua sektor</option>{sektors.map((k) => <option key={k}>{k}</option>)}</select>
        {kb.rows.length > 0 && <select className="inp" value={f.katKbli} onChange={(e) => setFilter("katKbli", e.target.value)} aria-label="Kategori KBLI"><option value="all">Semua kategori KBLI</option>{[...kb.index.kategoriJudul.keys()].sort().map((k) => <option key={k} value={k}>{kb.index.kategoriLabel(k).slice(0, 48)}</option>)}</select>}
        <select className="inp" value={f.year} onChange={(e) => setFilter("year", e.target.value)} aria-label="Tahun"><option value="all">Semua tahun</option>{years.map((k) => <option key={k}>{k}</option>)}</select>
        <select className="inp" value={f.arsip} onChange={(e) => setFilter("arsip", e.target.value)} aria-label="Status arsip"><option value="all">Semua status arsip</option><option value="ada">Sudah berdokumen</option><option value="belum">Belum berdokumen</option></select>
        {filtered && <button className="btn ghost sm" onClick={() => { setQ(""); setF({ kec: "all", skala: "all", risiko: "all", sektor: "all", year: "all", arsip: "all", katKbli: "all" }); setPage(1); }}><X size={14} />Reset</button>}
      </div>

      <div className="view-bar">
        <div className="seg" role="group" aria-label="Tampilan">
          <button aria-pressed={view === "nib"} onClick={() => setView("nib")}><Layers size={14} /> Per pelaku usaha (NIB)</button>
          <button aria-pressed={view === "proyek"} onClick={() => setView("proyek")}><List size={14} /> Per proyek</button>
        </div>
        {view === "nib" && pageGroups.length > 0 && <button className="btn ghost sm" onClick={() => setOpenSet(allOpen ? new Set() : new Set(pageGroups.map((g) => g.nib)))}>{allOpen ? "Tutup semua" : "Buka semua"}</button>}
      </div>

      <div className="card">
        {!all.length ? (
          <div className="empty big"><b>Belum ada data</b>{canWrite && <span><Link to="/oss/import">Import Excel</Link> atau <Link to="/oss/input">input manual</Link>.</span>}</div>
        ) : !rows.length ? (
          <div className="empty big">Tidak ada data yang cocok dengan pencarian/filter.</div>
        ) : view === "nib" ? (
          <>
            <div className="tbl-wrap desk-only">
              <table className="data-tbl grp">
                <thead><tr>
                  <th style={{ width: 34 }} />{gth("nama", "Pelaku usaha / NIB")}{gth("n", "Proyek / KBLI")}<th>Lokasi usaha</th>{gth("inv", "Investasi", "num")}{gth("last", "Pengajuan terakhir")}<th>Dokumen</th>
                </tr></thead>
                <tbody>
                  {pageGroups.map((g) => {
                    const isOpen = open.has(g.nib);
                    return [
                      <tr key={g.nib} className={"clk grp-row" + (isOpen ? " open" : "")} tabIndex={0} onClick={() => toggle(g.nib)} onKeyDown={(e) => e.key === "Enter" && toggle(g.nib)} aria-expanded={isOpen}>
                        <td><ChevronDown size={16} className="chev" /></td>
                        <td>
                          <div className="cell-main">{g.first.nama_perusahaan}</div>
                          <div className="cell-sub mono">NIB {g.nib}</div>
                          <button className="link small" onClick={(e) => { e.stopPropagation(); setPelakuOpen(g.nib); }}>Data & dokumen pelaku →</button>
                        </td>
                        <td><b>{fmtInt(g.rows.length)} proyek</b>{(perNib.get(g.nib) || 0) > g.rows.length && <span className="cell-sub"> dari {perNib.get(g.nib)}</span>}
                          <div className="cell-sub mono">{g.kbli.slice(0, 4).join(", ")}{g.kbli.length > 4 ? ` +${g.kbli.length - 4}` : ""}</div></td>
                        <td>{g.kecs.slice(0, 2).join(", ")}{g.kecs.length > 2 ? ` +${g.kecs.length - 2}` : ""}</td>
                        <td className="num">{g.inv ? fmtRpShort(g.inv) : "—"}</td>
                        <td className="nowrap">{fmtDateLong(g.last)}</td>
                        <td><DocBadges pelaku={g.docsPelaku} proyek={g.docsProyek} /></td>
                      </tr>,
                      isOpen && (
                        <tr key={g.nib + "-sub"} className="sub-row"><td />
                          <td colSpan={6}>
                            <table className="sub-tbl"><tbody>
                              {g.rows.map((r) => (
                                <tr key={r.id_proyek} className="clk" tabIndex={0} onClick={() => setOpen(r.id_proyek)} onKeyDown={(e) => e.key === "Enter" && setOpen(r.id_proyek)}>
                                  <td className="nowrap"><span className="mono sm">{r.id_proyek}</span><div className="cell-sub">{r.jenis_proyek}</div></td>
                                  <td><div>{r.nama_proyek || "—"}</div>{(r.kbli || r.judul_kbli) && <div className="cell-sub"><span className="mono">{r.kbli}</span> · {r.judul_kbli}</div>}</td>
                                  <td>{kecLabel(r.kec_usaha)}<div className="cell-sub">{r.kel_usaha}</div></td>
                                  <td><RiskBadge v={r.risiko} /></td>
                                  <td className="num">{r.investasi != null ? fmtInt(r.investasi) : "—"}</td>
                                  <td className="nowrap">{fmtDateLong(r.tgl_pengajuan)}</td>
                                  <td><ArsipBadge r={r} noPelaku /></td>
                                </tr>
                              ))}
                            </tbody></table>
                          </td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            </div>
            <div className="mob-list mob-only">
              {pageGroups.map((g) => (
                <div key={g.nib} className="mob-grp">
                  <button className="mob-item" onClick={() => toggle(g.nib)} aria-expanded={open.has(g.nib)}>
                    <div className="mob-top"><b>{g.first.nama_perusahaan}</b><span className="badge ok">{g.rows.length} proyek</span></div>
                    <div className="cell-sub mono">NIB {g.nib}</div>
                    <div className="mob-meta"><DocBadges pelaku={g.docsPelaku} proyek={g.docsProyek} /><span>{fmtRpShort(g.inv)}</span><ChevronDown size={15} className={"chev" + (open.has(g.nib) ? " up" : "")} /></div>
                  </button>
                  {open.has(g.nib) && (
                    <div className="mob-sub">
                      <button className="link small" onClick={() => setPelakuOpen(g.nib)}>Data & dokumen pelaku →</button>
                      {g.rows.map((r) => (
                        <button key={r.id_proyek} className="mob-subitem" onClick={() => setOpen(r.id_proyek)}>
                          <b>{r.nama_proyek || r.id_proyek}</b>
                          <span className="cell-sub">{r.kbli} · {r.judul_kbli}</span>
                          <span className="cell-sub mono">{r.id_proyek} · {fmtDateLong(r.tgl_pengajuan)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="tbl-wrap desk-only">
              <table className="data-tbl">
                <thead><tr>
                  {th("id_proyek", "No. Permohonan")}{th("nama_perusahaan", "Pelaku usaha")}{th("nama_proyek", "Proyek / KBLI")}{th("kec_usaha", "Lokasi usaha")}
                  {th("skala_usaha", "Skala")}{th("risiko", "Risiko")}{th("investasi", "Investasi (Rp)", "num")}{th("tgl_pengajuan", "Tgl pengajuan")}<th>Arsip</th>
                </tr></thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.id_proyek} className="clk" tabIndex={0} onClick={() => setOpen(r.id_proyek)} onKeyDown={(e) => e.key === "Enter" && setOpen(r.id_proyek)}>
                      <td className="nowrap"><span className="mono sm">{r.id_proyek}</span><div className="cell-sub">{r.jenis_proyek}</div></td>
                      <td><div className="cell-main">{r.nama_perusahaan}</div><div className="cell-sub mono">NIB {r.nib}{(perNib.get(r.nib) || 0) > 1 && <span className="multi"> · {perNib.get(r.nib)} proyek</span>}</div></td>
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
          <span>Halaman {page} dari {pages} · <select className="inp xs" value={size} onChange={(e) => { setSize(+e.target.value); setPage(1); }} aria-label="Baris per halaman">{[20, 50, 100].map((n) => <option key={n}>{n}</option>)}</select> {view === "nib" ? "pelaku usaha" : "baris"} per halaman</span>
          <span className="row-gap">
            <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} />Sebelumnya</button>
            <button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Berikutnya<ChevronRight size={16} /></button>
          </span>
        </div>
      )}
      {isAdmin && all.length > 0 && <div className="danger-zone"><button className="btn sm danger" onClick={wipeAll}><Trash2 size={14} />Kosongkan semua data…</button></div>}

      {openId && <DetailModal id={openId} onClose={() => setOpen(null)} />}
      {pelakuOpen && <PelakuModal nib={pelakuOpen} onClose={() => setPelakuOpen(null)} />}
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
function ArsipBadge({ r, noPelaku }: { r: Proyek; noPelaku?: boolean }) {
  const n = r.oss_dokumen?.length || 0, p = noPelaku ? 0 : r.pelaku_dokumen?.length || 0;
  if (!n && !p && !r.arsip_dokumen) return <span className="cell-sub">—</span>;
  return (
    <span className="row-gap nowrap" style={{ gap: 4 }}>
      {p > 0 && <span className="badge nib" title={`${p} dokumen pelaku usaha (NIB dll.)`}><BadgeCheck size={13} />NIB</span>}
      {n > 0 && <span className="badge ok" title={`${n} dokumen proyek`}><FileText size={13} />{n}</span>}
      {!n && r.arsip_dokumen && <span className="badge" title="Ada tautan/keterangan arsip"><Link2 size={13} /></span>}
    </span>
  );
}
function DocBadges({ pelaku, proyek }: { pelaku: number; proyek: number }) {
  return (
    <span className="row-gap nowrap" style={{ gap: 4 }}>
      <span className={"badge " + (pelaku ? "nib" : "warn")} title="Dokumen pelaku usaha (NIB, akta, NPWP, …)"><BadgeCheck size={13} />{pelaku ? `${pelaku} dok. pelaku` : "NIB belum"}</span>
      {proyek > 0 && <span className="badge ok" title="Dokumen proyek"><FileText size={13} />{proyek}</span>}
    </span>
  );
}
