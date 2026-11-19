import { KEC_CANON, norm, PLACEHOLDERS, TEXT_KEYS, type Proyek } from "./columns";

export const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const BULAN_S = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const MONTH_IDX: Record<string, number> = {};
BULAN.forEach((b, i) => { MONTH_IDX[b.toLowerCase()] = i; MONTH_IDX[b.slice(0, 3).toLowerCase()] = i; });
["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
  .forEach((b, i) => { MONTH_IDX[b] = i; MONTH_IDX[b.slice(0, 3)] = i; });
Object.assign(MONTH_IDX, { agu: 7, agt: 7, okt: 9, des: 11, sept: 8, peb: 1, pebruari: 1, nop: 10, nopember: 10 });

export const pad2 = (n: number) => String(n).padStart(2, "0");
export const isISO = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

function isoFrom(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  const dt = new Date(Date.UTC(y, m, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m || dt.getUTCDate() !== d) return null;
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

/** Mengubah berbagai bentuk tanggal (Date Excel, serial, 01/07/2020, 24 April 2026) menjadi ISO yyyy-mm-dd. null bila kosong/tidak terbaca. */
export function parseDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(+v)) {
    const t = new Date(v.getTime() + 12 * 3600e3);
    return isoFrom(t.getFullYear(), t.getMonth(), t.getDate());
  }
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const t = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5);
    return isoFrom(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  }
  const s = String(v).trim().replace(/\s+/g, " ");
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return isoFrom(+m[1], +m[2] - 1, +m[3]);
  if ((m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/))) return isoFrom(+m[3], +m[2] - 1, +m[1]);
  if ((m = s.match(/^(?:[A-Za-z]+,\s*)?(\d{1,2})[\s-]+([A-Za-z]+)\.?[\s-]+(\d{4})$/))) {
    const mi = MONTH_IDX[m[2].toLowerCase()];
    if (mi != null) return isoFrom(+m[3], mi, +m[1]);
  }
  return null;
}

/** Angka format Indonesia: "14.177" → 14177, "885,58" → 885.58, "Rp 1.500.000" → 1500000 */
export function parseNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/^rp\.?/i, "").replace(/\s/g, "");
  if (!s) return null;
  const hasDot = s.includes("."), hasCom = s.includes(",");
  if (hasDot && hasCom) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (hasCom) s = /^-?\d{1,3}(,\d{3}){2,}$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  else if (hasDot && /^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return isFinite(n) ? n : null;
}

export const fmtInt = (n: number | null | undefined) => (n ?? 0).toLocaleString("id-ID");
export const fmtNum = (n: number | null | undefined) => (n == null ? "" : n.toLocaleString("id-ID", { maximumFractionDigits: 2 }));
export const fmtRp = (n: number | null | undefined) => (n == null ? "—" : "Rp " + Math.round(n).toLocaleString("id-ID"));
export const fmtPct = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "%";

export function fmtRpShort(n: number | null | undefined) {
  const v = n || 0, a = Math.abs(v);
  const f = (x: number, u: string) => "Rp " + x.toLocaleString("id-ID", { maximumFractionDigits: x < 10 ? 2 : 1 }) + " " + u;
  if (a >= 1e12) return f(v / 1e12, "T");
  if (a >= 1e9) return f(v / 1e9, "M");
  if (a >= 1e6) return f(v / 1e6, "jt");
  if (a >= 1e3) return f(v / 1e3, "rb");
  return "Rp " + fmtInt(v);
}
export function fmtCompact(n: number) {
  const a = Math.abs(n), o = { maximumFractionDigits: 1 };
  if (a >= 1e12) return (n / 1e12).toLocaleString("id-ID", o) + " T";
  if (a >= 1e9) return (n / 1e9).toLocaleString("id-ID", o) + " M";
  if (a >= 1e6) return (n / 1e6).toLocaleString("id-ID", o) + " jt";
  if (a >= 1e4) return (n / 1e3).toLocaleString("id-ID", { maximumFractionDigits: 0 }) + " rb";
  return fmtInt(n);
}
export function fmtDateLong(iso: string | null | undefined) {
  if (!isISO(iso)) return iso || "";
  const [y, m, d] = iso.split("-");
  return `${+d} ${BULAN[+m - 1]} ${y}`;
}
export function fmtDateSlash(iso: string | null | undefined) {
  if (!isISO(iso)) return iso || "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
export const kecLabel = (v: string | null | undefined) => (!v ? "" : KEC_CANON[norm(v)] || String(v).trim());
export const yearOf = (r: Proyek) => (isISO(r.tgl_pengajuan) ? r.tgl_pengajuan.slice(0, 4) : "");
export const maskNik = (n: string) => (n.length > 8 ? n.slice(0, 4) + "•".repeat(n.length - 8) + n.slice(-4) : n);
export const hasArsip = (r: Proyek) => (r.oss_dokumen?.length ?? 0) > 0 || !!r.arsip_dokumen;
export const fmtSize = (b: number | null | undefined) =>
  b == null ? "" : b > 1048576 ? (b / 1048576).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " MB" : Math.ceil(b / 1024) + " KB";

/** Membersihkan satu record mentah (dari Excel atau formulir) menjadi bentuk kolom database */
export function normalizeRecord(raw: Record<string, unknown>, opts: { cleanPlaceholders?: boolean } = {}): Proyek {
  const r: Record<string, unknown> = {};
  for (const k of TEXT_KEYS) {
    const v = raw[k];
    r[k] = v == null ? "" : String(v).trim();
  }
  const s = (k: string) => r[k] as string;
  if (/^\d+$/.test(s("nib")) && s("nib").length < 13) r.nib = s("nib").padStart(13, "0");
  if (/^\d+$/.test(s("nik")) && s("nik").length < 16 && s("nik").length > 10) r.nik = s("nik").padStart(16, "0");
  if (/^\d+$/.test(s("nohp")) && !s("nohp").startsWith("0") && !s("nohp").startsWith("62")) r.nohp = "0" + s("nohp");
  if (opts.cleanPlaceholders)
    for (const [k, p] of Object.entries(PLACEHOLDERS)) if (norm(r[k]) === p) r[k] = "";
  r.tgl_terbit_oss = parseDate(raw.tgl_terbit_oss);
  r.tgl_pengajuan = parseDate(raw.tgl_pengajuan);
  r.luas_tanah = parseNum(raw.luas_tanah);
  r.investasi = parseNum(raw.investasi);
  const tki = parseNum(raw.tki);
  r.tki = tki == null ? null : Math.round(tki);
  return r as unknown as Proyek;
}
