import { useMemo, useRef, useState } from "react";
import { Check, PlusCircle, Search, X } from "lucide-react";

export interface PickItem { id: string; title: string; sub: string; meta?: string; search: string }

/** Kotak pencarian untuk memilih data induk (pelaku usaha / pemohon) */
export function MasterPicker({ items, value, onSelect, onNew, placeholder, newLabel, label, error }: {
  items: PickItem[]; value: string | null; onSelect: (id: string | null) => void; onNew?: (typed: string) => void;
  placeholder: string; newLabel: string; label: string; error?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = value ? items.find((i) => i.id === value) : undefined;

  const results = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return items.slice(0, 8);
    const out: PickItem[] = [];
    for (const it of items) { if (terms.every((t) => it.search.includes(t))) { out.push(it); if (out.length >= 8) break; } }
    return out;
  }, [items, q]);
  const total = results.length + (onNew ? 1 : 0);

  const choose = (i: number) => {
    if (i < results.length) { onSelect(results[i].id); setQ(""); setOpen(false); }
    else if (onNew) { onNew(q.trim()); setQ(""); setOpen(false); }
  };

  if (selected) {
    return (
      <div className="picked">
        <span className="picked-ico"><Check size={16} /></span>
        <div className="picked-t"><b>{selected.title}</b><span>{selected.sub}</span>{selected.meta && <small>{selected.meta}</small>}</div>
        <button type="button" className="btn sm" onClick={() => { onSelect(null); setTimeout(() => inputRef.current?.focus(), 0); }}><X size={14} />Ganti</button>
      </div>
    );
  }
  return (
    <div className="picker">
      <label className="picker-label" htmlFor="pickerInput">{label}</label>
      <div className="search">
        <Search size={16} />
        <input id="pickerInput" ref={inputRef} className={"inp" + (error ? " err" : "")} placeholder={placeholder} value={q} autoComplete="off"
          role="combobox" aria-expanded={open} aria-controls="pickerList" aria-autocomplete="list"
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(total - 1, h + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
            else if (e.key === "Enter" && open && total) { e.preventDefault(); choose(hi); }
            else if (e.key === "Escape") setOpen(false);
          }} />
      </div>
      {error && <span className="msg">{error}</span>}
      {open && (
        <div className="picker-list" id="pickerList" role="listbox">
          {results.map((it, i) => (
            <div key={it.id} role="option" aria-selected={i === hi} className={"picker-item" + (i === hi ? " hi" : "")}
              onMouseDown={(e) => { e.preventDefault(); choose(i); }} onMouseEnter={() => setHi(i)}>
              <b>{it.title}</b><span>{it.sub}</span>{it.meta && <small>{it.meta}</small>}
            </div>
          ))}
          {!results.length && <div className="picker-empty">Tidak ditemukan “{q}”.</div>}
          {onNew && (
            <div role="option" aria-selected={hi === results.length} className={"picker-item new" + (hi === results.length ? " hi" : "")}
              onMouseDown={(e) => { e.preventDefault(); choose(results.length); }} onMouseEnter={() => setHi(results.length)}>
              <PlusCircle size={16} /><b>{newLabel}</b>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
