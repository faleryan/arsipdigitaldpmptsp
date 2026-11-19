// Lapisan akses data — semua komunikasi dengan Supabase ada di file ini.
import { createClient, type Session } from "@supabase/supabase-js";
import type { Dokumen, Proyek } from "./columns";
import type { Izin } from "./sicantik";

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
  if (err?.code === "23505") return "Data dengan Id Proyek tersebut sudah ada.";
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

/* ---------------- Data proyek ---------------- */
const SELECT = "*, oss_dokumen(*)";

/** Ambil semua data (dipaginasi per 1000 baris, batas bawaan Supabase) */
export async function fetchAll(): Promise<Proyek[]> {
  const out: Proyek[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await sb().from("oss_proyek").select(SELECT).order("id_proyek").range(from, from + size - 1);
    if (error) throw error;
    out.push(...((data || []) as Proyek[]));
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

const strip = (r: Partial<Proyek>) => {
  const o: Record<string, unknown> = { ...r };
  delete o.oss_dokumen; delete o.created_at; delete o.updated_at;
  return o;
};

export async function insertProyek(rec: Proyek) {
  const { error } = await sb().from("oss_proyek").insert({ ...strip(rec), sumber: "manual" });
  if (error) throw error;
}
export async function updateProyek(id: string, rec: Partial<Proyek>) {
  const { error } = await sb().from("oss_proyek").update(strip(rec)).eq("id_proyek", id);
  if (error) throw error;
}
export async function deleteProyek(id: string, docs: Dokumen[] = []) {
  if (docs.length) await sb().storage.from(BUCKET).remove(docs.map((d) => d.path));
  const { error } = await sb().from("oss_proyek").delete().eq("id_proyek", id);
  if (error) throw error;
}
export async function deleteAll(rows: Proyek[], onProgress?: (done: number, total: number) => void) {
  const paths = rows.flatMap((r) => (r.oss_dokumen || []).map((d) => d.path));
  for (let i = 0; i < paths.length; i += 500) await sb().storage.from(BUCKET).remove(paths.slice(i, i + 500));
  const ids = rows.map((r) => r.id_proyek);
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await sb().from("oss_proyek").delete().in("id_proyek", ids.slice(i, i + 200));
    if (error) throw error;
    onProgress?.(Math.min(i + 200, ids.length), ids.length);
  }
}

/** Simpan banyak baris sekaligus. skipExisting=true → data yang sudah ada tidak diubah. */
export async function upsertBatch(
  rows: Proyek[],
  opts: { skipExisting: boolean; fileName: string },
  onProgress?: (done: number, total: number) => void,
) {
  const size = 300;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size).map((r) => ({ ...strip(r), sumber: "import", file_import: opts.fileName }));
    const { error } = await sb().from("oss_proyek").upsert(chunk, { onConflict: "id_proyek", ignoreDuplicates: opts.skipExisting });
    if (error) throw error;
    onProgress?.(Math.min(i + size, rows.length), rows.length);
  }
}

/* ---------------- Data SiCantik ---------------- */
export async function fetchAllSicantik(): Promise<Izin[]> {
  const out: Izin[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await sb().from("sicantik_izin").select("*, sicantik_dokumen(*)").order("id_sicantik").range(from, from + size - 1);
    if (error) throw error;
    out.push(...((data || []) as Izin[]));
    if (!data || data.length < size) break;
  }
  return out;
}
const stripIzin = (r: Partial<Izin>) => {
  const o: Record<string, unknown> = { ...r };
  delete o.sicantik_dokumen; delete o.created_at; delete o.updated_at;
  return o;
};
export async function insertIzin(rec: Izin) {
  const { error } = await sb().from("sicantik_izin").insert({ ...stripIzin(rec), sumber: "manual" });
  if (error) throw error;
}
export async function updateIzin(id: string, rec: Partial<Izin>) {
  const { error } = await sb().from("sicantik_izin").update(stripIzin(rec)).eq("id_sicantik", id);
  if (error) throw error;
}
export async function deleteIzin(id: string, docs: Dokumen[] = []) {
  if (docs.length) await sb().storage.from(BUCKET).remove(docs.map((d) => d.path));
  const { error } = await sb().from("sicantik_izin").delete().eq("id_sicantik", id);
  if (error) throw error;
}
export async function deleteAllIzin(rows: Izin[], onProgress?: (done: number, total: number) => void) {
  const paths = rows.flatMap((r) => (r.sicantik_dokumen || []).map((d) => d.path));
  for (let i = 0; i < paths.length; i += 500) await sb().storage.from(BUCKET).remove(paths.slice(i, i + 500));
  const ids = rows.map((r) => r.id_sicantik);
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await sb().from("sicantik_izin").delete().in("id_sicantik", ids.slice(i, i + 200));
    if (error) throw error;
    onProgress?.(Math.min(i + 200, ids.length), ids.length);
  }
}
export async function upsertIzinBatch(
  rows: Izin[],
  opts: { skipExisting: boolean; fileName: string },
  onProgress?: (done: number, total: number) => void,
) {
  const size = 300;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size).map((r) => ({ ...stripIzin(r), sumber: "import", file_import: opts.fileName }));
    const { error } = await sb().from("sicantik_izin").upsert(chunk, { onConflict: "id_sicantik", ignoreDuplicates: opts.skipExisting });
    if (error) throw error;
    onProgress?.(Math.min(i + size, rows.length), rows.length);
  }
}

/* ---------------- Dokumen (OSS & SiCantik) ---------------- */
export type DocKind = "oss" | "sicantik";
const DOC_TABLE: Record<DocKind, { table: string; fk: string }> = {
  oss: { table: "oss_dokumen", fk: "id_proyek" },
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
