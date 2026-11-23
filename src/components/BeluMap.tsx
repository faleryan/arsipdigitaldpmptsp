import { useLayoutEffect, useMemo, useRef, useState } from "react";
import geo from "../assets/belu-kecamatan.json";

/* Peta koroplet 12 kecamatan Kabupaten Belu.
   Batas wilayah: Kemendagri (2020), disederhanakan. */

type Ring = [number, number][];
interface Feature { properties: { kode: string; nama: string; label: [number, number] }; geometry: { type: string; coordinates: unknown } }
const FEATURES = (geo as unknown as { features: Feature[] }).features;
const KECIL = ["Kota Atambua", "Atambua Barat", "Atambua Selatan"]; // terlalu kecil → ditampilkan di inset

// ---- proyeksi sederhana (equirectangular dengan koreksi lintang) ----
const W = 700, H = 700, PAD = 10;
const allPts: [number, number][] = [];
const ringsOf = (f: Feature): Ring[] => {
  const g = f.geometry;
  if (g.type === "Polygon") return g.coordinates as Ring[];
  return (g.coordinates as Ring[][]).flat();
};
FEATURES.forEach((f) => ringsOf(f).forEach((r) => allPts.push(...r)));
const minX = Math.min(...allPts.map((p) => p[0])), maxX = Math.max(...allPts.map((p) => p[0]));
const minY = Math.min(...allPts.map((p) => p[1])), maxY = Math.max(...allPts.map((p) => p[1]));
const K = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
const S = Math.min((W - PAD * 2) / ((maxX - minX) * K), (H - PAD * 2) / (maxY - minY));
const OX = (W - (maxX - minX) * K * S) / 2;
const proj = (x: number, y: number): [number, number] => [OX + (x - minX) * K * S, PAD + (maxY - y) * S];
const pathOf = (f: Feature, t: (p: [number, number]) => [number, number] = (p) => p) =>
  ringsOf(f).map((r) => "M" + r.map(([x, y]) => t(proj(x, y)).map((v) => v.toFixed(1)).join(",")).join("L") + "Z").join("");

// ---- inset untuk wilayah Kota Atambua ----
const kecilPts = FEATURES.filter((f) => KECIL.includes(f.properties.nama)).flatMap((f) => ringsOf(f).flat().map(([x, y]) => proj(x, y)));
const bx0 = Math.min(...kecilPts.map((p) => p[0])) - 6, bx1 = Math.max(...kecilPts.map((p) => p[0])) + 6;
const by0 = Math.min(...kecilPts.map((p) => p[1])) - 6, by1 = Math.max(...kecilPts.map((p) => p[1])) + 6;
const INSET = { x: 440, y: 470, w: 250, h: 215 };
const IS = Math.min(INSET.w / (bx1 - bx0), (INSET.h - 22) / (by1 - by0));
const iox = INSET.x + (INSET.w - (bx1 - bx0) * IS) / 2, ioy = INSET.y + 22 + (INSET.h - 22 - (by1 - by0) * IS) / 2;
const toInset = ([x, y]: [number, number]): [number, number] => [iox + (x - bx0) * IS, ioy + (y - by0) * IS];

const PATHS = FEATURES.map((f) => ({ nama: f.properties.nama, d: pathOf(f), di: pathOf(f, toInset), lp: proj(...f.properties.label), lpi: toInset(proj(...f.properties.label)) }));

/** Kelas warna: 0 = tanpa data, 1–5 = rendah → tinggi (interval sama) */
function classes(max: number) {
  // langkah dibulatkan ke 2 angka penting agar nilai tertinggi jatuh di kelas teratas
  const raw = max / 5;
  const p = raw >= 100 ? Math.pow(10, Math.floor(Math.log10(raw)) - 1) : 1;
  const step = Math.max(1, Math.ceil(raw / p) * p);
  const bounds = [1, 2, 3, 4, 5].map((i) => step * i);
  return { bounds, cls: (v: number) => (v <= 0 ? 0 : Math.min(5, Math.ceil(v / step))) };
}

export function BeluMap({ values, fmt, short, selected, onSelect, unit }: {
  values: Map<string, number>; fmt: (n: number) => string; short: (n: number) => string;
  selected: string; onSelect: (nama: string) => void; unit: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(700);
  const [hover, setHover] = useState<string | null>(null);
  useLayoutEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const max = Math.max(0, ...FEATURES.map((f) => values.get(f.properties.nama) || 0));
  const { bounds, cls } = useMemo(() => classes(max), [max]);
  const total = [...values.values()].reduce((a, b) => a + b, 0);
  const narrow = w < 520; // layar kecil: tampilkan angka saja agar terbaca
  const fs = narrow ? 22 : 12; // ukuran huruf dalam satuan viewBox

  const tip = (nama: string) => { const v = values.get(nama) || 0; return `Kec. ${nama}|${fmt(v)}${total ? ` · ${((v / total) * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%` : ""}`; };
  const shape = (p: (typeof PATHS)[number], inset: boolean) => {
    const v = values.get(p.nama) || 0;
    const c = cls(v);
    const on = selected === p.nama, hv = hover === p.nama;
    return (
      <path key={p.nama + (inset ? "-i" : "")} d={inset ? p.di : p.d} className={`kec m${c}${on ? " on" : ""}${hv ? " hv" : ""}`}
        data-tip={tip(p.nama)} role="button" tabIndex={0} aria-label={`Kecamatan ${p.nama}: ${fmt(v)}`}
        onMouseEnter={() => setHover(p.nama)} onMouseLeave={() => setHover(null)}
        onClick={() => onSelect(p.nama)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(p.nama))} />
    );
  };
  const label = (p: (typeof PATHS)[number], inset: boolean) => {
    const v = values.get(p.nama) || 0;
    const [x, y] = inset ? p.lpi : p.lp;
    const ink = cls(v) >= 3 ? "ink-light" : "ink-dark";
    const name = p.nama.replace("Atambua ", "Atb. ");
    return (
      <g key={p.nama + (inset ? "-li" : "-l")} className={"kec-label " + ink} pointerEvents="none">
        {!narrow && <text x={x} y={y - 3} textAnchor="middle" className="nm" fontSize={inset ? 10.5 : 11}>{inset ? name : p.nama}</text>}
        <text x={x} y={narrow ? y + fs / 3 : y + 12} textAnchor="middle" className="vl" fontSize={narrow ? (inset ? 18 : fs) : inset ? 12 : 12.5}>{short(v)}</text>
      </g>
    );
  };

  return (
    <div className="belu-map" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Peta sebaran ${unit} per kecamatan di Kabupaten Belu`}>
        <defs><clipPath id="insetClip"><rect x={INSET.x} y={INSET.y + 22} width={INSET.w} height={INSET.h - 22} rx="6" /></clipPath></defs>
        {/* konteks wilayah */}
        <text x={W / 2} y={18} textAnchor="middle" className="ctx">Selat Ombai</text>
        <text x={W - 8} y={420} textAnchor="end" className="ctx">TIMOR-LESTE →</text>
        <text x={8} y={H - 70} className="ctx">← Kab. TTU</text>
        <text x={W / 2 - 40} y={H - 4} textAnchor="middle" className="ctx">↓ Kab. Malaka</text>
        {PATHS.map((p) => shape(p, false))}
        {PATHS.filter((p) => !KECIL.includes(p.nama)).map((p) => label(p, false))}
        {/* penanda & inset Kota Atambua */}
        <rect x={bx0} y={by0} width={bx1 - bx0} height={by1 - by0} className="inset-mark" />
        <line x1={bx1} y1={by1} x2={INSET.x} y2={INSET.y + 22} className="inset-line" />
        <rect x={INSET.x} y={INSET.y} width={INSET.w} height={INSET.h} rx="8" className="inset-bg" />
        <text x={INSET.x + 10} y={INSET.y + 15} className="inset-title">Wilayah Kota Atambua (diperbesar)</text>
        <g clipPath="url(#insetClip)">{PATHS.map((p) => shape(p, true))}</g>
        {PATHS.filter((p) => KECIL.includes(p.nama)).map((p) => label(p, true))}
      </svg>
      <div className="map-legend">
        <span className="lg-t">{unit}</span>
        <span><i className="m0" />0</span>
        {bounds.map((b, i) => <span key={b}><i className={"m" + (i + 1)} />{i === 0 ? `≤ ${short(b)}` : `${short(bounds[i - 1])}–${short(b)}`}</span>)}
      </div>
    </div>
  );
}

export const KECAMATAN_PETA = FEATURES.map((f) => f.properties.nama);
