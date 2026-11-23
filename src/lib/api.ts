// Lapisan akses data — semua komunikasi dengan Supabase ada di file ini.
import { createClient, type Session } from "@supabase/supabase-js";
import { PELAKU_KEYS, PROYEK_KEYS, pick, type Dokumen, type Pelaku, type Proyek } from "./columns";
import { IZIN_KEYS, type Izin, type Pemohon } from "./sicantik";
import type { JenisIzin, Kbli } from "./master";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configured = !!(url && key);
export const supabase = configured ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

export type Role = "admin" | "operator" | "viewer" | "pending";
export interface Profile { id: string; email: string | null; nama: string | null; role: Role; created_at?: string }

const BUCKET = "arsip-dokumen";
const sb = () => {
  if (!supabase) throw new Error("Supabase belum dikonfigurasi");
  return supabase;
};

/** Ubah error Supabase menjadi pesan berbahasa Indonesia */
export function errMsg(e: unknown): string {
  const err = e as { message?: string; code?: string; status?: number } | null;
  const m = err?.message || String(e);
  if (err?.code === "23505") return "Data dengan kunci (Nomor Permohonan / NIB / ID) tersebut sudah ada.";
  if (err?.code === "23503") return "Data masih terhubung dengan data lain (mis. pelaku usaha masih punya proyek, atau jenis izin masih dipakai permohonan), atau data induknya belum ada.";
  if (err?.code === "42501" || /row-level security|permission denied/i.test(m)) return "Anda tidak memiliki izin untuk tindakan ini. Hubungi admin.";
  if (/Invalid login credentials/i.test(m)) return "Email atau kata sandi salah.";
  if (/Email not confirmed/i.test(m)) return "Email belum dikonfirmasi. Hubungi admin.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Tidak dapat terhubung ke server. Periksa koneksi internet.";
  if (/exceeded the maximum allowed size|Payload too large/i.test(m)) return "Ukuran file melebihi batas 20 MB.";
  if (/mime type/i.test(m)) return "Jenis file tidak diizinkan. Gunakan PDF, JPG, PNG, atau WEBP.";
  return m;
}

/* ---------------- Auth ---------------- */
export async function getSession(): Promise<Session | null> {
  const { data } = await sb().auth.getSession();
  return data.session;
}
export function onAuthChange(cb: (s: Session | null) => void) {
  const { data } = sb().auth.onAuthStateChange((_e, s) => cb(s));
  return () => data.subscription.unsubscribe();
}
export async function signIn(email: string, password: string) {
  const { error } = await sb().auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signOut() {
  await sb().auth.signOut();
}
export async function updatePassword(password: string) {
  const { error } = await sb().auth.updateUser({ password });
  if (error) throw error;
}
export async function getProfile(uid: string): Promise<Profile | null> {
  const { data, error } = await sb().from("profiles").select("*").eq("id", uid).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}
export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await sb().from("profiles").select("*").order("created_at");
  if (error) throw error;
  return (data || []) as Profile[];
}
export async function updateProfile(id: string, patch: Partial<Pick<Profile, "role" | "nama">>) {
  const { error } = await sb().from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

/* ---------------- Utilitas ---------------- */
async function fetchPaged<T>(table: string, select: string, order: string): Promise<T[]> {
  const out: T[] = [];
  const size = 1000; // batas bawaan Supabase per permintaan
  for (let from = 0; ; from += size) {
    const { data, error } = await sb().from(table).select(select).order(order).range(from, from + size - 1);
    if (error) throw error;
    out.push(...((data || []) as T[]));
    if (!data || data.length < size) break;
  }
  return out;
}
/** Berlangganan perubahan data (realtime). Mengembalikan fungsi untuk berhenti. */
export function subscribe(name: string, tables: string[], onChange: () => void) {
  let ch = sb().channel(name);
  for (const table of tables) ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, onChange);
  ch.subscribe();
  return () => { sb().removeChannel(ch); };
}
async function upsertChunks(table: string, rows: Record<string, unknown>[], onConflict: string, ignoreDuplicates: boolean, onStep?: (n: number) => void) {
  const size = 300;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { error } = await sb().from(table).upsert(chunk, { onConflict, ignoreDuplicates });
    if (error) throw error;
    onStep?.(chunk.length);
  }
}

/* ---------------- Pelaku usaha (OSS) ---------------- */
export const fetchPelaku = () => fetchPaged<Pelaku>("pelaku_usaha", "*, pelaku_dokumen(*)", "nib");
export async function insertPelaku(p: Pelaku) {
  const { error } = await sb().from("pelaku_usaha").insert(pick(p, PELAKU_KEYS));
  if (error) throw error;
}
/** Ubah data pelaku; NIB baru otomatis ikut berubah di semua proyeknya */
export async function updatePelaku(nib: string, p: Partial<Pelaku>) {
  const { error } = await sb().from("pelaku_usaha").update(pick(p, PELAKU_KEYS)).eq("nib", nib);
  if (error) throw error;
}
export async function deletePelaku(nib: string, docs: Dokumen[] = []) {
  if (docs.length) await sb().storage.from(BUCKET).remove(docs.map((d) => d.path));
  const { error } = await sb().from("pelaku_usaha").delete().eq("nib", nib);
  if (error) throw error;
}

/* ---------------- Proyek OSS ---------------- */
export const fetchProyek = () => fetchPaged<Proyek>("oss_proyek", "*, oss_dokumen(*)", "id_proyek");

export async function insertProyek(rec: Proyek) {
  const { error } = await sb().from("oss_proyek").insert({ ...pick(rec, PROYEK_KEYS), sumber: "manual" });
  if (error) throw error;
}
export async function updateProyek(id: string, rec: Partial<Proyek>) {
  const { error } = await sb().from("oss_proyek").update(pick(rec, PROYEK_KEYS)).eq("id_proyek", id);
  if (error) throw error;
}
export async function deleteProyek(id: string, docs: Dokumen[] = []) {
  if (docs.length) await sb().storage.from(BUCKET).remove(docs.map((d) => d.path));
  const { error } = await sb().from("oss_proyek").delete().eq("id_proyek", id);
  if (error) throw error;
}
/** Hapus semua proyek + pelaku usaha + file dokumennya */
export async function deleteAllOss(rows: Proyek[], pelaku: Pelaku[], onProgress?: (done: number, total: number) => void) {
  const paths = [...rows.flatMap((r) => (r.oss_dokumen || []).map((d) => d.path)), ...pelaku.flatMap((p) => (p.pelaku_dokumen || []).map((d) => d.path))];
  for (let i = 0; i < paths.length; i += 500) await sb().storage.from(BUCKET).remove(paths.slice(i, i + 500));
  const total = rows.length + pelaku.length;
  const ids = rows.map((r) => r.id_proyek);
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await sb().from("oss_proyek").delete().in("id_proyek", ids.slice(i, i + 200));
    if (error) throw error;
    onProgress?.(Math.min(i + 200, ids.length), total);
  }
  const nibs = pelaku.map((p) => p.nib);
  for (let i = 0; i < nibs.length; i += 200) {
    const { error } = await sb().from("pelaku_usaha").delete().in("nib", nibs.slice(i, i + 200));
    if (error) throw error;
    onProgress?.(ids.length + Math.min(i + 200, nibs.length), total);
  }
}
/** Import OSS: simpan pelaku usaha dulu, lalu proyeknya */
export async function importOss(
  pelaku: Pelaku[], proyek: Proyek[], opts: { skipExisting: boolean; fileName: string },
  onProgress?: (done: number, total: number) => void,
) {
  const total = pelaku.length + proyek.length;
  let done = 0;
  const step = (n: number) => { done += n; onProgress?.(done, total); };
  await upsertChunks("pelaku_usaha", pelaku.map((p) => pick(p, PELAKU_KEYS)), "nib", opts.skipExisting, step);
  await upsertChunks("oss_proyek", proyek.map((r) => ({ ...pick(r, PROYEK_KEYS), sumber: "import", file_import: opts.fileName })), "id_proyek", opts.skipExisting, step);
}

/* ---------------- Pemohon (SiCantik) ---------------- */
const PEMOHON_KEYS = ["id_pemohon", "nama", "no_ktp", "no_hp", "email"];
export const fetchPemohon = () => fetchPaged<Pemohon>("sicantik_pemohon", "*", "id_pemohon");
export async function insertPemohon(p: Pemohon) {
  const { error } = await sb().from("sicantik_pemohon").insert(pick(p, PEMOHON_KEYS));
  if (error) throw error;
}
export async function updatePemohon(id: string, p: Partial<Pemohon>) {
  const { error } = await sb().from("sicantik_pemohon").update(pick(p, PEMOHON_KEYS)).eq("id_pemohon", id);
  if (error) throw error;
}
export async function deletePemohon(id: string) {
  const { error } = await sb().from("sicantik_pemohon").delete().eq("id_pemohon", id);
  if (error) throw error;
}

/* ---------------- Permohonan izin SiCantik ---------------- */
export const fetchIzin = () => fetchPaged<Izin>("sicantik_izin", "*, sicantik_dokumen(*)", "id_sicantik");
export async function insertIzin(rec: Izin) {
  const { error } = await sb().from("sicantik_izin").insert({ ...pick(rec, IZIN_KEYS), sumber: "manual" });
  if (error) throw error;
}
export async function updateIzin(id: string, rec: Partial<Izin>) {
  const { error } = await sb().from("sicantik_izin").update(pick(rec, IZIN_KEYS)).eq("id_sicantik", id);
  if (error) throw error;
}
export async function deleteIzin(id: string, docs: Dokumen[] = []) {
  if (docs.length) await sb().storage.from(BUCKET).remove(docs.map((d) => d.path));
  const { error } = await sb().from("sicantik_izin").delete().eq("id_sicantik", id);
  if (error) throw error;
}
export async function deleteAllSicantik(rows: Izin[], pemohon: Pemohon[], onProgress?: (done: number, total: number) => void) {
  const paths = rows.flatMap((r) => (r.sicantik_dokumen || []).map((d) => d.path));
  for (let i = 0; i < paths.length; i += 500) await sb().storage.from(BUCKET).remove(paths.slice(i, i + 500));
  const total = rows.length + pemohon.length;
  const ids = rows.map((r) => r.id_sicantik);
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await sb().from("sicantik_izin").delete().in("id_sicantik", ids.slice(i, i + 200));
    if (error) throw error;
    onProgress?.(Math.min(i + 200, ids.length), total);
  }
  const pids = pemohon.map((p) => p.id_pemohon);
  for (let i = 0; i < pids.length; i += 200) {
    const { error } = await sb().from("sicantik_pemohon").delete().in("id_pemohon", pids.slice(i, i + 200));
    if (error) throw error;
    onProgress?.(ids.length + Math.min(i + 200, pids.length), total);
  }
}
export async function importSicantik(
  pemohon: Pemohon[], izin: Izin[], opts: { skipExisting: boolean; fileName: string; jenisBaru?: JenisIzin[] },
  onProgress?: (done: number, total: number) => void,
) {
  const total = pemohon.length + izin.length;
  let done = 0;
  const step = (n: number) => { done += n; onProgress?.(done, total); };
  // jenis izin yang belum ada di master ditambahkan otomatis (data permohonan merujuk ke master)
  if (opts.jenisBaru?.length) await upsertChunks("master_jenis_izin", opts.jenisBaru.map((j) => pick(j, JENIS_KEYS)), "nama", true);
  await upsertChunks("sicantik_pemohon", pemohon.map((p) => pick(p, PEMOHON_KEYS)), "id_pemohon", opts.skipExisting, step);
  await upsertChunks("sicantik_izin", izin.map((r) => ({ ...pick(r, IZIN_KEYS), sumber: "import", file_import: opts.fileName })), "id_sicantik", opts.skipExisting, step);
}

/* ---------------- Master KBLI ---------------- */
const KBLI_KEYS = ["versi", "kode", "tingkat", "judul", "uraian", "kategori", "aktif"];
/** Daftar KBLI tanpa uraian (uraian diambil saat dibuka, agar ringan) */
export async function fetchKbli(): Promise<Kbli[]> {
  const out: Kbli[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await sb().from("master_kbli").select("versi,kode,tingkat,judul,kategori,aktif,updated_at")
      .order("versi").order("kode").range(from, from + size - 1);
    if (error) throw error;
    out.push(...((data || []) as Kbli[]));
    if (!data || data.length < size) break;
  }
  return out;
}
export async function getKbliUraian(versi: string, kode: string): Promise<string> {
  const { data, error } = await sb().from("master_kbli").select("uraian").eq("versi", versi).eq("kode", kode).maybeSingle();
  if (error) throw error;
  return (data?.uraian as string) || "";
}
/** Cari kata di uraian KBLI (di server), maks. 60 hasil */
export async function searchKbliUraian(q: string): Promise<{ versi: string; kode: string }[]> {
  const { data, error } = await sb().from("master_kbli").select("versi,kode").ilike("uraian", `%${q.replace(/[%_]/g, "")}%`).limit(60);
  if (error) throw error;
  return (data || []) as { versi: string; kode: string }[];
}
export async function importKbli(rows: Kbli[], onProgress?: (done: number, total: number) => void) {
  let done = 0;
  await upsertChunks("master_kbli", rows.map((r) => pick(r, KBLI_KEYS)), "versi,kode", false, (n) => { done += n; onProgress?.(done, rows.length); });
}
export async function saveKbli(r: Kbli, original?: { versi: string; kode: string }) {
  if (original) {
    const { error } = await sb().from("master_kbli").update(pick(r, KBLI_KEYS)).eq("versi", original.versi).eq("kode", original.kode);
    if (error) throw error;
  } else {
    const { error } = await sb().from("master_kbli").insert(pick(r, KBLI_KEYS));
    if (error) throw error;
  }
}
export async function deleteKbli(versi: string, kode: string) {
  const { error } = await sb().from("master_kbli").delete().eq("versi", versi).eq("kode", kode);
  if (error) throw error;
}
export async function deleteKbliVersi(versi: string) {
  const { error } = await sb().from("master_kbli").delete().eq("versi", versi);
  if (error) throw error;
}

/* ---------------- Master Jenis Izin ---------------- */
const JENIS_KEYS = ["nama", "singkatan", "kategori", "persyaratan", "lama_layanan", "masa_berlaku", "keterangan", "aktif"];
export const fetchJenisIzin = () => fetchPaged<JenisIzin>("master_jenis_izin", "*", "nama");
/** Simpan jenis izin. Mengganti nama otomatis ikut mengganti nama izin di semua permohonan. */
export async function saveJenisIzin(j: JenisIzin, originalNama?: string) {
  if (originalNama) {
    const { error } = await sb().from("master_jenis_izin").update(pick(j, JENIS_KEYS)).eq("nama", originalNama);
    if (error) throw error;
  } else {
    const { error } = await sb().from("master_jenis_izin").insert(pick(j, JENIS_KEYS));
    if (error) throw error;
  }
}
export async function deleteJenisIzin(nama: string) {
  const { error } = await sb().from("master_jenis_izin").delete().eq("nama", nama);
  if (error) throw error;
}

/* ---------------- Dokumen (OSS & SiCantik) ---------------- */
export type DocKind = "oss" | "sicantik" | "pelaku";
const DOC_TABLE: Record<DocKind, { table: string; fk: string }> = {
  oss: { table: "oss_dokumen", fk: "id_proyek" },
  pelaku: { table: "pelaku_dokumen", fk: "nib" },
  sicantik: { table: "sicantik_dokumen", fk: "id_sicantik" },
};
export async function uploadDokumen(kind: DocKind, id: string, file: File, label: string): Promise<Dokumen> {
  const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
  const folder = id.replace(/[^A-Za-z0-9._-]+/g, "_");
  const path = `${kind}/${folder}/${Date.now()}-${safe}`;
  const up = await sb().storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (up.error) throw up.error;
  const t = DOC_TABLE[kind];
  const { data, error } = await sb()
    .from(t.table)
    .insert({ [t.fk]: id, label, nama_file: file.name, path, ukuran: file.size, tipe: file.type })
    .select()
    .single();
  if (error) {
    await sb().storage.from(BUCKET).remove([path]);
    throw error;
  }
  return data as Dokumen;
}
export async function deleteDokumen(kind: DocKind, doc: Dokumen) {
  await sb().storage.from(BUCKET).remove([doc.path]);
  const { error } = await sb().from(DOC_TABLE[kind].table).delete().eq("id", doc.id);
  if (error) throw error;
}
/** Tautan sementara (1 jam) untuk membuka dokumen privat */
export async function dokumenUrl(doc: Dokumen): Promise<string> {
  const { data, error } = await sb().storage.from(BUCKET).createSignedUrl(doc.path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
