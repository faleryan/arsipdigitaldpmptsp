// Master data: KBLI (OSS) & Jenis Izin (SiCantik)
import { kategoriIzin, izinShort, type Izin } from "./sicantik";

export interface Kbli {
  versi: string;
  kode: string;
  tingkat: string;
  judul: string;
  kategori: string;
  aktif: boolean;
  uraian?: string;
  updated_at?: string;
}
export const TINGKAT = ["Kategori", "Golongan Pokok", "Golongan", "Subgolongan", "Kelompok"];
const TINGKAT_LEN: Record<string, number> = { "Golongan Pokok": 2, Golongan: 3, Subgolongan: 4, Kelompok: 5 };
export const kbliKey = (k: Pick<Kbli, "versi" | "kode">) => `${k.versi}|${k.kode}`;

/** Kode KBLI dari Excel: angka dikembalikan ke teks berpanjang sesuai tingkatnya (mis. 1 → "01") */
export function normKode(kode: unknown, tingkat: string): string {
  let s = kode == null ? "" : String(kode).trim().replace(/\.0$/, "");
  const len = TINGKAT_LEN[tingkat];
  if (len && /^\d+$/.test(s) && s.length < len) s = s.padStart(len, "0");
  return /^[a-z]$/i.test(s) ? s.toUpperCase() : s;
}
/** Tingkat ditebak dari bentuk kode bila kolom tingkat kosong */
export function tingkatOf(kode: string): string {
  if (/^[A-Z]$/i.test(kode)) return "Kategori";
  return ({ 2: "Golongan Pokok", 3: "Golongan", 4: "Subgolongan", 5: "Kelompok" } as Record<number, string>)[kode.length] || "";
}

/** "PERDAGANGAN ECERAN BUAH-BUAHAN" → "Perdagangan Eceran Buah-buahan" (gaya penulisan OSS) */
export function titleCase(s: string): string {
  return (s || "").toLowerCase().replace(/(^|[\s(/])([a-z])/g, (_m, a, b) => a + b.toUpperCase());
}

/** Indeks master KBLI untuk pencarian cepat */
export class KbliIndex {
  byKode = new Map<string, Kbli>(); // versi terbaru per kode
  kategoriByPrefix = new Map<string, string>(); // 2 digit golongan pokok → huruf kategori
  kategoriJudul = new Map<string, string>();
  versi: string[] = [];
  constructor(rows: Kbli[]) {
    const vs = new Set<string>();
    const sorted = [...rows].sort((a, b) => a.versi.localeCompare(b.versi)); // versi terbaru menimpa
    for (const r of sorted) {
      vs.add(r.versi);
      this.byKode.set(r.kode, r);
      if (r.tingkat === "Golongan Pokok" && r.kategori) this.kategoriByPrefix.set(r.kode, r.kategori);
      if (r.tingkat === "Kategori") this.kategoriJudul.set(r.kode, r.judul);
    }
    this.versi = [...vs].sort().reverse();
  }
  get(kode: string) { return this.byKode.get((kode || "").trim()); }
  /** Huruf kategori untuk kode apa pun (juga kode KBLI lama) berdasarkan 2 digit awal */
  kategoriOf(kode: string): string {
    const k = (kode || "").trim();
    return this.get(k)?.kategori || this.kategoriByPrefix.get(k.slice(0, 2)) || "";
  }
  kategoriLabel(huruf: string) {
    const j = this.kategoriJudul.get(huruf);
    return j ? `${huruf} · ${titleCase(j)}` : huruf || "(Tidak diketahui)";
  }
  /** Rantai induk: Kategori → Golongan Pokok → Golongan → Subgolongan → Kelompok */
  lineage(k: Kbli): Kbli[] {
    const chain: Kbli[] = [];
    const cat = this.byKode.get(k.kategori);
    if (cat && k.tingkat !== "Kategori") chain.push(cat);
    for (let n = 2; n < k.kode.length; n++) { const p = this.byKode.get(k.kode.slice(0, n)); if (p) chain.push(p); }
    return chain;
  }
}

/* ---------------- Jenis izin ---------------- */
export interface JenisIzin {
  nama: string;
  singkatan: string;
  kategori: string;
  persyaratan: string;
  lama_layanan: number | null;
  masa_berlaku: string;
  keterangan: string;
  aktif: boolean;
  updated_at?: string;
}
export const KATEGORI_IZIN = ["Izin Praktik Tenaga Kesehatan", "Tata Ruang (KKPR/PKKPR)", "Pendidikan (PAUD)", "Pemanfaatan Kekayaan Daerah", "Penelitian", "Kesejahteraan Sosial", "Lainnya"];

/** Jenis izin baru dengan singkatan & kategori ditebak dari namanya */
export function newJenisIzin(nama: string): JenisIzin {
  const m = nama.match(/\(([A-Z][A-Za-z]*(?:-[A-Za-z]+)*)\)/);
  return { nama, singkatan: m ? m[1] : "", kategori: kategoriIzin(nama), persyaratan: "", lama_layanan: null, masa_berlaku: "", keterangan: "", aktif: true };
}
export const persyaratanList = (j?: JenisIzin) => (j?.persyaratan || "").split(/\r?\n/).map((s) => s.replace(/^[-•*\d.)\s]+/, "").trim()).filter(Boolean);
/** Kategori izin: dari master bila ada, selain itu ditebak dari nama */
export const katIzin = (r: Pick<Izin, "izin"> & { kategori_izin?: string }) => r.kategori_izin || kategoriIzin(r.izin);
/** Label pendek jenis izin untuk grafik & tabel */
export const izinLabel = (nama: string, j?: JenisIzin) => {
  const s = izinShort(nama);
  return j?.singkatan && !s.includes(j.singkatan) ? `${s} (${j.singkatan})` : s;
};

/** Apakah suatu persyaratan sudah terpenuhi oleh salah satu dokumen (berdasarkan jenis/nama file)? */
export function syaratTerpenuhi(item: string, labels: string[]): boolean {
  const n = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const a = n(item);
  if (!a) return false;
  const first = a.split(" ").filter((w) => w.length > 2 && !["surat", "yang", "dan", "dari", "masih", "berlaku"].includes(w));
  return labels.some((l) => {
    const b = n(l);
    return !!b && (b.includes(a) || a.includes(b) || (first.length > 0 && first.every((w) => b.includes(w))));
  });
}
