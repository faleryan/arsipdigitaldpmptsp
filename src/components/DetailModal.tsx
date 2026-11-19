import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, FileText, Loader2, Paperclip, Pencil, Trash2, X } from "lucide-react";
import { Modal } from "./Modal";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useUI } from "../context/UIContext";
import { PRETTY, type Dokumen, type FieldKey, type Proyek } from "../lib/columns";
import { fmtDateLong, fmtInt, fmtNum, fmtRp, fmtSize, kecLabel, maskNik } from "../lib/format";
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
  const { byId, refresh } = useData();
  const { canWrite } = useAuth();
  const { toast, confirm } = useUI();
  const nav = useNavigate();
  const [nikOpen, setNikOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const r = byId.get(id);
  if (!r) return null;
  const docs = r.oss_dokumen || [];

  const open = async (d: Dokumen) => {
    const w = window.open("", "_blank");
    try { const u = await api.dokumenUrl(d); if (w) w.location.href = u; else window.location.href = u; }
    catch (e) { w?.close(); toast(api.errMsg(e)); }
  };
  const upload = () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/pdf,image/jpeg,image/png,image/webp"; inp.multiple = true;
    inp.onchange = async () => {
      const files = [...(inp.files || [])];
      if (!files.length) return;
      setBusy(true);
      try {
        for (const f of files) {
          if (f.size > 20 * 1024 * 1024) throw new Error(`${f.name} melebihi 20 MB`);
          await api.uploadDokumen(r.id_proyek, f, label.trim());
        }
        setLabel("");
        toast(`${files.length} dokumen diunggah`);
        await refresh();
      } catch (e) { toast(api.errMsg(e), 5000); }
      setBusy(false);
    };
    inp.click();
  };
  const removeDoc = async (d: Dokumen) => {
    if (!(await confirm({ title: "Hapus dokumen?", body: <>Dokumen <b>{d.nama_file}</b> akan dihapus permanen dari arsip.</>, ok: "Hapus", danger: true }))) return;
    try { await api.deleteDokumen(d); toast("Dokumen dihapus"); await refresh(); } catch (e) { toast(api.errMsg(e)); }
  };
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
            <div className="dsec">{title}</div>
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
        <div className="dsec">Arsip dokumen</div>
        {r.arsip_dokumen && (
          <p className="arsip-note">{/^https?:\/\//i.test(r.arsip_dokumen) ? <a href={r.arsip_dokumen} target="_blank" rel="noopener noreferrer">{r.arsip_dokumen} <ExternalLink size={13} /></a> : r.arsip_dokumen}</p>
        )}
        <div className="docs">
          {docs.length ? docs.map((d) => (
            <div className="doc-item" key={d.id}>
              <FileText size={18} className="doc-ico" />
              <span className="nm" title={d.nama_file}>{d.label && <b>{d.label} — </b>}{d.nama_file}</span>
              <span className="cell-sub">{fmtSize(d.ukuran)}</span>
              <button className="btn sm" onClick={() => open(d)}>Buka</button>
              {canWrite && <button className="icon-btn danger" onClick={() => removeDoc(d)} aria-label={`Hapus ${d.nama_file}`}><Trash2 size={16} /></button>}
            </div>
          )) : !r.arsip_dokumen && <div className="cell-sub">Belum ada dokumen terlampir.</div>}
        </div>
        {canWrite && (
          <div className="upload-row">
            <input className="inp" placeholder="Jenis dokumen (mis. NIB, PKKPR, Izin Usaha)" value={label} onChange={(e) => setLabel(e.target.value)} />
            <button className="btn" onClick={upload} disabled={busy}>{busy ? <Loader2 size={16} className="spin-ico" /> : <Paperclip size={16} />}{busy ? "Mengunggah…" : "Unggah dokumen"}</button>
          </div>
        )}
        <p className="cell-sub meta">Sumber: {r.sumber === "import" ? `Import Excel${r.file_import ? ` (${r.file_import})` : ""}` : "Input manual"}{r.updated_at ? ` · Diperbarui ${new Date(r.updated_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}` : ""}</p>
      </div>
      <div className="modal-f">
        {canWrite ? (
          <>
            <button className="btn danger" onClick={remove}><Trash2 size={16} />Hapus</button>
            <span className="grow" />
            <button className="btn primary" onClick={() => { onClose(); nav(`/input/${encodeURIComponent(r.id_proyek)}`); }}><Pencil size={16} />Edit data</button>
          </>
        ) : <button className="btn" onClick={onClose}>Tutup</button>}
      </div>
    </Modal>
  );
}
