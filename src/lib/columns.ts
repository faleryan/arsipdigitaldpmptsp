// Definisi kolom mengikuti Format_Arsip_OSS.xlsx (urutan & judul asli dipertahankan untuk import/export)

export interface Dokumen {
  id: string;
  id_proyek: string;
  label: string;
  nama_file: string;
  path: string;
  ukuran: number | null;
  tipe: string | null;
  created_at: string;
}

export interface Proyek {
  id_proyek: string;
  jenis_proyek: string;
  nib: string;
  nik: string;
  nohp: string;
  email: string;
  username: string;
  nama_perusahaan: string;
  alamat_perusahaan: string;
  kel_perusahaan: string;
  kec_perusahaan: string;
  kab_perusahaan: string;
  tgl_terbit_oss: string | null;
  status_pm: string;
  jenis_perusahaan: string;
  risiko: string;
  no_kegiatan: string;
  nama_proyek: string;
  skala_usaha: string;
  alamat_usaha: string;
  kab_usaha: string;
  kec_usaha: string;
  kel_usaha: string;
  tgl_pengajuan: string | null;
  kbli: string;
  judul_kbli: string;
  sektor: string;
  luas_tanah: number | null;
  satuan_tanah: string;
  investasi: number | null;
  tki: number | null;
  arsip_dokumen: string;
  sumber?: string;
  file_import?: string | null;
  created_at?: string;
  updated_at?: string;
  oss_dokumen?: Dokumen[];
}

export type FieldKey = Exclude<keyof Proyek, "sumber" | "file_import" | "created_at" | "updated_at" | "oss_dokumen">;

export const COLS: [FieldKey | "no", string][] = [
  ["no", "No."],
  ["id_proyek", "Id Proyek"],
  ["jenis_proyek", "Uraian_Jenis_Proyek"],
  ["nib", "Nib"],
  ["nik", "nik"],
  ["nohp", "nohp"],
  ["email", "email"],
  ["username", "username"],
  ["nama_perusahaan", "Nama Perusahaan/Pelaku Usaha"],
  ["alamat_perusahaan", "Alamat Perusahaan/Pelaku Usaha"],
  ["kel_perusahaan", "kelurahan_perusahaan/Pelaku Usaha"],
  ["kec_perusahaan", "kecamatan_perusahaan/Pelaku Usaha"],
  ["kab_perusahaan", "kab_kota_perusahaan/Pelaku Usaha"],
  ["tgl_terbit_oss", "Tanggal Terbit Oss"],
  ["status_pm", "Uraian Status Penanaman Modal"],
  ["jenis_perusahaan", "Uraian Jenis Perusahaan"],
  ["risiko", "Uraian Risiko Proyek"],
  ["no_kegiatan", "No Kegiatan Usaha"],
  ["nama_proyek", "nama_proyek"],
  ["skala_usaha", "Uraian Skala Usaha"],
  ["alamat_usaha", "Alamat Usaha"],
  ["kab_usaha", "Kab Kota Usaha"],
  ["kec_usaha", "kecamatan_usaha"],
  ["kel_usaha", "kelurahan_usaha"],
  ["tgl_pengajuan", "Day of Tanggal Pengajuan Proyek"],
  ["kbli", "Kbli"],
  ["judul_kbli", "Judul Kbli"],
  ["sektor", "KL/Sektor Pembina"],
  ["luas_tanah", "luas_tanah"],
  ["satuan_tanah", "satuan_tanah"],
  ["investasi", "Jumlah Investasi"],
  ["tki", "TKI"],
  ["arsip_dokumen", "Arsip Dokumen"],
];

export const FIELD_KEYS = COLS.map((c) => c[0]).filter((k) => k !== "no") as FieldKey[];
export const TEXT_KEYS = FIELD_KEYS.filter(
  (k) => !["tgl_terbit_oss", "tgl_pengajuan", "luas_tanah", "investasi", "tki"].includes(k),
);
export const LABEL: Record<string, string> = Object.fromEntries(COLS);

export const PRETTY: Record<FieldKey, string> = {
  id_proyek: "Id Proyek", jenis_proyek: "Uraian Jenis Proyek", nib: "NIB", nik: "NIK", nohp: "No. HP", email: "Email",
  username: "Username", nama_perusahaan: "Nama Perusahaan / Pelaku Usaha", alamat_perusahaan: "Alamat Perusahaan",
  kel_perusahaan: "Kelurahan Perusahaan", kec_perusahaan: "Kecamatan Perusahaan", kab_perusahaan: "Kab/Kota Perusahaan",
  tgl_terbit_oss: "Tanggal Terbit OSS", status_pm: "Status Penanaman Modal", jenis_perusahaan: "Jenis Perusahaan",
  risiko: "Risiko Proyek", no_kegiatan: "No. Kegiatan Usaha", nama_proyek: "Nama Proyek", skala_usaha: "Skala Usaha",
  alamat_usaha: "Alamat Usaha", kab_usaha: "Kab/Kota Usaha", kec_usaha: "Kecamatan Usaha", kel_usaha: "Kelurahan Usaha",
  tgl_pengajuan: "Tanggal Pengajuan Proyek", kbli: "KBLI", judul_kbli: "Judul KBLI", sektor: "KL / Sektor Pembina",
  luas_tanah: "Luas Tanah", satuan_tanah: "Satuan Tanah", investasi: "Jumlah Investasi", tki: "Tenaga Kerja (TKI)",
  arsip_dokumen: "Arsip Dokumen (tautan/keterangan)",
};

export const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export const HEADER_MAP: Record<string, FieldKey | "no"> = {
  ...Object.fromEntries(COLS.map(([k, l]) => [norm(l), k])),
  no: "no", nomor: "no", idproyek: "id_proyek", jenisproyek: "jenis_proyek", uraianjenisproyek: "jenis_proyek",
  namaperusahaan: "nama_perusahaan", namapelakuusaha: "nama_perusahaan", alamatperusahaan: "alamat_perusahaan",
  kelurahanperusahaan: "kel_perusahaan", kecamatanperusahaan: "kec_perusahaan", kabkotaperusahaan: "kab_perusahaan",
  tanggalterbitoss: "tgl_terbit_oss", statuspenanamanmodal: "status_pm", jenisperusahaan: "jenis_perusahaan",
  risikoproyek: "risiko", uraianrisiko: "risiko", skalausaha: "skala_usaha", namaproyek: "nama_proyek",
  kabkotausaha: "kab_usaha", tanggalpengajuanproyek: "tgl_pengajuan", tanggalpengajuan: "tgl_pengajuan",
  klsektorpembina: "sektor", sektorpembina: "sektor", luastanah: "luas_tanah", satuantanah: "satuan_tanah",
  jumlahinvestasi: "investasi", investasi: "investasi", tenagakerja: "tki", arsipdokumen: "arsip_dokumen", nomorhp: "nohp",
};

/** Teks placeholder yang muncul di unduhan OSS pada kolom data perusahaan */
export const PLACEHOLDERS: Partial<Record<FieldKey, string>> = {
  alamat_perusahaan: "alamatperusahaan", kel_perusahaan: "kelurahan", kec_perusahaan: "kecamatan", kab_perusahaan: "kabkota",
};

export const KEC_BELU = [
  "Atambua Barat", "Atambua Selatan", "Kota Atambua", "Kakuluk Mesak", "Lamaknen", "Lamaknen Selatan",
  "Lasiolat", "Nanaet Duabesi", "Raihat", "Raimanuk", "Tasifeto Barat", "Tasifeto Timur",
];
export const KEC_CANON: Record<string, string> = Object.fromEntries(KEC_BELU.map((k) => [norm(k), k]));

export const RISIKO = ["Rendah", "Menengah Rendah", "Menengah Tinggi", "Tinggi"];
export const RISIKO_COLOR: Record<string, [string, string]> = {
  Rendah: ["var(--good)", "#fff"],
  "Menengah Rendah": ["var(--warning)", "#0b0b0b"],
  "Menengah Tinggi": ["var(--serious)", "#0b0b0b"],
  Tinggi: ["var(--critical)", "#fff"],
};
export const SKALA = ["Usaha Mikro", "Usaha Kecil", "Usaha Menengah", "Usaha Besar"];
export const SKALA_COLOR: Record<string, [string, string]> = {
  "Usaha Mikro": ["var(--r1)", "var(--r1-ink)"],
  "Usaha Kecil": ["var(--r2)", "var(--r2-ink)"],
  "Usaha Menengah": ["var(--r3)", "var(--r3-ink)"],
  "Usaha Besar": ["var(--r4)", "var(--r4-ink)"],
};
export const JENIS_PERUSAHAAN = [
  "Perorangan", "Persekutuan Komanditer (CV / Commanditaire Vennootschap)", "Perseroan Terbatas (PT)",
  "Perseroan Terbatas (PT) Perorangan", "Koperasi", "Yayasan", "Persekutuan Firma", "Persekutuan Perdata",
  "Badan Usaha Milik Desa (BUMDes)", "Perusahaan Umum Daerah (Perumda)", "Badan Hukum Lainnya",
];
export const JENIS_PROYEK = ["Utama", "Satu Lini Produksi", "Pendukung", "Pendukung UMKU"];

export const NAMA_INSTANSI: string = import.meta.env.VITE_NAMA_INSTANSI || "DPMPTSP Kabupaten Belu";
