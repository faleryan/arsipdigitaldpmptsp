import type { Proyek } from "./columns";
import { BULAN, BULAN_S, hasArsip, isISO, pad2 } from "./format";

export type Metric = "proyek" | "investasi" | "tki";

export interface Group {
  key: string;
  proyek: number;
  investasi: number;
  tki: number;
  pelaku: number;
  arsip: number;
  value: number;
  sample: Proyek;
}

export function groupBy(rows: Proyek[], keyFn: (r: Proyek) => string, metric: Metric = "proyek"): Group[] {
  const m = new Map<string, Group & { nibs: Set<string> }>();
  for (const r of rows) {
    const k = keyFn(r) || "(Tidak diisi)";
    let g = m.get(k);
    if (!g) { g = { key: k, proyek: 0, investasi: 0, tki: 0, pelaku: 0, arsip: 0, value: 0, sample: r, nibs: new Set() }; m.set(k, g); }
    g.proyek++;
    g.investasi += r.investasi || 0;
    g.tki += r.tki || 0;
    if (r.nib) g.nibs.add(r.nib);
    if (hasArsip(r)) g.arsip++;
  }
  return [...m.values()].map(({ nibs, ...g }) => ({ ...g, pelaku: nibs.size, value: g[metric] }));
}

export interface MonthPoint { key: string; value: number; label: string; short: string; year: number; month: number }

export function monthSeries(rows: Proyek[], metric: Metric): MonthPoint[] {
  const agg = new Map<string, { proyek: number; investasi: number; tki: number }>();
  for (const r of rows) {
    if (!isISO(r.tgl_pengajuan)) continue;
    const k = r.tgl_pengajuan.slice(0, 7);
    const a = agg.get(k) || { proyek: 0, investasi: 0, tki: 0 };
    a.proyek++; a.investasi += r.investasi || 0; a.tki += r.tki || 0;
    agg.set(k, a);
  }
  const keys = [...agg.keys()].sort();
  if (!keys.length) return [];
  let [y, m] = keys[0].split("-").map(Number);
  const [y1, m1] = keys[keys.length - 1].split("-").map(Number);
  const out: MonthPoint[] = [];
  let guard = 0;
  while ((y < y1 || (y === y1 && m <= m1)) && guard++ < 240) {
    const k = `${y}-${pad2(m)}`;
    const a = agg.get(k) || { proyek: 0, investasi: 0, tki: 0 };
    out.push({ key: k, value: a[metric], label: `${BULAN[m - 1]} ${y}`, short: BULAN_S[m - 1], year: y, month: m - 1 });
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}
