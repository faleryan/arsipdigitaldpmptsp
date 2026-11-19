import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Banknote, Building2, Download, FolderCheck, Users, Briefcase } from "lucide-react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import { Columns, HBar, METRICS, SegBar } from "../components/Charts";
import { NAMA_INSTANSI, RISIKO, RISIKO_COLOR, SKALA, SKALA_COLOR } from "../lib/columns";
import { BULAN, fmtInt, fmtRp, fmtRpShort, hasArsip, isISO, kecLabel, yearOf } from "../lib/format";
import { groupBy, monthSeries, type Metric } from "../lib/stats";
import { Loading } from "../components/Loading";
import { StatusBanner } from "../components/StatusBanner";

export default function Dashboard() {
  const { rows: all, loaded } = useData();
  const { canWrite } = useAuth();
  const { toast } = useUI();
  const [year, setYear] = useState("all");
  const [month, setMonth] = useState("all");
  const [kec, setKec] = useState("all");
  const [metric, setMetric] = useState<Metric>("proyek");

  const years = useMemo(() => [...new Set(all.map(yearOf).filter(Boolean))].sort().reverse(), [all]);
  const kecs = useMemo(() => [...new Set(all.map((r) => kecLabel(r.kec_usaha)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id")), [all]);
  const rows = useMemo(() => all.filter((r) => {
    if (year !== "all" && yearOf(r) !== year) return false;
    if (month !== "all" && (!isISO(r.tgl_pengajuan) || +r.tgl_pengajuan.slice(5, 7) !== +month)) return false;
    if (kec !== "all" && kecLabel(r.kec_usaha) !== kec) return false;
    return true;
  }), [all, year, month, kec]);

  const s = useMemo(() => {
    const inv = rows.reduce((a, r) => a + (r.investasi || 0), 0);
    const tki = rows.reduce((a, r) => a + (r.tki || 0), 0);
    const pelaku = new Set(rows.map((r) => r.nib).filter(Boolean)).size;
    const arsip = rows.filter(hasArsip).length;
    return { inv, tki, pelaku, arsip, pct: rows.length ? (arsip / rows.length) * 100 : 0 };
  }, [rows]);

  const M = METRICS[metric];
  const total = metric === "proyek" ? rows.length : metric === "investasi" ? s.inv : s.tki;
  const period = year === "all" ? "Semua periode" : month === "all" ? `Tahun ${year}` : `${BULAN[+month - 1]} ${year}`;
  const scope = period + (kec === "all" ? " · seluruh kecamatan" : ` · Kec. ${kec}`);

  const byKec = useMemo(() => groupBy(rows, (r) => kecLabel(r.kec_usaha), metric), [rows, metric]);
  const bySektor = useMemo(() => groupBy(rows, (r) => (r.sektor || "").replace(/^Kementerian\s+/i, "Kem. ").replace(/\s+/g, " "), metric), [rows, metric]);
  const byJenis = useMemo(() => groupBy(rows, (r) => (r.jenis_perusahaan || "").replace("Persekutuan Komanditer (CV / Commanditaire Vennootschap)", "CV (Persekutuan Komanditer)"), metric), [rows, metric]);
  const kbli = useMemo(() => groupBy(rows, (r) => r.kbli, metric).sort((a, b) => b.value - a.value).slice(0, 10), [rows, metric]);
  const pelaku = useMemo(() => groupBy(rows, (r) => r.nib, metric).sort((a, b) => b.value - a.value || b.proyek - a.proyek).slice(0, 8), [rows, metric]);
  const recap = useMemo(() => groupBy(rows, (r) => kecLabel(r.kec_usaha)).sort((a, b) => b.proyek - a.proyek), [rows]);
  const kbliMax = Math.max(1, ...kbli.map((k) => k.value));

  const download = async () => {
    try { const x = await import("../lib/excel"); x.exportReport(rows, scope, NAMA_INSTANSI); }
    catch (e) { toast("Gagal membuat laporan: " + (e as Error).message); }
  };

  if (!loaded) return <Loading text="Memuat data arsip…" />;

  return (
    <>
      <StatusBanner />
      <div className="head">
        <div><h1>Dashboard Laporan OSS</h1><p>{scope} · berdasarkan tanggal pengajuan proyek</p></div>
        <div className="head-actions"><button className="btn" onClick={download} disabled={!rows.length}><Download size={16} />Unduh laporan Excel</button></div>
      </div>

      <div className="filters">
        <select className="inp" value={year} onChange={(e) => { setYear(e.target.value); if (e.target.value === "all") setMonth("all"); }} aria-label="Tahun">
          <option value="all">Semua tahun</option>{years.map((y) => <option key={y}>{y}</option>)}
        </select>
        <select className="inp" value={month} onChange={(e) => setMonth(e.target.value)} disabled={year === "all"} aria-label="Bulan">
          <option value="all">Semua bulan</option>{BULAN.map((b, i) => <option key={b} value={i + 1}>{b}</option>)}
        </select>
        <select className="inp" value={kec} onChange={(e) => setKec(e.target.value)} aria-label="Kecamatan">
          <option value="all">Semua kecamatan</option>{kecs.map((k) => <option key={k}>{k}</option>)}
        </select>
        <span className="grow" />
        <div className="seg" role="group" aria-label="Ukuran grafik">
          {(["proyek", "investasi", "tki"] as Metric[]).map((k) => (
            <button key={k} aria-pressed={metric === k} onClick={() => setMetric(k)}>{k === "proyek" ? "Proyek" : k === "investasi" ? "Investasi" : "Tenaga kerja"}</button>
          ))}
        </div>
      </div>

      {!all.length ? (
        <div className="card"><div className="empty big">
          <FolderCheck size={40} />
          <b>Belum ada data arsip</b>
          <span>Mulai dengan mengimpor file Excel hasil unduhan OSS atau tambahkan data secara manual.</span>
          {canWrite && <div className="row-gap"><Link className="btn primary" to="/import">Import Excel</Link><Link className="btn" to="/input">Input manual</Link></div>}
        </div></div>
      ) : (
        <>
          <div className="kpis">
            <div className="card kpi hero">
              <div className="kpi-ico"><Briefcase size={20} /></div>
              <div className="lbl">Total proyek terarsip</div>
              <div className="val">{fmtInt(rows.length)}</div>
              <div className="sub">{period}</div>
            </div>
            <div className="card kpi"><div className="kpi-ico"><Building2 size={18} /></div><div className="lbl">Pelaku usaha (NIB)</div><div className="val">{fmtInt(s.pelaku)}</div><div className="sub">rata-rata {s.pelaku ? (rows.length / s.pelaku).toLocaleString("id-ID", { maximumFractionDigits: 1 }) : 0} proyek/NIB</div></div>
            <div className="card kpi"><div className="kpi-ico"><Banknote size={18} /></div><div className="lbl">Total investasi</div><div className="val" title={fmtRp(s.inv)}>{fmtRpShort(s.inv)}</div><div className="sub">{fmtRp(s.inv)}</div></div>
            <div className="card kpi"><div className="kpi-ico"><Users size={18} /></div><div className="lbl">Tenaga kerja (TKI)</div><div className="val">{fmtInt(s.tki)}</div><div className="sub">orang</div></div>
            <div className="card kpi"><div className="kpi-ico"><FolderCheck size={18} /></div><div className="lbl">Kelengkapan arsip</div><div className="val">{Math.round(s.pct)}%</div>
              <div className="meter" role="meter" aria-valuenow={Math.round(s.pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Kelengkapan arsip"><i style={{ width: `${s.pct}%` }} /></div>
              <div className="sub">{fmtInt(s.arsip)} dari {fmtInt(rows.length)} berdokumen</div></div>
          </div>

          <div className="grid32">
            <div className="card"><div className="card-h"><h3>Tren pengajuan proyek per bulan</h3><span>{M.label}</span></div><div className="card-b"><Columns series={monthSeries(rows, metric)} metric={metric} /></div></div>
            <div className="card"><div className="card-h"><h3>Sebaran per kecamatan usaha</h3><span>{M.label}</span></div><div className="card-b"><HBar items={byKec} metric={metric} total={total} maxRows={12} /></div></div>
          </div>
          <div className="grid2">
            <div className="card"><div className="card-h"><h3>Tingkat risiko proyek</h3><span>{M.label}</span></div><div className="card-b"><SegBar order={RISIKO} colors={RISIKO_COLOR} groups={groupBy(rows, (r) => r.risiko, metric)} metric={metric} /></div></div>
            <div className="card"><div className="card-h"><h3>Skala usaha</h3><span>{M.label}</span></div><div className="card-b"><SegBar order={SKALA} colors={SKALA_COLOR} groups={groupBy(rows, (r) => r.skala_usaha, metric)} metric={metric} /></div></div>
          </div>
          <div className="grid2">
            <div className="card"><div className="card-h"><h3>KL / Sektor pembina</h3><span>{M.label}</span></div><div className="card-b"><HBar items={bySektor} metric={metric} total={total} maxRows={8} /></div></div>
            <div className="card"><div className="card-h"><h3>Jenis perusahaan</h3><span>{M.label}</span></div><div className="card-b"><HBar items={byJenis} metric={metric} total={total} maxRows={8} /></div></div>
          </div>
          <div className="grid2">
            <div className="card"><div className="card-h"><h3>10 KBLI teratas</h3><span>{M.label}</span></div>
              <div className="card-b tbl-wrap"><table><thead><tr><th>KBLI</th><th>Judul</th><th className="num">{M.col}</th></tr></thead><tbody>
                {kbli.map((k) => (
                  <tr key={k.key}><td className="mono">{k.key}</td><td>{k.sample.judul_kbli}<div className="inlinebar" style={{ width: `${(k.value / kbliMax) * 100}%` }} /></td><td className="num">{M.short(k.value)}</td></tr>
                ))}
              </tbody></table></div></div>
            <div className="card"><div className="card-h"><h3>Pelaku usaha teratas</h3><span>{M.label}</span></div>
              <div className="card-b tbl-wrap"><table><thead><tr><th>Pelaku usaha</th><th className="num">Proyek</th><th className="num">{metric === "proyek" ? "Investasi" : M.col}</th></tr></thead><tbody>
                {pelaku.map((p) => (
                  <tr key={p.key}><td><div className="cell-main">{p.sample.nama_perusahaan}</div><div className="cell-sub mono">NIB {p.key}</div></td><td className="num">{fmtInt(p.proyek)}</td><td className="num">{metric === "proyek" ? fmtRpShort(p.investasi) : M.short(p.value)}</td></tr>
                ))}
              </tbody></table></div></div>
          </div>
          <div className="card"><div className="card-h"><h3>Rekapitulasi per kecamatan</h3><span>{scope}</span></div>
            <div className="card-b tbl-wrap"><table>
              <thead><tr><th>Kecamatan</th><th className="num">Proyek</th><th className="num">Pelaku usaha</th><th className="num">Investasi (Rp)</th><th className="num">Tenaga kerja</th><th className="num">Berdokumen</th></tr></thead>
              <tbody>{recap.map((g) => <tr key={g.key}><td>{g.key}</td><td className="num">{fmtInt(g.proyek)}</td><td className="num">{fmtInt(g.pelaku)}</td><td className="num">{fmtInt(g.investasi)}</td><td className="num">{fmtInt(g.tki)}</td><td className="num">{fmtInt(g.arsip)}</td></tr>)}</tbody>
              <tfoot><tr><td>Total</td><td className="num">{fmtInt(rows.length)}</td><td className="num">{fmtInt(s.pelaku)}</td><td className="num">{fmtInt(s.inv)}</td><td className="num">{fmtInt(s.tki)}</td><td className="num">{fmtInt(s.arsip)}</td></tr></tfoot>
            </table></div></div>
        </>
      )}
    </>
  );
}
