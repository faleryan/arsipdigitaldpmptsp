import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PlusCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useJenisIzin, useSicantik } from "../../context/DataContext";
import { Loading } from "../../components/Loading";
import { MasterList, type Col } from "../../components/MasterList";
import { JenisIzinModal } from "../../components/JenisIzinModal";
import { fmtInt } from "../../lib/format";
import { izinShort, lamaProses, isTerbit } from "../../lib/sicantik";
import { persyaratanList, type JenisIzin } from "../../lib/master";

type Row = JenisIzin & { n: number; terbit: number; avg: number | null; tepat: number | null; nSyarat: number };
const fmtHari = (n: number | null) => (n == null ? "—" : n.toLocaleString("id-ID", { maximumFractionDigits: 1 }));

export default function JenisIzinPage() {
  const jenis = useJenisIzin();
  const sic = useSicantik();
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const [kat, setKat] = useState("all");
  const [newOpen, setNewOpen] = useState(false);
  const openNama = params.get("nama");
  const setOpen = (n: string | null) => { const p = new URLSearchParams(params); if (n) p.set("nama", n); else p.delete("nama"); setParams(p, { replace: !n }); };

  const rows = useMemo<Row[]>(() => {
    const agg = new Map<string, { n: number; terbit: number; sum: number; cnt: number; ok: number }>();
    for (const r of sic.rows) {
      const a = agg.get(r.izin) || { n: 0, terbit: 0, sum: 0, cnt: 0, ok: 0 };
      a.n++; if (isTerbit(r)) a.terbit++;
      const l = lamaProses(r);
      if (l != null) { a.sum += l; a.cnt++; if (r.lama_layanan != null && l <= r.lama_layanan) a.ok++; }
      agg.set(r.izin, a);
    }
    return jenis.rows.filter((j) => kat === "all" || j.kategori === kat).map((j) => {
      const a = agg.get(j.nama);
      return { ...j, n: a?.n || 0, terbit: a?.terbit || 0, avg: a?.cnt ? a.sum / a.cnt : null, tepat: j.lama_layanan != null && a?.cnt ? (a.ok / a.cnt) * 100 : null, nSyarat: persyaratanList(j).length };
    });
  }, [jenis.rows, sic.rows, kat]);
  const kats = useMemo(() => [...new Set(jenis.rows.map((j) => j.kategori).filter(Boolean))].sort(), [jenis.rows]);
  const nSla = jenis.rows.filter((j) => j.lama_layanan != null).length;
  const nSyarat = jenis.rows.filter((j) => j.persyaratan.trim()).length;

  const cols: Col<Row>[] = [
    { key: "nama", label: "Jenis izin", sort: (r) => izinShort(r.nama), render: (r) => <><div className="cell-main">{izinShort(r.nama)}{!r.aktif && <span className="badge warn" style={{ marginLeft: 6 }}>Nonaktif</span>}</div><div className="cell-sub">{r.nama}</div></> },
    { key: "kat", label: "Kategori", sort: (r) => r.kategori, render: (r) => r.kategori || <span className="cell-sub">—</span> },
    { key: "syarat", label: "Persyaratan", num: true, sort: (r) => r.nSyarat, render: (r) => (r.nSyarat ? `${r.nSyarat} dok.` : <span className="cell-sub">—</span>) },
    { key: "sla", label: "Standar (hari)", num: true, sort: (r) => r.lama_layanan ?? -1, render: (r) => r.lama_layanan ?? <span className="cell-sub">—</span> },
    { key: "n", label: "Permohonan", num: true, sort: (r) => r.n, render: (r) => <b>{fmtInt(r.n)}</b> },
    { key: "avg", label: "Rata-rata proses", num: true, sort: (r) => r.avg ?? -1, render: (r) => (r.avg != null ? `${fmtHari(r.avg)} hr` : <span className="cell-sub">—</span>) },
    { key: "tepat", label: "Tepat waktu", num: true, sort: (r) => r.tepat ?? -1, render: (r) => (r.tepat != null ? <span className={"badge " + (r.tepat >= 80 ? "ok" : "warn")}>{Math.round(r.tepat)}%</span> : <span className="cell-sub">—</span>) },
  ];

  if (!jenis.loaded || !sic.loaded) return <Loading />;
  return (
    <>
      <div className="head">
        <div><h1>Master Jenis Izin</h1><p>{fmtInt(jenis.rows.length)} jenis izin SiCantik · {fmtInt(nSyarat)} sudah berisi persyaratan · {fmtInt(nSla)} punya standar waktu layanan</p></div>
        {isAdmin && <div className="head-actions"><button className="btn primary" onClick={() => setNewOpen(true)}><PlusCircle size={16} />Tambah jenis izin</button></div>}
      </div>
      {jenis.rows.length > 0 && nSla === 0 && isAdmin && (
        <div className="banner"><span>💡</span><div>Isi <b>standar waktu layanan</b> dan <b>persyaratan dokumen</b> tiap jenis izin. Aplikasi akan menghitung ketepatan waktu penetapan dan menampilkan daftar periksa dokumen di setiap permohonan.</div></div>
      )}
      <MasterList rows={rows} cols={cols} keyOf={(r) => r.nama} searchOf={(r) => `${r.nama} ${r.singkatan} ${r.kategori}`.toLowerCase()}
        onOpen={(r) => setOpen(r.nama)} placeholder="Cari nama, singkatan, atau kategori izin…" defaultSort={{ k: "n", dir: -1 }}
        filters={<select className="inp" value={kat} onChange={(e) => setKat(e.target.value)} aria-label="Kategori"><option value="all">Semua kategori</option>{kats.map((k) => <option key={k}>{k}</option>)}</select>}
        mobileItem={(r) => <><div className="mob-top"><b>{izinShort(r.nama)}</b><span className="badge ok">{r.n}</span></div><div className="cell-sub">{r.kategori}</div><div className="cell-sub">Rata-rata {fmtHari(r.avg)} hari{r.lama_layanan != null ? ` · standar ${r.lama_layanan} hari` : ""}</div></>} />
      {openNama && <JenisIzinModal key={openNama} nama={openNama} onClose={() => setOpen(null)} />}
      {newOpen && <JenisIzinModal nama={null} onClose={() => setNewOpen(false)} />}
    </>
  );
}
