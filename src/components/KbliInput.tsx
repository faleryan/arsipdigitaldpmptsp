import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Kbli, KbliIndex } from "../lib/master";
import { titleCase } from "../lib/master";

/** Isian KBLI dengan saran dari Master KBLI (tingkat Kelompok / 5 digit) */
export function KbliInput({ id, value, onChange, onPick, index, rows, err }: {
  id: string; value: string; onChange: (v: string) => void; onPick: (k: Kbli) => void; index: KbliIndex; rows: Kbli[]; err?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const kelompok = useMemo(() => {
    const m = new Map<string, Kbli>();
    for (const r of rows) if (r.tingkat === "Kelompok" && r.aktif !== false) m.set(r.kode, index.get(r.kode) || r);
    return [...m.values()].sort((a, b) => a.kode.localeCompare(b.kode));
  }, [rows, index]);
  const results = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/);
    const out: Kbli[] = [];
    for (const k of kelompok) {
      const hay = (k.kode + " " + k.judul).toLowerCase();
      if (/^\d+$/.test(q) ? k.kode.startsWith(q) : terms.every((t) => hay.includes(t))) { out.push(k); if (out.length >= 8) break; }
    }
    return out;
  }, [kelompok, value]);
  const found = index.get(value.trim());
  const pick = (k: Kbli) => { onPick(k); setOpen(false); };

  return (
    <div className="kbli-input">
      <input id={id} className={"inp" + (err ? " err" : "")} value={value} autoComplete="off" placeholder={rows.length ? "Ketik kode atau kata kunci, mis. 47211 / eceran sayur" : "Kode KBLI 5 digit"}
        role="combobox" aria-expanded={open && results.length > 0} aria-autocomplete="list"
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || !results.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(results.length - 1, h + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
          else if (e.key === "Enter") { e.preventDefault(); pick(results[hi]); }
          else if (e.key === "Escape") setOpen(false);
        }} />
      {open && results.length > 0 && !(found && results.length === 1 && results[0].kode === value.trim()) && (
        <div className="picker-list kbli-list" role="listbox">
          {results.map((k, i) => (
            <div key={k.kode} role="option" aria-selected={i === hi} className={"picker-item" + (i === hi ? " hi" : "")}
              onMouseDown={(e) => { e.preventDefault(); pick(k); }} onMouseEnter={() => setHi(i)}>
              <b><span className="mono">{k.kode}</span> · {titleCase(k.judul)}</b>
              <small>Kategori {index.kategoriLabel(k.kategori)} · KBLI {k.versi}</small>
            </div>
          ))}
        </div>
      )}
      {value.trim() && rows.length > 0 && (found
        ? <span className="kbli-ok"><CheckCircle2 size={13} /> KBLI {found.versi} · {index.kategoriLabel(found.kategori)}</span>
        : /^\d{5}$/.test(value.trim()) && <span className="kbli-warn"><AlertTriangle size={13} /> Tidak ada di Master KBLI (mungkin KBLI versi lama)</span>)}
    </div>
  );
}
