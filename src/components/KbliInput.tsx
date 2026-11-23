import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Kbli, KbliIndex } from "../lib/master";
import { titleCase } from "../lib/master";

export interface KbliOption { kode: string; judul: string; ket: string }

/**
 * Isian KBLI dengan saran.
 * mode "kode": ketik kode / kata kunci → pilih → kode & judul terisi.
 * mode "judul": ketik judul → pilih → kode & judul terisi.
 * Saran diambil dari Master KBLI (tingkat Kelompok) ditambah KBLI yang pernah dipakai di arsip.
 */
export function KbliInput({ id, value, onChange, onPick, index, options, err, mode = "kode", status = true }: {
  id: string; value: string; onChange: (v: string) => void; onPick: (o: KbliOption) => void;
  index: KbliIndex; options: KbliOption[]; err?: boolean; mode?: "kode" | "judul"; status?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const results = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/);
    const out: KbliOption[] = [];
    for (const o of options) {
      const ok = mode === "kode" && /^\d+$/.test(q) ? o.kode.startsWith(q) : terms.every((t) => (o.kode + " " + o.judul).toLowerCase().includes(t));
      if (ok) { out.push(o); if (out.length >= 8) break; }
    }
    return out;
  }, [options, value, mode]);
  const found = mode === "kode" ? index.get(value.trim()) : undefined;
  const exact = results.length === 1 && (mode === "kode" ? results[0].kode === value.trim() : results[0].judul.toLowerCase() === value.trim().toLowerCase());
  const pick = (o: KbliOption) => { onPick(o); setOpen(false); };

  return (
    <div className="kbli-input">
      <input id={id} className={"inp" + (err ? " err" : "")} value={value} autoComplete="off"
        placeholder={mode === "kode" ? "Ketik kode atau kata kunci, mis. 47211 / eceran sayur" : "Ketik judul KBLI untuk mencari kodenya"}
        role="combobox" aria-expanded={open && results.length > 0} aria-autocomplete="list" inputMode={mode === "kode" ? "text" : undefined}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || !results.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(results.length - 1, h + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
          else if (e.key === "Enter") { e.preventDefault(); pick(results[hi]); }
          else if (e.key === "Escape") setOpen(false);
        }} />
      {open && results.length > 0 && !exact && (
        <div className="picker-list kbli-list" role="listbox">
          {results.map((o, i) => (
            <div key={o.kode} role="option" aria-selected={i === hi} className={"picker-item" + (i === hi ? " hi" : "")}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }} onMouseEnter={() => setHi(i)}>
              <b><span className="mono">{o.kode}</span> · {o.judul}</b>
              <small>{o.ket}</small>
            </div>
          ))}
        </div>
      )}
      {status && mode === "kode" && value.trim() && (found
        ? <span className="kbli-ok"><CheckCircle2 size={13} /> KBLI {found.versi} · {index.kategoriLabel(found.kategori)}</span>
        : /^\d{5}$/.test(value.trim()) && (options.some((o) => o.kode === value.trim())
          ? <span className="kbli-warn"><AlertTriangle size={13} /> Tidak ada di Master KBLI — judul diambil dari arsip (KBLI versi lama?)</span>
          : <span className="kbli-warn"><AlertTriangle size={13} /> Kode tidak dikenal — isi judul KBLI secara manual</span>))}
    </div>
  );
}

/** Gabungan pilihan KBLI: Master KBLI (Kelompok, aktif) + kode lama yang dipakai di arsip */
export function kbliOptions(rows: Kbli[], index: KbliIndex, arsip: Record<string, { judul: string }>): KbliOption[] {
  const m = new Map<string, KbliOption>();
  for (const r of rows) if (r.tingkat === "Kelompok" && r.aktif !== false) {
    const k = index.get(r.kode) || r;
    m.set(k.kode, { kode: k.kode, judul: titleCase(k.judul), ket: `KBLI ${k.versi} · Kategori ${index.kategoriLabel(k.kategori)}` });
  }
  for (const [kode, a] of Object.entries(arsip)) if (!m.has(kode) && /^\d{5}$/.test(kode)) m.set(kode, { kode, judul: a.judul, ket: "Dari arsip (tidak ada di Master KBLI)" });
  return [...m.values()].sort((a, b) => a.kode.localeCompare(b.kode));
}
