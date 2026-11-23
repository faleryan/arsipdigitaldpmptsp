import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PlusCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePemohon, useSicantik } from "../../context/DataContext";
import { Loading } from "../../components/Loading";
import { StatusBanner } from "../../components/StatusBanner";
import { MasterList, type Col } from "../../components/MasterList";
import { PemohonModal } from "../../components/PemohonModal";
import { fmtDateLong, fmtInt, maskNik } from "../../lib/format";
import { isTerbit, izinShort, type Pemohon } from "../../lib/sicantik";

type Row = Pemohon & { n: number; terbit: number; docs: number; last: string; lastIzin: string };

export default function PemohonPage() {
  const pem = usePemohon();
  const sic = useSicantik();
  const { canWrite } = useAuth();
  const [params, setParams] = useSearchParams();
  const openId = params.get("id");
  const setOpen = (id: string | null) => { const p = new URLSearchParams(params); if (id) p.set("id", id); else p.delete("id"); setParams(p, { replace: !id }); };

  const rows = useMemo<Row[]>(() => {
    const agg = new Map<string, { n: number; terbit: number; docs: number; last: string; lastIzin: string }>();
    for (const r of sic.rows) {
      const a = agg.get(r.pemohon_id) || { n: 0, terbit: 0, docs: 0, last: "", lastIzin: "" };
      a.n++; if (isTerbit(r)) a.terbit++; a.docs += r.sicantik_dokumen?.length || 0;
      if ((r.tanggal || "") > a.last) { a.last = r.tanggal || ""; a.lastIzin = r.izin; }
      agg.set(r.pemohon_id, a);
    }
    return pem.rows.map((p) => ({ ...p, ...(agg.get(p.id_pemohon) || { n: 0, terbit: 0, docs: 0, last: "", lastIzin: "" }) }));
  }, [pem.rows, sic.rows]);
  const multi = rows.filter((r) => r.n > 1).length;

  const cols: Col<Row>[] = [
    { key: "nama", label: "Pemohon", sort: (r) => r.nama, render: (r) => <><div className="cell-main">{r.nama}</div><div className="cell-sub mono">{r.no_ktp ? `KTP ${maskNik(r.no_ktp)}` : "Tanpa KTP"}</div></> },
    { key: "hp", label: "Kontak", render: (r) => <>{r.no_hp || <span className="cell-sub">—</span>}<div className="cell-sub">{r.email}</div></> },
    { key: "izin", label: "Permohonan terakhir", sort: (r) => r.last, render: (r) => r.last ? <>{izinShort(r.lastIzin)}<div className="cell-sub">{fmtDateLong(r.last)}</div></> : <span className="cell-sub">—</span> },
    { key: "n", label: "Permohonan", num: true, sort: (r) => r.n, render: (r) => <b>{fmtInt(r.n)}</b> },
    { key: "terbit", label: "Ditetapkan", num: true, sort: (r) => r.terbit, render: (r) => fmtInt(r.terbit) },
    { key: "docs", label: "Dokumen", num: true, sort: (r) => r.docs, render: (r) => fmtInt(r.docs) },
  ];

  if (!pem.loaded || !sic.loaded) return <Loading />;
  return (
    <>
      <StatusBanner kind="sicantik" />
      <div className="head">
        <div><h1>Pemohon</h1><p>{fmtInt(pem.rows.length)} pemohon · {fmtInt(multi)} di antaranya mengajukan lebih dari satu izin</p></div>
        {canWrite && <div className="head-actions"><Link className="btn primary" to="/sicantik/input"><PlusCircle size={16} />Tambah permohonan</Link></div>}
      </div>
      <MasterList rows={rows} cols={cols} keyOf={(r) => r.id_pemohon} searchOf={(r) => `${r.no_ktp} ${r.nama} ${r.no_hp} ${r.email}`.toLowerCase()}
        onOpen={(r) => setOpen(r.id_pemohon)} placeholder="Cari No. KTP, nama, No. HP, atau email…" defaultSort={{ k: "izin", dir: -1 }}
        mobileItem={(r) => <><div className="mob-top"><b>{r.nama}</b><span className="badge ok">{r.n} izin</span></div><div className="cell-sub mono">{r.no_ktp ? `KTP ${maskNik(r.no_ktp)}` : "Tanpa KTP"}</div>{r.last && <div className="cell-sub">{izinShort(r.lastIzin)} · {fmtDateLong(r.last)}</div>}</>} />
      {openId && <PemohonModal id={openId} onClose={() => setOpen(null)} />}
    </>
  );
}
