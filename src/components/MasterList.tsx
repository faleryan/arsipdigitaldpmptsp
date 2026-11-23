import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { fmtInt } from "../lib/format";

export interface Col<T> { key: string; label: string; num?: boolean; sort?: (r: T) => string | number; render: (r: T) => ReactNode; mobile?: boolean }

/** Tabel daftar data induk dengan pencarian, urutan & halaman */
export function MasterList<T>({ rows, cols, keyOf, searchOf, onOpen, placeholder, defaultSort, filters, mobileItem }: {
  rows: T[]; cols: Col<T>[]; keyOf: (r: T) => string; searchOf: (r: T) => string; onOpen: (r: T) => void; placeholder: string;
  defaultSort: { k: string; dir: 1 | -1 }; filters?: ReactNode; mobileItem: (r: T) => ReactNode;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(defaultSort);
  const [page, setPage] = useState(1);
  const size = 25;
  const shown = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const out = terms.length ? rows.filter((r) => { const h = searchOf(r); return terms.every((t) => h.includes(t)); }) : [...rows];
    const col = cols.find((c) => c.key === sort.k);
    if (col?.sort) out.sort((a, b) => {
      const x = col.sort!(a), y = col.sort!(b);
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "id", { numeric: true })) * sort.dir;
    });
    return out;
  }, [rows, q, sort, cols, searchOf]);
  const pages = Math.max(1, Math.ceil(shown.length / size));
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);
  const pageRows = shown.slice((page - 1) * size, page * size);

  return (
    <>
      <div className="filters">
        <div className="search"><Search size={16} /><input className="inp" type="search" placeholder={placeholder} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Cari" /></div>
        {filters}
        <span className="cell-sub">{fmtInt(shown.length)} dari {fmtInt(rows.length)}</span>
      </div>
      <div className="card">
        {!shown.length ? <div className="empty big">{rows.length ? "Tidak ada yang cocok dengan pencarian." : "Belum ada data."}</div> : (
          <>
            <div className="tbl-wrap desk-only"><table>
              <thead><tr>{cols.map((c) => (
                <th key={c.key} className={(c.num ? "num " : "") + (c.sort ? "sortable" : "")} aria-sort={sort.k === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
                  onClick={() => c.sort && setSort(sort.k === c.key ? { k: c.key, dir: (sort.dir * -1) as 1 | -1 } : { k: c.key, dir: c.num ? -1 : 1 })}>
                  {c.label}{sort.k === c.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                </th>
              ))}</tr></thead>
              <tbody>{pageRows.map((r) => (
                <tr key={keyOf(r)} className="clk" tabIndex={0} onClick={() => onOpen(r)} onKeyDown={(e) => e.key === "Enter" && onOpen(r)}>
                  {cols.map((c) => <td key={c.key} className={c.num ? "num" : ""}>{c.render(r)}</td>)}
                </tr>
              ))}</tbody>
            </table></div>
            <div className="mob-list mob-only">{pageRows.map((r) => <button key={keyOf(r)} className="mob-item" onClick={() => onOpen(r)}>{mobileItem(r)}</button>)}</div>
          </>
        )}
      </div>
      {shown.length > size && (
        <div className="pager"><span>Halaman {page} dari {pages}</span>
          <span className="row-gap">
            <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} />Sebelumnya</button>
            <button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Berikutnya<ChevronRight size={16} /></button>
          </span>
        </div>
      )}
    </>
  );
}
