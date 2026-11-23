import { useState } from "react";
import { katIzin } from "../lib/master";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2, X } from "lucide-react";
import { Modal } from "./Modal";
import { DocsPanel } from "./DocsPanel";
import { useAuth } from "../context/AuthContext";
import { useJenisIzin, useSicantik } from "../context/DataContext";
import { persyaratanList, syaratTerpenuhi } from "../lib/master";
import { CheckCircle2, Circle } from "lucide-react";
import { useUI } from "../context/UIContext";
import { fmtDateLong, maskNik } from "../lib/format";
import { lamaProses, SIC_PRETTY, statusOf, type SicKey } from "../lib/sicantik";
import * as api from "../lib/api";

const SECTIONS: [string, SicKey[]][] = [
  ["Data izin", ["izin", "jenis", "nomor_izin", "tanggal", "tgl_penetapan", "no_permohonan", "id_sicantik"]],
  ["Pemohon", ["pemohon", "no_ktp", "no_hp", "email"]],
  ["Lokasi", ["lokasi", "lokasi_izin"]],
];

export function IzinDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { byId, rows, refresh } = useSicantik();
  const jenis = useJenisIzin();
  const { canWrite } = useAuth();
  const { toast, confirm } = useUI();
  const nav = useNavigate();
  const [ktpOpen, setKtpOpen] = useState(false);
  const r = byId.get(id);
  if (!r) return null;
  const docs = r.sicantik_dokumen || [];
  const nSama = rows.filter((x) => x.pemohon_id === r.pemohon_id).length;
  const status = statusOf(r);
  const lama = lamaProses(r);
  const j = jenis.byId.get(r.izin);
  const sla = j?.lama_layanan ?? null;
  const syarat = persyaratanList(j);
  const docLabels = docs.flatMap((d) => [d.label, d.nama_file]).filter(Boolean);

  const remove = async () => {
    if (!(await confirm({ title: "Hapus data permohonan?", body: <>Permohonan <b>{r.pemohon}</b> ({r.izin}) beserta {docs.length} dokumennya akan dihapus. Tindakan ini tidak dapat dibatalkan.</>, ok: "Hapus", danger: true }))) return;
    try { await api.deleteIzin(r.id_sicantik, docs); toast("Data dihapus"); onClose(); await refresh(); } catch (e) { toast(api.errMsg(e)); }
  };

  return (
    <Modal onClose={onClose} size="lg" label="Detail permohonan izin">
      <div className="modal-h">
        <div>
          <h2>{r.pemohon || "(tanpa nama)"}</h2>
          <p>{r.izin}</p>
          <div className="row-gap" style={{ marginTop: 6 }}>
            <span className={"badge " + (status === "Sudah ditetapkan" ? "ok" : "warn")}>{status}</span>
            <span className="badge">{katIzin(r)}</span>
            {lama != null && <span className={"badge" + (sla != null ? (lama <= sla ? " ok" : " warn") : "")} title={sla != null ? `Standar layanan ${sla} hari` : undefined}>Diproses {lama} hari{sla != null ? (lama <= sla ? " · tepat waktu" : ` · lewat ${lama - sla} hari dari standar`) : ""}</span>}
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
      </div>
      <div className="modal-b">
        {SECTIONS.map(([title, keys]) => (
          <section key={title}>
            <div className="dsec">{title}
              {title === "Pemohon" && <button className="link small dsec-link" onClick={() => { onClose(); nav(`/sicantik/pemohon?id=${encodeURIComponent(r.pemohon_id)}`); }}>Lihat pemohon · {nSama} permohonan →</button>}
            </div>
            <dl className="dl">
              {keys.map((k) => {
                let val = String(r[k] ?? "");
                if (k === "tanggal" || k === "tgl_penetapan") val = fmtDateLong(r[k]);
                const ktp = k === "no_ktp" && !!r.no_ktp;
                if (ktp && !ktpOpen) val = maskNik(r.no_ktp);
                return (
                  <div key={k} className={k === "izin" ? "span2" : ""}>
                    <dt>{SIC_PRETTY[k]}</dt>
                    <dd className={["no_ktp", "nomor_izin", "no_permohonan", "id_sicantik"].includes(k) ? "mono" : ""}>
                      {val || <span className="muted">—</span>}
                      {ktp && <button className="link small" onClick={() => setKtpOpen(!ktpOpen)}> {ktpOpen ? "Sembunyikan" : "Tampilkan"}</button>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
        <DocsPanel kind="sicantik" id={r.id_sicantik} docs={docs} note={r.keterangan} canWrite={canWrite} onChanged={refresh} extraLabels={syarat} />
        {syarat.length > 0 && (
          <div className="syarat-box">
            <b>Daftar periksa persyaratan</b> — {syarat.filter((x) => syaratTerpenuhi(x, docLabels)).length} dari {syarat.length} dokumen sudah diarsipkan
            <ul className="syarat">{syarat.map((x) => { const ok = syaratTerpenuhi(x, docLabels); return <li key={x} className={ok ? "ok" : "miss"}>{ok ? <CheckCircle2 size={15} /> : <Circle size={15} />}{x}</li>; })}</ul>
          </div>
        )}
        <p className="cell-sub meta">Sumber: {r.sumber === "import" ? `Import Excel${r.file_import ? ` (${r.file_import})` : ""}` : "Input manual"}{r.updated_at ? ` · Diperbarui ${new Date(r.updated_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}` : ""}</p>
      </div>
      <div className="modal-f">
        {canWrite ? (
          <>
            <button className="btn danger" onClick={remove}><Trash2 size={16} />Hapus</button>
            <span className="grow" />
            <button className="btn primary" onClick={() => { onClose(); nav(`/sicantik/input/${encodeURIComponent(r.id_sicantik)}`); }}><Pencil size={16} />Edit data</button>
          </>
        ) : <button className="btn" onClick={onClose}>Tutup</button>}
      </div>
    </Modal>
  );
}
