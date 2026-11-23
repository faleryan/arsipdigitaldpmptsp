import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PlusCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData, usePelaku } from "../context/DataContext";
import { Loading } from "../components/Loading";
import { StatusBanner } from "../components/StatusBanner";
import { MasterList, type Col } from "../components/MasterList";
import { PelakuModal } from "../components/PelakuModal";
import type { Pelaku } from "../lib/columns";
import { fmtInt, fmtRpShort } from "../lib/format";

type Row = Pelaku & { n: number; inv: number; tki: number; docs: number; kbli: string[] };

export default function PelakuPage() {
  const pel = usePelaku();
  const oss = useData();
  const { canWrite } = useAuth();
  const [params, setParams] = useSearchParams();
  const [jenis, setJenis] = useState("all");
  const openNib = params.get("nib");
  const setOpen = (nib: string | null) => { const p = new URLSearchParams(params); if (nib) p.set("nib", nib); else p.delete("nib"); setParams(p, { replace: !nib }); };

  const rows = useMemo<Row[]>(() => {
    const agg = new Map<string, { n: number; inv: number; tki: number; docs: number; kbli: Set<string> }>();
    for (const r of oss.rows) {
      const a = agg.get(r.nib) || { n: 0, inv: 0, tki: 0, docs: 0, kbli: new Set<string>() };
      a.n++; a.inv += r.investasi || 0; a.tki += r.tki || 0; a.docs += r.oss_dokumen?.length || 0; if (r.kbli) a.kbli.add(r.kbli);
      agg.set(r.nib, a);
    }
    return pel.rows.map((p) => { const a = agg.get(p.nib); return { ...p, n: a?.n || 0, inv: a?.inv || 0, tki: a?.tki || 0, docs: a?.docs || 0, kbli: [...(a?.kbli || [])] }; })
      .filter((p) => jenis === "all" || p.jenis_perusahaan === jenis);
  }, [pel.rows, oss.rows, jenis]);
  const jenisList = useMemo(() => [...new Set(pel.rows.map((p) => p.jenis_perusahaan).filter(Boolean))].sort(), [pel.rows]);
  const multi = rows.filter((r) => r.n > 1).length;

  const short = (j: string) => j.replace("Persekutuan Komanditer (CV / Commanditaire Vennootschap)", "CV");
  const cols: Col<Row>[] = [
    { key: "nama", label: "Pelaku usaha", sort: (r) => r.nama_perusahaan, render: (r) => <><div className="cell-main">{r.nama_perusahaan}</div><div className="cell-sub mono">NIB {r.nib}</div></> },
    { key: "jenis", label: "Jenis", sort: (r) => r.jenis_perusahaan, render: (r) => short(r.jenis_perusahaan) || <span className="cell-sub">—</span> },
    { key: "kbli", label: "KBLI", render: (r) => <span className="mono sm">{r.kbli.slice(0, 4).join(", ")}{r.kbli.length > 4 ? ` +${r.kbli.length - 4}` : ""}</span> },
    { key: "n", label: "Proyek", num: true, sort: (r) => r.n, render: (r) => <b>{fmtInt(r.n)}</b> },
    { key: "inv", label: "Investasi", num: true, sort: (r) => r.inv, render: (r) => fmtRpShort(r.inv) },
    { key: "tki", label: "TKI", num: true, sort: (r) => r.tki, render: (r) => fmtInt(r.tki) },
    { key: "docs", label: "Dokumen", num: true, sort: (r) => r.docs, render: (r) => fmtInt(r.docs) },
  ];

  if (!pel.loaded || !oss.loaded) return <Loading />;
  return (
    <>
      <StatusBanner />
      <div className="head">
        <div><h1>Pelaku Usaha</h1><p>{fmtInt(pel.rows.length)} pelaku usaha · {fmtInt(multi)} di antaranya memiliki lebih dari satu proyek</p></div>
        {canWrite && <div className="head-actions"><Link className="btn primary" to="/oss/input"><PlusCircle size={16} />Tambah proyek</Link></div>}
      </div>
      <MasterList rows={rows} cols={cols} keyOf={(r) => r.nib} searchOf={(r) => `${r.nib} ${r.nama_perusahaan} ${r.kbli.join(" ")}`.toLowerCase()}
        onOpen={(r) => setOpen(r.nib)} placeholder="Cari NIB, nama pelaku usaha, atau KBLI…" defaultSort={{ k: "n", dir: -1 }}
        filters={<select className="inp" value={jenis} onChange={(e) => setJenis(e.target.value)} aria-label="Jenis perusahaan"><option value="all">Semua jenis</option>{jenisList.map((j) => <option key={j} value={j}>{short(j)}</option>)}</select>}
        mobileItem={(r) => <><div className="mob-top"><b>{r.nama_perusahaan}</b><span className="badge ok">{r.n} proyek</span></div><div className="cell-sub mono">NIB {r.nib}</div><div className="cell-sub">{short(r.jenis_perusahaan)} · {fmtRpShort(r.inv)}</div></>} />
      {openNib && <PelakuModal nib={openNib} onClose={() => setOpen(null)} />}
    </>
  );
}
