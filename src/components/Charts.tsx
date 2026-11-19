import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Group, MonthPoint, Metric } from "../lib/stats";
import { fmtCompact, fmtInt, fmtPct, fmtRp, fmtRpShort } from "../lib/format";

export const METRICS: Record<Metric, { label: string; fmt: (n: number) => string; short: (n: number) => string; col: string }> = {
  proyek: { label: "Jumlah proyek", fmt: (n) => fmtInt(n) + " proyek", short: fmtInt, col: "Proyek" },
  investasi: { label: "Nilai investasi", fmt: fmtRp, short: fmtRpShort, col: "Investasi" },
  tki: { label: "Tenaga kerja", fmt: (n) => fmtInt(n) + " orang", short: fmtInt, col: "TKI" },
};

/** Tooltip tunggal untuk semua elemen ber-atribut data-tip ("Judul|isi") */
export function TooltipLayer() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const move = (e: MouseEvent) => {
      const t = (e.target as Element)?.closest?.("[data-tip]");
      if (!t) { el.style.display = "none"; return; }
      const [title, body] = (t.getAttribute("data-tip") || "").split("|");
      el.replaceChildren();
      const b = document.createElement("b"); b.textContent = title; el.appendChild(b);
      if (body) el.appendChild(document.createTextNode(body));
      el.style.display = "block";
      const w = el.offsetWidth, h = el.offsetHeight;
      el.style.left = Math.min(window.innerWidth - w - 8, e.clientX + 14) + "px";
      el.style.top = (e.clientY - h - 12 < 4 ? e.clientY + 16 : e.clientY - h - 12) + "px";
    };
    const hide = () => { el.style.display = "none"; };
    document.addEventListener("mousemove", move);
    document.addEventListener("scroll", hide, true);
    return () => { document.removeEventListener("mousemove", move); document.removeEventListener("scroll", hide, true); };
  }, []);
  return <div ref={ref} className="tip" role="tooltip" />;
}

export function Empty({ text = "Belum ada data" }: { text?: string }) {
  return <div className="empty">{text}</div>;
}

export function HBar({ items, metric, total, maxRows = 10 }: { items: Group[]; metric: Metric; total: number; maxRows?: number }) {
  if (!items.length) return <Empty />;
  const sorted = [...items].sort((a, b) => b.value - a.value);
  let rows: { key: string; value: number; other?: boolean }[] = sorted;
  if (sorted.length > maxRows) {
    const rest = sorted.slice(maxRows - 1);
    rows = [...sorted.slice(0, maxRows - 1), { key: `Lainnya (${rest.length})`, value: rest.reduce((s, x) => s + x.value, 0), other: true }];
  }
  const max = Math.max(1, ...rows.map((r) => r.value));
  const M = METRICS[metric];
  return (
    <div className="hb">
      {rows.map((r) => (
        <div className="hb-row" key={r.key} data-tip={`${r.key}|${M.fmt(r.value)} · ${fmtPct(total ? (r.value / total) * 100 : 0)}`}>
          <div className="hb-l" title={r.key}>{r.key}</div>
          <div className="hb-t"><div className={"hb-b" + (r.other ? " other" : "")} style={{ width: `${(r.value / max) * 100}%` }} /></div>
          <div className="hb-v">{M.short(r.value)}</div>
        </div>
      ))}
    </div>
  );
}

export function SegBar({ order, colors, groups, metric }: { order: string[]; colors: Record<string, [string, string]>; groups: Group[]; metric: Metric }) {
  const map = new Map(groups.map((g) => [g.key, g.value]));
  const parts = [
    ...order.map((k) => ({ key: k, value: map.get(k) || 0, c: colors[k] })),
    ...groups.filter((g) => !order.includes(g.key)).map((g) => ({ key: g.key, value: g.value, c: ["var(--muted)", "#fff"] as [string, string] })),
  ];
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return <Empty />;
  const M = METRICS[metric];
  return (
    <>
      <div className="segbar" role="img" aria-label={parts.map((p) => `${p.key} ${fmtPct((p.value / total) * 100)}`).join(", ")}>
        {parts.filter((p) => p.value > 0).map((p) => {
          const pct = (p.value / total) * 100;
          return (
            <div key={p.key} style={{ flex: `${p.value} 1 0`, background: p.c[0], color: p.c[1] }} data-tip={`${p.key}|${M.fmt(p.value)} · ${fmtPct(pct)}`}>
              {pct >= 8 ? Math.round(pct) + "%" : ""}
            </div>
          );
        })}
      </div>
      <div className="legend">
        {parts.map((p) => (
          <span key={p.key}><i style={{ background: p.c[0] }} />{p.key} <b>{M.short(p.value)}</b></span>
        ))}
      </div>
    </>
  );
}

function niceTicks(max: number, n = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  const top = Math.ceil(max / step) * step;
  const t: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) t.push(v);
  return t;
}

export function Columns({ series, metric }: { series: MonthPoint[]; metric: Metric }) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);
  useLayoutEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setW(Math.max(280, el.clientWidth)));
    ro.observe(el);
    setW(Math.max(280, el.clientWidth));
    return () => ro.disconnect();
  }, []);
  const M = METRICS[metric];
  if (!series.length) return <div ref={box}><Empty text="Belum ada data dengan tanggal pengajuan" /></div>;
  return <div ref={box}><ColumnsSvg series={series} metric={metric} W={W} /></div>;
}

function ColumnsSvg({ series, metric, W }: { series: MonthPoint[]; metric: Metric; W: number }) {
  const M = METRICS[metric];
  const H = 240, pl = 50, pr = 8, pt = 18, pb = 38;
  const max = Math.max(...series.map((s) => s.value), 0);
  const ticks = niceTicks(max), top = ticks[ticks.length - 1] || 1;
  const iw = W - pl - pr, ih = H - pt - pb, band = iw / series.length, bw = Math.min(24, Math.max(3, band * 0.6));
  const y = (v: number) => pt + ih - (v / top) * ih;
  const every = Math.ceil(series.length / Math.max(1, Math.floor(iw / 56)));
  const mi = series.reduce((b, d, i) => (d.value > series[b].value ? i : b), 0);
  return (
      <svg className="svgc" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Tren ${M.label} per bulan`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={pl - 8} y={y(t) + 4} textAnchor="end">{fmtCompact(t)}</text>
          </g>
        ))}
        <line x1={pl} x2={W - pr} y1={y(0)} y2={y(0)} stroke="var(--axis)" />
        {series.map((d, i) => {
          const cx = pl + band * i + band / 2, x = cx - bw / 2, yv = y(d.value), h = Math.max(0, y(0) - yv), r = Math.min(4, bw / 2, h);
          return (
            <g key={d.key}>
              {h > 0 && <path d={`M${x},${y(0)} V${yv + r} Q${x},${yv} ${x + r},${yv} H${x + bw - r} Q${x + bw},${yv} ${x + bw},${yv + r} V${y(0)} Z`} fill="var(--s1)" className="col" />}
              <rect x={pl + band * i} y={pt} width={band} height={ih} fill="transparent" data-tip={`${d.label}|${M.fmt(d.value)}`} />
              {i % every === 0 && <text x={cx} y={H - pb + 16} textAnchor="middle">{d.short}</text>}
              {i % every === 0 && (i === 0 || d.month === 0) && <text x={cx} y={H - pb + 30} textAnchor="middle">{d.year}</text>}
            </g>
          );
        })}
        {series[mi].value > 0 && (
          <text x={pl + band * mi + band / 2} y={y(series[mi].value) - 6} textAnchor="middle" className="peak">{M.short(series[mi].value)}</text>
        )}
      </svg>
  );
}
