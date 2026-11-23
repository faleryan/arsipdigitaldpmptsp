// Definisi isian formulir & validasi (OSS + SiCantik)
import type { FieldDef } from "../components/FormFields";
import { JENIS_PERUSAHAAN, JENIS_PROYEK, KEC_BELU, PRETTY, RISIKO, SKALA, type FieldKey, type Pelaku, type Proyek } from "./columns";
import { fmtInt, fmtNum, parseNum } from "./format";
import { JENIS_PERMOHONAN, SIC_PRETTY, type Izin, type Pemohon, type SicKey } from "./sicantik";

const F = (k: FieldKey, o: Partial<FieldDef> = {}): FieldDef => ({ k, label: PRETTY[k], ...o });
const S = (k: SicKey, o: Partial<FieldDef> = {}): FieldDef => ({ k, label: SIC_PRETTY[k], ...o });

/* ---------------- OSS ---------------- */
export const PELAKU_FIELDS: FieldDef[] = [
  F("nib", { req: true, hint: "13 digit angka", type: "digits" }),
  F("nama_perusahaan", { req: true, span: 2 }),
  F("jenis_perusahaan", { type: "list", opts: JENIS_PERUSAHAAN, span: 2 }),
  F("status_pm", { type: "select", opts: ["PMDN", "PMA"] }),
  F("tgl_terbit_oss", { type: "date" }),
  F("nik", { hint: "16 digit angka", type: "digits" }),
  F("nohp", { type: "tel" }),
  F("email", { type: "email" }),
  F("username"),
  F("alamat_perusahaan", { span: 3 }),
  F("kel_perusahaan"), F("kec_perusahaan"), F("kab_perusahaan"),
];
export const PROYEK_SECTIONS: { title: string; desc: string; fields: FieldDef[] }[] = [
  { title: "Data proyek", desc: "Identitas proyek sesuai OSS", fields: [
    F("id_proyek", { req: true, hint: "Contoh: R-202603100806158504562" }),
    F("jenis_proyek", { type: "list", opts: JENIS_PROYEK }),
    F("nama_proyek", { req: true }),
    F("tgl_pengajuan", { type: "date" }),
    F("risiko", { type: "select", opts: RISIKO }),
    F("skala_usaha", { type: "select", opts: SKALA }),
    F("no_kegiatan"),
  ] },
  { title: "Lokasi usaha", desc: "Lokasi kegiatan usaha", fields: [
    F("alamat_usaha", { span: 3 }),
    F("kab_usaha"),
    F("kec_usaha", { type: "list", opts: KEC_BELU }),
    F("kel_usaha", { type: "list", dyn: "kel_usaha" }),
    F("luas_tanah", { type: "num" }),
    F("satuan_tanah", { type: "list", opts: ["m2", "Ha"] }),
  ] },
  { title: "KBLI & investasi", desc: "Ketik kode atau kata kunci — pilih dari Master KBLI, judul terisi otomatis", fields: [
    F("kbli", { hint: "5 digit (tingkat Kelompok)" }),
    F("judul_kbli", { span: 2 }),
    F("sektor", { type: "list", dyn: "sektor", span: 2 }),
    F("investasi", { type: "money", hint: "Dalam rupiah" }),
    F("tki", { type: "num", hint: "Jumlah tenaga kerja Indonesia" }),
  ] },
];
export const PROYEK_DEFAULTS: Record<string, string> = { jenis_proyek: "Utama", kab_usaha: "Kab. Belu", satuan_tanah: "m2" };

/** Nilai record → teks isian formulir */
export function toFormValues(r: object | undefined, fields: FieldDef[], defaults: Record<string, string> = {}) {
  const o: Record<string, string> = {};
  for (const f of fields) {
    const v = r ? (r as Record<string, unknown>)[f.k] : undefined;
    if (v == null || v === "") o[f.k] = r ? "" : defaults[f.k] || "";
    else if (f.type === "money") o[f.k] = fmtInt(v as number);
    else if (f.type === "num") o[f.k] = fmtNum(v as number);
    else o[f.k] = String(v);
  }
  return o;
}

const t = (v: Record<string, string>, k: string) => (v[k] || "").trim();
export function validatePelaku(v: Record<string, string>) {
  const e: Record<string, string> = {};
  if (!t(v, "nib")) e.nib = "Wajib diisi"; else if (!/^\d{13}$/.test(t(v, "nib"))) e.nib = "NIB harus 13 digit angka";
  if (!t(v, "nama_perusahaan")) e.nama_perusahaan = "Wajib diisi";
  if (t(v, "nik") && !/^\d{16}$/.test(t(v, "nik"))) e.nik = "NIK harus 16 digit angka";
  if (t(v, "email") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t(v, "email"))) e.email = "Format email tidak valid";
  return e;
}
export function validateProyek(v: Record<string, string>) {
  const e: Record<string, string> = {};
  if (!t(v, "id_proyek")) e.id_proyek = "Wajib diisi";
  if (!t(v, "nama_proyek")) e.nama_proyek = "Wajib diisi";
  if (t(v, "kbli") && !/^\d{5}$/.test(t(v, "kbli"))) e.kbli = "KBLI 5 digit angka";
  for (const k of ["investasi", "tki", "luas_tanah"]) if (t(v, k) && parseNum(t(v, k)) == null) e[k] = "Isi dengan angka";
  return e;
}
export const pelakuPickItem = (p: Pelaku, nProyek = 0) => ({
  id: p.nib, title: p.nama_perusahaan || "(tanpa nama)",
  sub: `NIB ${p.nib}${p.jenis_perusahaan ? " · " + p.jenis_perusahaan.replace("Persekutuan Komanditer (CV / Commanditaire Vennootschap)", "CV") : ""}`,
  meta: `${nProyek} proyek terarsip${p.kec_perusahaan ? " · " + p.kec_perusahaan : ""}`,
  search: `${p.nib} ${p.nama_perusahaan} ${p.nik}`.toLowerCase(),
});

/* ---------------- SiCantik ---------------- */
export const PEMOHON_FIELDS: FieldDef[] = [
  { k: "no_ktp", label: "No. KTP", type: "digits", hint: "Angka saja; menjadi penanda pemohon" },
  { k: "nama", label: "Nama Pemohon", req: true, span: 2, hint: "Lengkap dengan gelar" },
  { k: "no_hp", label: "No. HP/Telp", type: "tel" },
  { k: "email", label: "Email", type: "email", span: 2 },
];
export const IZIN_SECTIONS: { title: string; desc: string; fields: FieldDef[] }[] = [
  { title: "Data izin", desc: "Jenis izin, permohonan, dan penetapan", fields: [
    S("izin", { type: "select", req: true, span: 2, hint: "Daftar dari Master Jenis Izin" }),
    S("jenis", { type: "select", opts: JENIS_PERMOHONAN, req: true }),
    S("tanggal", { type: "date", req: true }),
    S("no_permohonan", { hint: "Contoh: 1049/500.16.7.1.Resi/DPMPTSP/XI/2026" }),
    S("id_sicantik", { hint: "Kosongkan untuk dibuat otomatis" }),
    S("nomor_izin", { span: 2, hint: "Kosongkan bila izin belum ditetapkan" }),
    S("tgl_penetapan", { type: "date" }),
  ] },
  { title: "Lokasi", desc: "Tempat praktik / lokasi kegiatan", fields: [
    S("lokasi", { type: "list", dyn: "lokasi", span: 2 }),
    S("lokasi_izin", { type: "list", dyn: "lokasi", hint: "Kosongkan bila sama dengan lokasi" }),
  ] },
];
export function validatePemohon(v: Record<string, string>) {
  const e: Record<string, string> = {};
  if (!t(v, "nama")) e.nama = "Wajib diisi";
  if (t(v, "no_ktp") && !/^\d{4,20}$/.test(t(v, "no_ktp"))) e.no_ktp = "Isi dengan angka";
  if (t(v, "email") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t(v, "email"))) e.email = "Format email tidak valid";
  return e;
}
export function validateIzin(v: Record<string, string>) {
  const e: Record<string, string> = {};
  if (!t(v, "izin")) e.izin = "Wajib diisi";
  if (!t(v, "jenis")) e.jenis = "Wajib dipilih";
  if (!t(v, "tanggal")) e.tanggal = "Wajib diisi";
  if (t(v, "tgl_penetapan") && t(v, "tanggal") && t(v, "tgl_penetapan") < t(v, "tanggal")) e.tgl_penetapan = "Tidak boleh sebelum tanggal permohonan";
  return e;
}
export const pemohonPickItem = (p: Pemohon, nIzin = 0) => ({
  id: p.id_pemohon, title: p.nama || "(tanpa nama)",
  sub: p.no_ktp ? `KTP ${p.no_ktp}` : "Tanpa No. KTP",
  meta: `${nIzin} permohonan terarsip${p.no_hp ? " · " + p.no_hp : ""}`,
  search: `${p.no_ktp} ${p.nama} ${p.no_hp} ${p.email}`.toLowerCase(),
});

export type { Proyek, Izin };
