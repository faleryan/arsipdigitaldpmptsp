// Definisi data permohonan izin SiCantik (mengikuti Rekap_SIcantik.xlsx)
import type { Dokumen } from "./columns";
import { norm } from "./columns";
import { isISO, parseDate } from "./format";

export interface Izin {
  id_sicantik: string;
  izin: string;
  nomor_izin: string;
  jenis: string;
  tanggal: string | null;
  pemohon: string;
  lokasi: string;
  no_permohonan: string;
  no_ktp: string;
  no_hp: string;
  email: string;
  tgl_penetapan: string | null;
  lokasi_izin: string;
  keterangan: string;
  sumber?: string;
  file_import?: string | null;
  created_at?: string;
  updated_at?: string;
  sicantik_dokumen?: Dokumen[];
}
export type SicKey = "id_sicantik" | "izin" | "nomor_izin" | "jenis" | "tanggal" | "pemohon" | "lokasi" | "no_permohonan" | "no_ktp" | "no_hp" | "email" | "tgl_penetapan" | "lokasi_izin" | "keterangan";

/** Urutan & judul kolom asli file rekap SiCantik */
export const SIC_COLS: [SicKey, string][] = [
  ["izin", "Izin"],
  ["nomor_izin", "Nomor izin"],
  ["jenis", "Jenis"],
  ["tanggal", "Tanggal"],
  ["pemohon", "Pemohon"],
  ["lokasi", "Lokasi"],
  ["no_permohonan", "No Permohonan"],
  ["no_ktp", "No KTP"],
  ["no_hp", "No Hp/Telp"],
  ["email", "Email"],
  ["tgl_penetapan", "Tanggal Penetapan"],
  ["id_sicantik", "ID"],
  ["lokasi_izin", "Lokasi Izin"],
];
export const SIC_LABEL: Record<string, string> = Object.fromEntries(SIC_COLS);
export const SIC_PRETTY: Record<SicKey, string> = {
  id_sicantik: "ID SiCantik", izin: "Jenis Izin", nomor_izin: "Nomor Izin", jenis: "Jenis Permohonan", tanggal: "Tanggal Permohonan",
  pemohon: "Nama Pemohon", lokasi: "Lokasi", no_permohonan: "No. Permohonan", no_ktp: "No. KTP", no_hp: "No. HP/Telp", email: "Email",
  tgl_penetapan: "Tanggal Penetapan", lokasi_izin: "Lokasi Izin", keterangan: "Keterangan / tautan arsip",
};
export const SIC_HEADER_MAP: Record<string, SicKey> = {
  ...Object.fromEntries(SIC_COLS.map(([k, l]) => [norm(l), k])),
  namaizin: "izin", jenisizin: "izin", nomorizin: "nomor_izin", noizin: "nomor_izin", jenispermohonan: "jenis",
  tanggalpermohonan: "tanggal", tglpermohonan: "tanggal", namapemohon: "pemohon", nopermohonan: "no_permohonan",
  nomorpermohonan: "no_permohonan", noktp: "no_ktp", nik: "no_ktp", nohp: "no_hp", nohptelp: "no_hp", notelp: "no_hp",
  tglpenetapan: "tgl_penetapan", idsicantik: "id_sicantik", lokasiizin: "lokasi_izin", keterangan: "keterangan",
};
export const SIC_TEXT: SicKey[] = ["id_sicantik", "izin", "nomor_izin", "jenis", "pemohon", "lokasi", "no_permohonan", "no_ktp", "no_hp", "email", "lokasi_izin", "keterangan"];

export const JENIS_PERMOHONAN = ["Baru", "Perpanjangan", "Perubahan", "Pencabutan"];
export const JENIS_COLOR: Record<string, [string, string]> = {
  Baru: ["var(--c1)", "#fff"],
  Perpanjangan: ["var(--c2)", "#fff"],
  Perubahan: ["var(--c3)", "#fff"],
  Pencabutan: ["var(--c4)", "#0b0b0b"],
};
export const STATUS = ["Sudah ditetapkan", "Belum ditetapkan"];
export const STATUS_COLOR: Record<string, [string, string]> = {
  "Sudah ditetapkan": ["var(--good)", "#fff"],
  "Belum ditetapkan": ["var(--warning)", "#0b0b0b"],
};

/** Nilai kosong ala SiCantik ("-", "–") dianggap kosong */
const blank = (v: unknown) => {
  const s = v == null ? "" : String(v).trim();
  return /^[-–—]+$/.test(s) ? "" : s;
};

export function normalizeIzin(raw: Record<string, unknown>): Izin {
  const r: Record<string, unknown> = {};
  for (const k of SIC_TEXT) r[k] = blank(raw[k]);
  // No KTP dari ekspor sering diawali tanda kutip agar Excel tidak membulatkan
  r.no_ktp = String(r.no_ktp).replace(/^'+/, "").replace(/\.0$/, "");
  r.id_sicantik = String(r.id_sicantik).replace(/\.0$/, "");
  const hp = String(r.no_hp);
  if (/^\d+$/.test(hp) && !hp.startsWith("0") && !hp.startsWith("62")) r.no_hp = "0" + hp;
  // tanggal bisa berupa Date (dari Excel), angka serial, atau teks
  const dv = (v: unknown) => (typeof v === "string" ? blank(v) || null : v);
  r.tanggal = parseDate(dv(raw.tanggal));
  r.tgl_penetapan = parseDate(dv(raw.tgl_penetapan));
  return r as unknown as Izin;
}

export const isTerbit = (r: Izin) => !!r.nomor_izin || !!r.tgl_penetapan;
export const statusOf = (r: Izin) => (isTerbit(r) ? STATUS[0] : STATUS[1]);

/** Lama proses dalam hari (tanggal permohonan → penetapan) */
export function lamaProses(r: Izin): number | null {
  if (!isISO(r.tanggal) || !isISO(r.tgl_penetapan)) return null;
  const d = (Date.parse(r.tgl_penetapan) - Date.parse(r.tanggal)) / 864e5;
  return d >= 0 ? Math.round(d) : null;
}

/** Nama izin ringkas untuk grafik: "Surat Izin Praktik Perawat Vokasi (SIP-PV) Kab. Belu" → "Perawat Vokasi (SIP-PV)" */
export function izinShort(name: string): string {
  let s = (name || "").replace(/\s+Kab\.?\s*Belu\s*$/i, "").trim();
  s = s.replace(/\s*\(([^)]*\s[^)]*)\)/g, ""); // buang keterangan panjang dalam kurung
  s = s.replace(/^Surat Izin Praktik\s+/i, "");
  s = s.replace(/^Izin Penggunaan Kekayaan Daerah\s*/i, "Penggunaan Kekayaan Daerah ");
  return s.replace(/\s+/g, " ").trim() || name;
}

export function kategoriIzin(name: string): string {
  const s = name || "";
  if (/praktik/i.test(s)) return "Izin Praktik Tenaga Kesehatan";
  if (/kkpr|pemanfaatan ruang/i.test(s)) return "Tata Ruang (KKPR/PKKPR)";
  if (/paud|pendidikan/i.test(s)) return "Pendidikan (PAUD)";
  if (/kekayaan daerah|ipkd/i.test(s)) return "Pemanfaatan Kekayaan Daerah";
  if (/penelitian/i.test(s)) return "Penelitian";
  if (/sosial/i.test(s)) return "Kesejahteraan Sosial";
  return "Lainnya";
}

/** Kunci pengelompokan lokasi yang mengabaikan huruf besar/kecil & spasi */
export const lokasiKey = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export interface SicGroup { key: string; label: string; total: number; terbit: number; baru: number; perpanjangan: number; perubahan: number; pencabutan: number; lamaSum: number; lamaN: number; value: number }

export function groupIzin(rows: Izin[], keyFn: (r: Izin) => string, labelFn?: (r: Izin) => string): SicGroup[] {
  const m = new Map<string, SicGroup>();
  for (const r of rows) {
    const k = keyFn(r) || "(Tidak diisi)";
    let g = m.get(k);
    if (!g) { g = { key: k, label: labelFn ? labelFn(r) || "(Tidak diisi)" : k, total: 0, terbit: 0, baru: 0, perpanjangan: 0, perubahan: 0, pencabutan: 0, lamaSum: 0, lamaN: 0, value: 0 }; m.set(k, g); }
    g.total++;
    if (isTerbit(r)) g.terbit++;
    const j = (r.jenis || "").toLowerCase();
    if (j === "baru") g.baru++; else if (j === "perpanjangan") g.perpanjangan++; else if (j === "perubahan") g.perubahan++; else if (j === "pencabutan") g.pencabutan++;
    const l = lamaProses(r);
    if (l != null) { g.lamaSum += l; g.lamaN++; }
  }
  return [...m.values()].map((g) => ({ ...g, value: g.total }));
}
export const avgLama = (g: { lamaSum: number; lamaN: number }) => (g.lamaN ? g.lamaSum / g.lamaN : null);
