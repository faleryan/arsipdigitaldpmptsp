import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, BookOpen, ChevronLeft, ChevronRight, Loader2, PlusCircle, Search, Upload } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useData, useKbli } from "../../context/DataContext";
import { Loading } from "../../components/Loading";
import { KbliModal } from "../../components/KbliModal";
import { KbliImport } from "../../components/KbliImport";
import { fmtInt } from "../../lib/format";
import { kbliKey, TINGKAT, titleCase, type Kbli } from "../../lib/master";
import * as api from "../../lib/api";

const treeKey = (k: Kbli) => k.kategori + (k.tingkat === "Kategori" ? "" : k.kode);

export default function KbliPage() {
  const { rows, loaded, index, error } = useKbli();
  const oss = useData();
  const { isAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [versi, setVersi] = useState("");
  const [tingkat, setTingkat] = useState("all");
  const [kat, setKat] = useState("all");
  const [mode, setMode] = useState<"master" | "dipakai" | "luar">("master");
  const [deep, setDeep] = useState(false);
  const [deepHits, setDeepHits] = useState<Set<string> | null>(null);
  const [deepBusy, setDeepBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Kbli | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const size = 50;
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const kode = params.get("kode");
    if (kode && loaded) { const k = index.get(kode); if (k) setOpen(k); const p = new URLSearchParams(params); p.delete("kode"); setParams(p, { replace: true }); }
  }, [params, loaded, index, setParams]);

  useEffect(() => { if (!versi && index.versi.length) setVersi(index.versi[0]); }, [index.versi, versi]);

  // pemakaian KBLI di arsip OSS
  const usage = useMemo(() => {
    const m = new Map<string, { n: number; judul: string }>();
    for (const r of oss.rows) if (r.kbli) { const u = m.get(r.kbli) || { n: 0, judul: r.judul_kbli }; u.n++; m.set(r.kbli, u); }
    return m;
  }, [oss.rows]);
  const luar = useMemo(() => [...usage.entries()].filter(([k]) => !index.get(k)).map(([kode, u]) => ({ kode, ...u })).sort((a, b) => b.n - a.n), [usage, index]);
  const nLuarProyek = luar.reduce((s, x) => s + x.n, 0);
  const nDipakai = [...usage.keys()].filter((k) => index.get(k)).length;

  // pencarian di uraian (server)
  useEffect(() => {
    if (!deep || q.trim().length < 3) { setDeepHits(null); return; }
    let alive = true;
    setDeepBusy(true);
    const t = setTimeout(() => {
      api.searchKbliUraian(q.trim()).then((hits) => { if (alive) setDeepHits(new Set(hits.map(kbliKey))); }).catch(() => alive && setDeepHits(new Set())).finally(() => alive && setDeepBusy(false));
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [deep, q]);

  const list = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const out = rows.filter((r) => {
      if (versi && r.versi !== versi) return false;
      if (mode === "dipakai" && !usage.has(r.kode)) return false;
      if (tingkat !== "all" && r.tingkat !== tingkat) return false;
      if (kat !== "all" && r.kategori !== kat) return false;
      if (terms.length) {
        const hay = (r.kode + " " + r.judul).toLowerCase();
        if (!terms.every((t) => hay.includes(t)) && !(deepHits && deepHits.has(kbliKey(r)))) return false;
      }
      return true;
    });
    return out.sort((a, b) => treeKey(a).localeCompare(treeKey(b)));
  }, [rows, versi, tingkat, kat, q, mode, usage, deepHits]);
  const pages = Math.max(1, Math.ceil(list.length / size));
  useEffect(() => { setPage(1); }, [q, versi, tingkat, kat, mode, deepHits]);
  const pageRows = list.slice((page - 1) * size, page * size);
  const perTingkat = useMemo(() => { const m: Record<string, number> = {}; rows.filter((r) => r.versi === versi).forEach((r) => (m[r.tingkat] = (m[r.tingkat] || 0) + 1)); return m; }, [rows, versi]);
  const kategoriList = useMemo(() => rows.filter((r) => r.tingkat === "Kategori" && r.versi === versi), [rows, versi]);

  if (!loaded) return <Loading text="Memuat Master KBLI…" />;
  return (
    <>
      {error && <div className="banner warn"><AlertTriangle size={18} /><div>{error}</div></div>}
      <div className="head">
        <div><h1>Master KBLI</h1><p>Klasifikasi Baku Lapangan Usaha Indonesia{versi ? ` · versi ${versi}` : ""} · rujukan pengisian KBLI proyek OSS</p></div>
        {isAdmin && <div className="head-actions">
          <button className="btn" onClick={() => setImporting(true)}><Upload size={16} />Import Excel</button>
          <button className="btn primary" onClick={() => setOpen("new")}><PlusCircle size={16} />Tambah kode</button>
        </div>}
      </div>

      {!rows.length ? (
        <div className="card"><div className="empty big">
          <BookOpen size={40} />
          <b>Master KBLI masih kosong</b>
          <span>Impor file KBLI (mis. <i>kbli-2025-lengkap.xlsx</i>) dengan kolom kode, tingkat, judul, uraian, kategori.</span>
          {isAdmin ? <button className="btn primary" onClick={() => setImporting(true)}><Upload size={16} />Import file KBLI</button> : <span className="cell-sub">Hubungi admin untuk mengimpor Master KBLI.</span>}
        </div></div>
      ) : (
        <>
          <div className="chips">
            {TINGKAT.filter((t) => perTingkat[t]).map((t) => <div key={t} className="chip-stat"><b>{fmtInt(perTingkat[t])}</b>{t}</div>)}
            <button className={"chip-stat" + (mode === "dipakai" ? " on" : "")} onClick={() => setMode(mode === "dipakai" ? "master" : "dipakai")}><b>{fmtInt(nDipakai)}</b>kode dipakai di arsip OSS</button>
            {luar.length > 0 && <button className={"chip-stat warn" + (mode === "luar" ? " on" : "")} onClick={() => setMode(mode === "luar" ? "master" : "luar")}><b>{fmtInt(luar.length)}</b>kode di arsip tidak ada di master ({fmtInt(nLuarProyek)} proyek)</button>}
          </div>

          {mode === "luar" ? (
            <div className="card">
              <div className="card-h col"><h3>KBLI di arsip OSS yang tidak ada di Master KBLI</h3><span>Biasanya kode KBLI versi lama (2020). Impor juga file KBLI 2020 sebagai versi “2020” bila ingin semua kode dikenali.</span></div>
              <div className="card-b tbl-wrap"><table>
                <thead><tr><th>Kode</th><th>Judul (dari data OSS)</th><th>Kategori</th><th className="num">Proyek</th></tr></thead>
                <tbody>{luar.map((x) => <tr key={x.kode}><td className="tree-kode">{x.kode}</td><td>{x.judul}</td><td>{index.kategoriLabel(index.kategoriOf(x.kode))}</td><td className="num">{fmtInt(x.n)}</td></tr>)}</tbody>
              </table></div>
            </div>
          ) : (
            <>
              <div className="filters">
                <div className="search"><Search size={16} /><input className="inp" type="search" placeholder="Cari kode atau judul KBLI…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari KBLI" /></div>
                <label className="chk small">{deepBusy ? <Loader2 size={14} className="spin-ico" /> : <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} />}Cari juga di uraian</label>
                {index.versi.length > 1 && <select className="inp" value={versi} onChange={(e) => setVersi(e.target.value)} aria-label="Versi">{index.versi.map((v) => <option key={v} value={v}>KBLI {v}</option>)}</select>}
                <select className="inp" value={tingkat} onChange={(e) => setTingkat(e.target.value)} aria-label="Tingkat"><option value="all">Semua tingkat</option>{TINGKAT.map((t) => <option key={t}>{t}</option>)}</select>
                <select className="inp sektor" value={kat} onChange={(e) => setKat(e.target.value)} aria-label="Kategori"><option value="all">Semua kategori</option>{kategoriList.map((k) => <option key={k.kode} value={k.kode}>{k.kode} · {titleCase(k.judul)}</option>)}</select>
                <span className="cell-sub">{fmtInt(list.length)} kode</span>
              </div>
              <div className="card">
                {!list.length ? <div className="empty big">Tidak ada kode KBLI yang cocok.</div> : (
                  <div className="tbl-wrap"><table>
                    <thead><tr><th>Kode</th><th>Judul</th><th>Tingkat</th><th className="num">Proyek di arsip</th></tr></thead>
                    <tbody>{pageRows.map((r) => {
                      const n = r.tingkat === "Kelompok" ? usage.get(r.kode)?.n || 0 : 0;
                      return (
                        <tr key={kbliKey(r)} className={"clk tl-" + r.tingkat.replace(" ", "-")} tabIndex={0} onClick={() => setOpen(r)} onKeyDown={(e) => e.key === "Enter" && setOpen(r)}>
                          <td className="tree-kode">{r.kode}</td>
                          <td>{r.judul}{!r.aktif && <span className="badge warn" style={{ marginLeft: 6 }}>Nonaktif</span>}</td>
                          <td><span className={"badge t-" + r.tingkat.replace(" ", "-")}>{r.tingkat}</span></td>
                          <td className="num">{n ? <b>{fmtInt(n)}</b> : <span className="cell-sub">—</span>}</td>
                        </tr>
                      );
                    })}</tbody>
                  </table></div>
                )}
              </div>
              {list.length > size && (
                <div className="pager"><span>Halaman {page} dari {pages}</span>
                  <span className="row-gap">
                    <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} />Sebelumnya</button>
                    <button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Berikutnya<ChevronRight size={16} /></button>
                  </span>
                </div>
              )}
            </>
          )}
        </>
      )}
      {open && <KbliModal key={open === "new" ? "new" : kbliKey(open)} k0={open === "new" ? undefined : open} isNew={open === "new"} onClose={() => setOpen(null)} onOpen={(k) => setOpen(k)} />}
      {importing && <KbliImport onClose={() => setImporting(false)} />}
    </>
  );
}
