import { useState } from "react";
import { ExternalLink, FileText, Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { useUI } from "../context/UIContext";
import type { Dokumen } from "../lib/columns";
import { fmtSize } from "../lib/format";
import * as api from "../lib/api";
import { DocUploader, LABELS_OSS, LABELS_PELAKU, LABELS_SICANTIK, type PendingDoc } from "./DocUploader";

/** Unggah beberapa dokumen berurutan. Mengembalikan jumlah yang berhasil. */
export async function uploadAll(kind: api.DocKind, id: string, pending: PendingDoc[], onStep?: (i: number) => void) {
  let ok = 0;
  for (const p of pending) {
    onStep?.(ok);
    await api.uploadDokumen(kind, id, p.file, p.label.trim());
    ok++;
  }
  return ok;
}

/** Daftar dokumen arsip + unggah banyak dokumen, dipakai OSS & SiCantik */
export function DocsPanel({ kind, id, docs, note, canWrite, onChanged, extraLabels = [], title = "Arsip dokumen", hint }: {
  kind: api.DocKind; id: string; docs: Dokumen[]; note?: string; canWrite: boolean; onChanged: () => Promise<void>; extraLabels?: string[];
  title?: string; hint?: string;
}) {
  const { toast, confirm } = useUI();
  const [pending, setPending] = useState<PendingDoc[]>([]);
  const [busy, setBusy] = useState<number | null>(null);

  const open = async (d: Dokumen) => {
    const w = window.open("", "_blank");
    try { const u = await api.dokumenUrl(d); if (w) w.location.href = u; else window.location.href = u; }
    catch (e) { w?.close(); toast(api.errMsg(e)); }
  };
  const upload = async () => {
    setBusy(0);
    let n = 0;
    try { n = await uploadAll(kind, id, pending, setBusy); setPending([]); toast(`${n} dokumen diunggah`); }
    catch (e) { setPending(pending.slice(n)); toast(`${n} dokumen diunggah, sisanya gagal: ${api.errMsg(e)}`, 6000); }
    setBusy(null);
    await onChanged();
  };
  const remove = async (d: Dokumen) => {
    if (!(await confirm({ title: "Hapus dokumen?", body: <>Dokumen <b>{d.nama_file}</b> akan dihapus permanen dari arsip.</>, ok: "Hapus", danger: true }))) return;
    try { await api.deleteDokumen(kind, d); toast("Dokumen dihapus"); await onChanged(); } catch (e) { toast(api.errMsg(e)); }
  };

  return (
    <>
      <div className="dsec">{title} {docs.length > 0 && <span className="count">{docs.length}</span>}</div>
      {hint && <p className="cell-sub" style={{ margin: "-4px 0 8px" }}>{hint}</p>}
      {note && (
        <p className="arsip-note">{/^https?:\/\//i.test(note) ? <a href={note} target="_blank" rel="noopener noreferrer">{note} <ExternalLink size={13} /></a> : note}</p>
      )}
      <div className="docs">
        {docs.length ? [...docs].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((d) => (
          <div className="doc-item" key={d.id}>
            {d.tipe?.startsWith("image/") ? <ImageIcon size={18} className="doc-ico" /> : <FileText size={18} className="doc-ico" />}
            <span className="nm" title={d.nama_file}>{d.label ? <span className="doc-tag">{d.label}</span> : null}{d.nama_file}</span>
            <span className="cell-sub nowrap">{fmtSize(d.ukuran)}</span>
            <button className="btn sm" onClick={() => open(d)}>Buka</button>
            {canWrite && <button className="icon-btn danger" onClick={() => remove(d)} aria-label={`Hapus ${d.nama_file}`}><Trash2 size={16} /></button>}
          </div>
        )) : !note && <div className="cell-sub">Belum ada dokumen.</div>}
      </div>
      {canWrite && (
        <div className="docs-add">
          <DocUploader pending={pending} onChange={setPending} labels={[...extraLabels, ...(kind === "oss" ? LABELS_OSS : kind === "pelaku" ? LABELS_PELAKU : LABELS_SICANTIK).filter((l) => !extraLabels.includes(l))]} onReject={(m) => toast(m, 6000)} compact />
          {pending.length > 0 && (
            <div className="row-gap end">
              <button className="btn ghost sm" disabled={busy !== null} onClick={() => setPending([])}>Batal</button>
              <button className="btn primary sm" disabled={busy !== null} onClick={upload}>
                {busy !== null ? <><Loader2 size={15} className="spin-ico" />Mengunggah {busy + 1}/{pending.length}…</> : <><Upload size={15} />Unggah {pending.length} dokumen</>}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
