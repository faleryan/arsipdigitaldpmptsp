import { useRef, useState } from "react";
import { FileText, Image as ImageIcon, Plus, X } from "lucide-react";
import { fmtSize } from "../lib/format";

export interface PendingDoc { key: string; file: File; label: string }
export const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
const OK_TYPE = /^(application\/pdf|image\/(jpeg|png|webp))$/;

export const LABELS_PELAKU = ["NIB", "Akta Pendirian", "SK Kemenkumham", "NPWP", "KTP Penanggung Jawab", "Surat Kuasa", "Lainnya"];
export const LABELS_OSS = ["Sertifikat Standar", "Izin Usaha", "PKKPR", "PBG / IMB", "Persetujuan Lingkungan", "Foto Lokasi", "Surat Pernyataan", "Lainnya"];
export const LABELS_SICANTIK = ["Surat Izin", "STR", "KTP", "Ijazah", "Surat Rekomendasi", "Surat Keterangan Sehat", "Pas Foto", "Surat Pernyataan", "Dokumen Teknis", "Lainnya"];

/** Pilih beberapa file sekaligus; setiap file diberi jenis dokumennya sendiri */
export function DocUploader({ pending, onChange, labels, onReject, compact }: {
  pending: PendingDoc[]; onChange: (p: PendingDoc[]) => void; labels: string[]; onReject?: (msg: string) => void; compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const listId = useRef("dl-doc-" + Math.random().toString(36).slice(2)).current;

  const add = (files: File[]) => {
    const ok: PendingDoc[] = [];
    const bad: string[] = [];
    for (const f of files) {
      if (f.size > MAX_BYTES) bad.push(`${f.name} (lebih dari 20 MB)`);
      else if (f.type && !OK_TYPE.test(f.type)) bad.push(`${f.name} (bukan PDF/JPG/PNG/WEBP)`);
      else ok.push({ key: Math.random().toString(36).slice(2), file: f, label: guessLabel(f.name, labels) });
    }
    if (bad.length) onReject?.("Dilewati: " + bad.join(", "));
    if (ok.length) onChange([...pending, ...ok]);
  };
  const setLabel = (key: string, label: string) => onChange(pending.map((p) => (p.key === key ? { ...p, label } : p)));

  return (
    <div className="uploader">
      <div className={"drop mini" + (over ? " over" : "") + (compact ? " compact" : "")} role="button" tabIndex={0}
        onClick={() => ref.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ref.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add([...e.dataTransfer.files]); }}>
        <Plus size={18} />
        <span><b>Tambah dokumen</b> — seret file ke sini atau klik untuk memilih. Bisa beberapa file sekaligus (PDF/JPG/PNG/WEBP, maks. 20 MB per file).</span>
        <input ref={ref} type="file" hidden multiple accept={ACCEPT} onChange={(e) => { add([...(e.target.files || [])]); e.target.value = ""; }} />
      </div>
      {pending.length > 0 && (
        <div className="docs">
          <datalist id={listId}>{labels.map((l) => <option key={l} value={l} />)}</datalist>
          {pending.map((p, i) => (
            <div className="doc-item pending" key={p.key}>
              {p.file.type.startsWith("image/") ? <ImageIcon size={17} className="doc-ico" /> : <FileText size={17} className="doc-ico" />}
              <span className="nm" title={p.file.name}>{i + 1}. {p.file.name}<small className="cell-sub"> · {fmtSize(p.file.size)}</small></span>
              <input className="inp doc-label" list={listId} value={p.label} placeholder="Jenis dokumen" aria-label={`Jenis dokumen untuk ${p.file.name}`}
                onChange={(e) => setLabel(p.key, e.target.value)} />
              <button type="button" className="icon-btn" onClick={() => onChange(pending.filter((x) => x.key !== p.key))} aria-label={`Batalkan ${p.file.name}`}><X size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tebak jenis dokumen dari nama file, mis. "nib_pt_abc.pdf" → "NIB" */
function guessLabel(name: string, labels: string[]): string {
  const n = name.toLowerCase().replace(/[_\-.]+/g, " ");
  const rules: [RegExp, string][] = [
    [/\bnib\b/, "NIB"], [/sertifikat|standar/, "Sertifikat Standar"], [/pkkpr|kkpr/, "PKKPR"], [/\bpbg\b|\bimb\b/, "PBG / IMB"],
    [/amdal|ukl|upl|sppl|lingkungan/, "Persetujuan Lingkungan"], [/akta/, "Akta Pendirian"], [/npwp/, "NPWP"], [/\bktp\b/, labels.includes("KTP") ? "KTP" : "KTP Penanggung Jawab"],
    [/\bstr\b/, "STR"], [/ijazah/, "Ijazah"], [/rekomendasi/, "Surat Rekomendasi"], [/sehat/, "Surat Keterangan Sehat"], [/foto/, "Pas Foto"],
    [/pernyataan/, "Surat Pernyataan"], [/foto|lokasi/, "Foto Lokasi"], [/kemenkumham|\bsk\b/, "SK Kemenkumham"], [/kuasa/, "Surat Kuasa"], [/\bsip\b|izin|ijin/, labels.includes("Surat Izin") ? "Surat Izin" : "Izin Usaha"],
  ];
  for (const [re, l] of rules) if (re.test(n) && labels.includes(l)) return l;
  return "";
}
