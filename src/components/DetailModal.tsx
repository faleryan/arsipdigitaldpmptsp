import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2, X } from "lucide-react";
import { DocsPanel } from "./DocsPanel";
import { Modal } from "./Modal";
import { useAuth } from "../context/AuthContext";
import { useData, useKbli } from "../context/DataContext";
import { titleCase } from "../lib/master";
import { useUI } from "../context/UIContext";
import { PRETTY, type FieldKey, type Proyek } from "../lib/columns";
import { fmtDateLong, fmtInt, fmtNum, fmtRp, kecLabel, maskNik } from "../lib/format";
import * as api from "../lib/api";

const SECTIONS: [string, FieldKey[]][] = [
  ["Data proyek", ["id_proyek", "jenis_proyek", "nama_proyek", "tgl_pengajuan", "risiko", "skala_usaha", "no_kegiatan"]],
  ["Pelaku usaha", ["nib", "nama_perusahaan", "jenis_perusahaan", "status_pm", "tgl_terbit_oss", "nik", "nohp", "email", "username", "alamat_perusahaan", "kel_perusahaan", "kec_perusahaan", "kab_perusahaan"]],
  ["Lokasi usaha", ["alamat_usaha", "kel_usaha", "kec_usaha", "kab_usaha", "luas_tanah"]],
  ["KBLI & investasi", ["kbli", "judul_kbli", "sektor", "investasi", "tki"]],
];

function show(r: Proyek, k: FieldKey): string {
  const v = r[k];
  if (k === "investasi") return r.investasi != null ? fmtRp(r.investasi) : "";
  if (k === "tki") return r.tki != null ? fmtInt(r.tki) + " orang" : "";
  if (k === "luas_tanah") return r.luas_tanah != null ? `${fmtNum(r.luas_tanah)} ${r.satuan_tanah || ""}` : "";
  if (k === "tgl_pengajuan" || k === "tgl_terbit_oss") return fmtDateLong(v as string);
  if (k === "kec_usaha") return kecLabel(r.kec_usaha);
  return v == null ? "" : String(v);
}

export function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { byId, rows, refresh } = useData();
  const kb = useKbli();
  const { canWrite } = useAuth();
  const { toast, confirm } = useUI();
  const nav = useNavigate();
  const [nikOpen, setNikOpen] = useState(false);
  const r = byId.get(id);
  if (!r) return null;
  const docs = r.oss_dokumen || [];
  const nSama = rows.filter((x) => x.nib === r.nib).length;

  const remove = async () => {
    if (!(await confirm({ title: "Hapus data proyek?", body: <>Data <b>{r.nama_proyek || r.id_proyek}</b> beserta {docs.length} dokumennya akan dihapus. Tindakan ini tidak dapat dibatalkan.</>, ok: "Hapus", danger: true }))) return;
    try { await api.deleteProyek(r.id_proyek, docs); toast("Data dihapus"); onClose(); await refresh(); } catch (e) { toast(api.errMsg(e)); }
  };

  return (
    <Modal onClose={onClose} size="lg" label="Detail proyek">
      <div className="modal-h">
        <div><h2>{r.nama_proyek || r.nama_perusahaan || r.id_proyek}</h2><p className="mono">{r.id_proyek}</p></div>
        <button className="icon-btn" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
      </div>
      <div className="modal-b">
        {SECTIONS.map(([title, keys]) => (
          <section key={title}>
            <div className="dsec">{title}
              {title === "KBLI & investasi" && r.kbli && kb.rows.length > 0 && (kb.index.get(r.kbli)
                ? <button className="link small dsec-link" onClick={() => { onClose(); nav(`/oss/kbli?kode=${encodeURIComponent(r.kbli)}`); }}>KBLI {kb.index.get(r.kbli)!.versi} · {titleCase(kb.index.kategoriLabel(kb.index.kategoriOf(r.kbli)))} · lihat uraian →</button>
                : <span className="kbli-warn dsec-link">Kode tidak ada di Master KBLI (versi lama?)</span>)}
              {title === "Pelaku usaha" && <button className="link small dsec-link" onClick={() => { onClose(); nav(`/oss/pelaku?nib=${encodeURIComponent(r.nib)}`); }}>Lihat pelaku usaha · {nSama} proyek →</button>}
            </div>
            <dl className="dl">
              {keys.map((k) => {
                let val = show(r, k);
                const nik = k === "nik" && !!r.nik;
                if (nik && !nikOpen) val = maskNik(r.nik);
                return (
                  <div key={k}>
                    <dt>{PRETTY[k]}</dt>
                    <dd className={k === "nik" || k === "nib" ? "mono" : ""}>
                      {val || <span className="muted">—</span>}
                      {nik && <button className="link small" onClick={() => setNikOpen(!nikOpen)}> {nikOpen ? "Sembunyikan" : "Tampilkan"}</button>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
        <DocsPanel kind="oss" id={r.id_proyek} docs={docs} note={r.arsip_dokumen} canWrite={canWrite} onChanged={refresh} />
        <p className="cell-sub meta">Sumber: {r.sumber === "import" ? `Import Excel${r.file_import ? ` (${r.file_import})` : ""}` : "Input manual"}{r.updated_at ? ` · Diperbarui ${new Date(r.updated_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}` : ""}</p>
      </div>
      <div className="modal-f">
        {canWrite ? (
          <>
            <button className="btn danger" onClick={remove}><Trash2 size={16} />Hapus</button>
            <span className="grow" />
            <button className="btn primary" onClick={() => { onClose(); nav(`/oss/input/${encodeURIComponent(r.id_proyek)}`); }}><Pencil size={16} />Edit data</button>
          </>
        ) : <button className="btn" onClick={onClose}>Tutup</button>}
      </div>
    </Modal>
  );
}
