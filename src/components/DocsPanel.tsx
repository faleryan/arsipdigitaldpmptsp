import { useState } from "react";
import { ExternalLink, FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import { useUI } from "../context/UIContext";
import type { Dokumen } from "../lib/columns";
import { fmtSize } from "../lib/format";
import * as api from "../lib/api";

/** Daftar dokumen arsip + tombol unggah, dipakai OSS & SiCantik */
export function DocsPanel({ kind, id, docs, note, canWrite, onChanged }: {
  kind: api.DocKind; id: string; docs: Dokumen[]; note?: string; canWrite: boolean; onChanged: () => Promise<void>;
}) {
  const { toast, confirm } = useUI();
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

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
          await api.uploadDokumen(kind, id, f, label.trim());
        }
        setLabel("");
        toast(`${files.length} dokumen diunggah`);
        await onChanged();
      } catch (e) { toast(api.errMsg(e), 5000); }
      setBusy(false);
    };
    inp.click();
  };
  const remove = async (d: Dokumen) => {
    if (!(await confirm({ title: "Hapus dokumen?", body: <>Dokumen <b>{d.nama_file}</b> akan dihapus permanen dari arsip.</>, ok: "Hapus", danger: true }))) return;
    try { await api.deleteDokumen(kind, d); toast("Dokumen dihapus"); await onChanged(); } catch (e) { toast(api.errMsg(e)); }
  };

  return (
    <>
      <div className="dsec">Arsip dokumen</div>
      {note && (
        <p className="arsip-note">{/^https?:\/\//i.test(note) ? <a href={note} target="_blank" rel="noopener noreferrer">{note} <ExternalLink size={13} /></a> : note}</p>
      )}
      <div className="docs">
        {docs.length ? docs.map((d) => (
          <div className="doc-item" key={d.id}>
            <FileText size={18} className="doc-ico" />
            <span className="nm" title={d.nama_file}>{d.label && <b>{d.label} — </b>}{d.nama_file}</span>
            <span className="cell-sub">{fmtSize(d.ukuran)}</span>
            <button className="btn sm" onClick={() => open(d)}>Buka</button>
            {canWrite && <button className="icon-btn danger" onClick={() => remove(d)} aria-label={`Hapus ${d.nama_file}`}><Trash2 size={16} /></button>}
          </div>
        )) : !note && <div className="cell-sub">Belum ada dokumen terlampir.</div>}
      </div>
      {canWrite && (
        <div className="upload-row">
          <input className="inp" placeholder="Jenis dokumen (mis. Surat Izin, KTP, STR, Rekomendasi)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className="btn" onClick={upload} disabled={busy}>{busy ? <Loader2 size={16} className="spin-ico" /> : <Paperclip size={16} />}{busy ? "Mengunggah…" : "Unggah dokumen"}</button>
        </div>
      )}
    </>
  );
}
