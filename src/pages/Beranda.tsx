import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, FileBadge, PlusCircle, Table2, Upload } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData, useSicantik } from "../context/DataContext";
import { Columns } from "../components/Charts";
import { Loading } from "../components/Loading";
import { NAMA_INSTANSI } from "../lib/columns";
import { fmtInt, fmtRpShort, hasArsip } from "../lib/format";
import { izinShort, isTerbit } from "../lib/sicantik";
import { monthSeries } from "../lib/stats";
import { izinMonthSeries } from "./sicantik/Dashboard";

export default function Beranda() {
  const { profile, canWrite } = useAuth();
  const oss = useData();
  const sic = useSicantik();

  const o = useMemo(() => ({
    inv: oss.rows.reduce((a, r) => a + (r.investasi || 0), 0),
    arsip: oss.rows.filter(hasArsip).length,
    pelaku: new Set(oss.rows.map((r) => r.nib).filter(Boolean)).size,
  }), [oss.rows]);
  const s = useMemo(() => ({
    terbit: sic.rows.filter(isTerbit).length,
    arsip: sic.rows.filter((r) => (r.sicantik_dokumen?.length || 0) > 0 || !!r.keterangan).length,
  }), [sic.rows]);

  const recent = useMemo(() => {
    const a = oss.rows.map((r) => ({ t: r.updated_at || "", src: "OSS", title: r.nama_proyek || r.nama_perusahaan, sub: r.nama_perusahaan, to: `/oss/data?id=${encodeURIComponent(r.id_proyek)}` }));
    const b = sic.rows.map((r) => ({ t: r.updated_at || "", src: "SiCantik", title: r.pemohon, sub: izinShort(r.izin), to: `/sicantik/data?id=${encodeURIComponent(r.id_sicantik)}` }));
    return [...a, ...b].filter((x) => x.t).sort((x, y) => y.t.localeCompare(x.t)).slice(0, 8);
  }, [oss.rows, sic.rows]);

  if (!oss.loaded || !sic.loaded) return <Loading text="Memuat arsip…" />;
  const hour = new Date().getHours();
  const salam = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 19 ? "Selamat sore" : "Selamat malam";
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

  return (
    <>
      <div className="welcome">
        <div>
          <h1>{salam}{profile?.nama ? `, ${profile.nama}` : ""}</h1>
          <p>Arsip digital perizinan {NAMA_INSTANSI} — data OSS RBA dan SiCantik dalam satu tempat.</p>
        </div>
        <div className="welcome-stats">
          <div><b>{fmtInt(oss.rows.length + sic.rows.length)}</b><span>total data terarsip</span></div>
          <div><b>{fmtInt(o.arsip + s.arsip)}</b><span>berdokumen</span></div>
        </div>
      </div>

      <div className="grid2 modules">
        <ModuleCard
          tone="blue" icon={<Building2 size={22} />} title="OSS RBA" desc="Proyek & perizinan berusaha berbasis risiko" base="/oss" canWrite={canWrite}
          stats={[["Proyek", fmtInt(oss.rows.length)], ["Pelaku usaha", fmtInt(o.pelaku)], ["Investasi", fmtRpShort(o.inv)], ["Berdokumen", pct(o.arsip, oss.rows.length) + "%"]]}
          chart={oss.rows.length ? <Columns series={monthSeries(oss.rows, "proyek")} metric="proyek" /> : null}
          empty="Belum ada data OSS."
        />
        <ModuleCard
          tone="teal" icon={<FileBadge size={22} />} title="SiCantik" desc="Permohonan izin non-berusaha (praktik nakes, KKPR, PAUD, dll.)" base="/sicantik" canWrite={canWrite}
          stats={[["Permohonan", fmtInt(sic.rows.length)], ["Ditetapkan", fmtInt(s.terbit)], ["Belum ditetapkan", fmtInt(sic.rows.length - s.terbit)], ["Berdokumen", pct(s.arsip, sic.rows.length) + "%"]]}
          chart={sic.rows.length ? <Columns series={izinMonthSeries(sic.rows)} metric="izin" /> : null}
          empty="Belum ada data SiCantik."
        />
      </div>

      {recent.length > 0 && (
        <div className="card"><div className="card-h"><h3>Terakhir diperbarui</h3><span>OSS & SiCantik</span></div>
          <div className="card-b"><div className="recent">
            {recent.map((r, i) => (
              <Link key={i} to={r.to} className="recent-item">
                <span className={"src " + (r.src === "OSS" ? "blue" : "teal")}>{r.src}</span>
                <span className="recent-t"><b>{r.title}</b><small>{r.sub}</small></span>
                <span className="cell-sub nowrap">{new Date(r.t).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span>
              </Link>
            ))}
          </div></div>
        </div>
      )}
    </>
  );
}

function ModuleCard({ tone, icon, title, desc, base, stats, chart, empty, canWrite }: {
  tone: "blue" | "teal"; icon: React.ReactNode; title: string; desc: string; base: string; stats: [string, string][]; chart: React.ReactNode; empty: string; canWrite: boolean;
}) {
  return (
    <div className="card module">
      <div className={"module-h " + tone}>
        <span className="module-ico">{icon}</span>
        <div><h2>{title}</h2><p>{desc}</p></div>
        <Link to={base} className="module-go" aria-label={`Buka dashboard ${title}`}><ArrowRight size={18} /></Link>
      </div>
      <div className="module-stats">{stats.map(([l, v]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}</div>
      <div className="module-chart">{chart || <div className="empty">{empty}</div>}</div>
      <div className="module-links">
        <Link className="btn sm" to={`${base}/data`}><Table2 size={15} />Data</Link>
        {canWrite && <Link className="btn sm" to={`${base}/input`}><PlusCircle size={15} />Input</Link>}
        {canWrite && <Link className="btn sm" to={`${base}/import`}><Upload size={15} />Import</Link>}
      </div>
    </div>
  );
}
