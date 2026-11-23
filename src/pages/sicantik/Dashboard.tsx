import { useMemo, useState } from "react";
import { katIzin } from "../../lib/master";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, Download, FileBadge, FolderCheck, Hourglass, Users } from "lucide-react";
import { useSicantik } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { useUI } from "../../context/UIContext";
import { Columns, HBar, SegBar } from "../../components/Charts";
import { Loading } from "../../components/Loading";
import { StatusBanner } from "../../components/StatusBanner";
import { NAMA_INSTANSI } from "../../lib/columns";
import { BULAN, BULAN_S, fmtInt, isISO, pad2 } from "../../lib/format";
import {
  avgLama, groupIzin, lamaProses, izinShort, JENIS_COLOR, JENIS_PERMOHONAN, lokasiKey, STATUS, STATUS_COLOR, statusOf, type Izin,
} from "../../lib/sicantik";
import type { MonthPoint } from "../../lib/stats";

const yearOfIzin = (r: Izin) => (isISO(r.tanggal) ? r.tanggal.slice(0, 4) : "");
const fmtHari = (n: number | null) => (n == null ? "—" : n.toLocaleString("id-ID", { maximumFractionDigits: 1 }));

export function izinMonthSeries(rows: Izin[]): MonthPoint[] {
  const agg = new Map<string, number>();
  rows.forEach((r) => { if (isISO(r.tanggal)) { const k = r.tanggal.slice(0, 7); agg.set(k, (agg.get(k) || 0) + 1); } });
  const keys = [...agg.keys()].sort();
  if (!keys.length) return [];
  let [y, m] = keys[0].split("-").map(Number);
  const [y1, m1] = keys[keys.length - 1].split("-").map(Number);
  const out: MonthPoint[] = [];
  for (let g = 0; (y < y1 || (y === y1 && m <= m1)) && g < 240; g++) {
    const k = `${y}-${pad2(m)}`;
    out.push({ key: k, value: agg.get(k) || 0, label: `${BULAN[m - 1]} ${y}`, short: BULAN_S[m - 1], year: y, month: m - 1 });
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

export default function SicantikDashboard() {
  const { rows: all, loaded } = useSicantik();
  const { canWrite } = useAuth();
  const { toast } = useUI();
  const [year, setYear] = useState("all");
  const [month, setMonth] = useState("all");
  const [kat, setKat] = useState("all");

  const years = useMemo(() => [...new Set(all.map(yearOfIzin).filter(Boolean))].sort().reverse(), [all]);
  const kats = useMemo(() => [...new Set(all.map((r) => katIzin(r)))].sort(), [all]);
  const rows = useMemo(() => all.filter((r) => {
    if (year !== "all" && yearOfIzin(r) !== year) return false;
    if (month !== "all" && (!isISO(r.tanggal) || +r.tanggal.slice(5, 7) !== +month)) return false;
    if (kat !== "all" && katIzin(r) !== kat) return false;
    return true;
  }), [all, year, month, kat]);

  const sla = useMemo(() => {
    let n = 0, ok = 0;
    for (const r of rows) { const l = lamaProses(r); if (l != null && r.lama_layanan != null) { n++; if (l <= r.lama_layanan) ok++; } }
    return { n, ok };
  }, [rows]);
  const tot = useMemo(() => groupIzin(rows, () => "all")[0], [rows]);
  const pemohon = useMemo(() => new Set(rows.map((r) => r.pemohon_id)).size, [rows]);
  const arsip = rows.filter((r) => (r.sicantik_dokumen?.length || 0) > 0 || !!r.keterangan).length;
  const period = year === "all" ? "Semua periode" : month === "all" ? `Tahun ${year}` : `${BULAN[+month - 1]} ${year}`;
  const scope = period + (kat === "all" ? " · semua kategori izin" : ` · ${kat}`);

  const byIzin = useMemo(() => groupIzin(rows, (r) => r.izin, (r) => izinShort(r.izin)), [rows]);
  const byKat = useMemo(() => groupIzin(rows, (r) => katIzin(r)), [rows]);
  const byLok = useMemo(() => groupIzin(rows.filter((r) => r.lokasi), (r) => lokasiKey(r.lokasi), (r) => r.lokasi.trim()).sort((a, b) => b.total - a.total).slice(0, 10), [rows]);
  const lama = useMemo(() => byIzin.filter((g) => g.lamaN >= 3).map((g) => ({ key: g.key, label: g.label, value: avgLama(g) || 0 })), [byIzin]);
  const pending = useMemo(() => rows.filter((r) => statusOf(r) === STATUS[1]).sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal))).slice(0, 8), [rows]);
  const lokMax = Math.max(1, ...byLok.map((l) => l.total));
  const today = Date.now();

  const download = async () => {
    try { (await import("../../lib/excel")).exportIzinReport(rows, scope, NAMA_INSTANSI); }
    catch (e) { toast("Gagal membuat laporan: " + (e as Error).message); }
  };
  if (!loaded) return <Loading text="Memuat data SiCantik…" />;

  return (
    <>
      <StatusBanner kind="sicantik" />
      <div className="head">
        <div><h1>Dashboard SiCantik</h1><p>{scope} · berdasarkan tanggal permohonan</p></div>
        <div className="head-actions"><button className="btn" onClick={download} disabled={!rows.length}><Download size={16} />Unduh laporan Excel</button></div>
      </div>
      <div className="filters">
        <select className="inp" value={year} onChange={(e) => { setYear(e.target.value); if (e.target.value === "all") setMonth("all"); }} aria-label="Tahun">
          <option value="all">Semua tahun</option>{years.map((y) => <option key={y}>{y}</option>)}
        </select>
        <select className="inp" value={month} onChange={(e) => setMonth(e.target.value)} disabled={year === "all"} aria-label="Bulan">
          <option value="all">Semua bulan</option>{BULAN.map((b, i) => <option key={b} value={i + 1}>{b}</option>)}
        </select>
        <select className="inp" value={kat} onChange={(e) => setKat(e.target.value)} aria-label="Kategori izin">
          <option value="all">Semua kategori izin</option>{kats.map((k) => <option key={k}>{k}</option>)}
        </select>
      </div>

      {!all.length ? (
        <div className="card"><div className="empty big">
          <FileBadge size={40} />
          <b>Belum ada data SiCantik</b>
          <span>Impor file rekap dari aplikasi SiCantik atau tambahkan permohonan secara manual.</span>
          {canWrite && <div className="row-gap"><Link className="btn primary" to="/sicantik/import">Import Excel</Link><Link className="btn" to="/sicantik/input">Input manual</Link></div>}
        </div></div>
      ) : (
        <>
          <div className="kpis">
            <div className="card kpi hero teal">
              <div className="kpi-ico"><FileBadge size={20} /></div>
              <div className="lbl">Total permohonan izin</div>
              <div className="val">{fmtInt(rows.length)}</div>
              <div className="sub">{period}</div>
            </div>
            <div className="card kpi"><div className="kpi-ico"><CheckCircle2 size={18} /></div><div className="lbl">Sudah ditetapkan</div><div className="val">{fmtInt(tot?.terbit)}</div><div className="sub">{rows.length ? Math.round(((tot?.terbit || 0) / rows.length) * 100) : 0}% dari permohonan</div></div>
            <div className="card kpi"><div className="kpi-ico"><Hourglass size={18} /></div><div className="lbl">Belum ditetapkan</div><div className="val">{fmtInt(rows.length - (tot?.terbit || 0))}</div><div className="sub">nomor izin masih kosong</div></div>
            <div className="card kpi"><div className="kpi-ico"><Clock size={18} /></div><div className="lbl">Rata-rata lama proses</div><div className="val">{fmtHari(tot ? avgLama(tot) : null)} <small className="unit">hari</small></div><div className="sub">{sla.n ? `${Math.round((sla.ok / sla.n) * 100)}% tepat waktu sesuai standar` : "permohonan → penetapan"}</div></div>
            <div className="card kpi"><div className="kpi-ico"><Users size={18} /></div><div className="lbl">Pemohon unik</div><div className="val">{fmtInt(pemohon)}</div>
              <div className="sub"><FolderCheck size={12} style={{ verticalAlign: -2 }} /> {fmtInt(arsip)} permohonan berdokumen</div></div>
          </div>

          <div className="grid32">
            <div className="card"><div className="card-h"><h3>Tren permohonan per bulan</h3><span>Jumlah permohonan</span></div><div className="card-b"><Columns series={izinMonthSeries(rows)} metric="izin" /></div></div>
            <div className="card"><div className="card-h"><h3>Kategori izin</h3><span>Jumlah permohonan</span></div><div className="card-b"><HBar items={byKat} metric="izin" total={rows.length} maxRows={8} /></div></div>
          </div>
          <div className="grid2">
            <div className="card"><div className="card-h"><h3>Jenis permohonan</h3><span>Jumlah permohonan</span></div><div className="card-b"><SegBar order={JENIS_PERMOHONAN} colors={JENIS_COLOR} groups={groupIzin(rows, (r) => r.jenis)} metric="izin" /></div></div>
            <div className="card"><div className="card-h"><h3>Status penetapan</h3><span>Jumlah permohonan</span></div><div className="card-b"><SegBar order={STATUS} colors={STATUS_COLOR} groups={groupIzin(rows, statusOf)} metric="izin" /></div></div>
          </div>
          <div className="grid2">
            <div className="card"><div className="card-h"><h3>Jenis izin terbanyak</h3><span>Jumlah permohonan</span></div><div className="card-b"><HBar items={byIzin} metric="izin" total={rows.length} maxRows={12} /></div></div>
            <div className="card"><div className="card-h"><h3>Rata-rata lama proses per jenis izin</h3><span>Hari · 12 terlama, min. 3 izin ditetapkan</span></div><div className="card-b"><HBar items={lama} metric="hari" total={0} maxRows={12} showPct={false} other={false} /></div></div>
          </div>
          <div className="grid2">
            <div className="card"><div className="card-h"><h3>Lokasi / fasilitas teratas</h3><span>Jumlah permohonan</span></div>
              <div className="card-b tbl-wrap"><table><thead><tr><th>Lokasi</th><th className="num">Permohonan</th><th className="num">Ditetapkan</th></tr></thead><tbody>
                {byLok.map((l) => <tr key={l.key}><td>{l.label}<div className="inlinebar" style={{ width: `${(l.total / lokMax) * 100}%` }} /></td><td className="num">{fmtInt(l.total)}</td><td className="num">{fmtInt(l.terbit)}</td></tr>)}
              </tbody></table></div></div>
            <div className="card"><div className="card-h"><h3>Belum ditetapkan (terlama)</h3><span>{fmtInt(rows.length - (tot?.terbit || 0))} permohonan</span></div>
              <div className="card-b tbl-wrap">{pending.length ? <table><thead><tr><th>Pemohon / izin</th><th className="num">Menunggu</th></tr></thead><tbody>
                {pending.map((r) => (
                  <tr key={r.id_sicantik}><td><Link to={`/sicantik/data?id=${encodeURIComponent(r.id_sicantik)}`} className="cell-main plain">{r.pemohon}</Link><div className="cell-sub">{izinShort(r.izin)} · {r.jenis}</div></td>
                    <td className="num nowrap">{isISO(r.tanggal) ? `${fmtInt(Math.round((today - Date.parse(r.tanggal)) / 864e5))} hari` : "—"}</td></tr>
                ))}
              </tbody></table> : <div className="empty">Semua permohonan sudah ditetapkan 🎉</div>}</div></div>
          </div>
          <div className="card"><div className="card-h"><h3>Rekapitulasi per jenis izin</h3><span>{scope}</span></div>
            <div className="card-b tbl-wrap"><table>
              <thead><tr><th>Jenis izin</th><th className="num">Jumlah</th><th className="num">Baru</th><th className="num">Perpanjangan</th><th className="num">Perubahan</th><th className="num">Pencabutan</th><th className="num">Ditetapkan</th><th className="num">Rata-rata proses (hari)</th></tr></thead>
              <tbody>{[...byIzin].sort((a, b) => b.total - a.total).map((g) => (
                <tr key={g.key}><td title={g.key}>{g.label}</td><td className="num">{fmtInt(g.total)}</td><td className="num">{fmtInt(g.baru)}</td><td className="num">{fmtInt(g.perpanjangan)}</td><td className="num">{fmtInt(g.perubahan)}</td><td className="num">{fmtInt(g.pencabutan)}</td><td className="num">{fmtInt(g.terbit)}</td><td className="num">{fmtHari(avgLama(g))}</td></tr>
              ))}</tbody>
              {tot && <tfoot><tr><td>Total</td><td className="num">{fmtInt(tot.total)}</td><td className="num">{fmtInt(tot.baru)}</td><td className="num">{fmtInt(tot.perpanjangan)}</td><td className="num">{fmtInt(tot.perubahan)}</td><td className="num">{fmtInt(tot.pencabutan)}</td><td className="num">{fmtInt(tot.terbit)}</td><td className="num">{fmtHari(avgLama(tot))}</td></tr></tfoot>}
            </table></div></div>
        </>
      )}
    </>
  );
}
