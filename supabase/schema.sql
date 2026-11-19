-- =====================================================================
--  ARSIP DIGITAL OSS — Skema database Supabase
--  Jalankan seluruh isi file ini sekali di Supabase: SQL Editor > New query > Run
--  Aman dijalankan ulang (idempotent).
-- =====================================================================

-- ---------- 1. Profil pengguna & peran ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  nama        text,
  role        text not null default 'pending' check (role in ('admin','operator','viewer','pending')),
  created_at  timestamptz not null default now()
);

-- Pengguna pertama yang terdaftar otomatis menjadi admin; berikutnya 'pending' (tanpa akses) sampai admin memberi peran
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nama, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nama', split_part(new.email, '@', 1)),
    case when not exists (select 1 from public.profiles) then 'admin' else 'pending' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Buat profil untuk pengguna yang sudah ada sebelum skrip ini dijalankan
insert into public.profiles (id, email, nama, role)
select u.id, u.email, split_part(u.email, '@', 1),
       case when row_number() over (order by u.created_at) = 1
             and not exists (select 1 from public.profiles) then 'admin' else 'pending' end
from auth.users u
on conflict (id) do nothing;

-- Fungsi bantu: peran pengguna yang sedang login
create or replace function public.app_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ---------- 2. Tabel data proyek OSS (mengikuti Format_Arsip_OSS.xlsx) ----------
create table if not exists public.oss_proyek (
  id_proyek          text primary key,               -- Id Proyek
  jenis_proyek       text not null default '',       -- Uraian_Jenis_Proyek
  nib                text not null default '',       -- Nib
  nik                text not null default '',
  nohp               text not null default '',
  email              text not null default '',
  username           text not null default '',
  nama_perusahaan    text not null default '',       -- Nama Perusahaan/Pelaku Usaha
  alamat_perusahaan  text not null default '',
  kel_perusahaan     text not null default '',
  kec_perusahaan     text not null default '',
  kab_perusahaan     text not null default '',
  tgl_terbit_oss     date,                           -- Tanggal Terbit Oss
  status_pm          text not null default '',       -- Uraian Status Penanaman Modal
  jenis_perusahaan   text not null default '',       -- Uraian Jenis Perusahaan
  risiko             text not null default '',       -- Uraian Risiko Proyek
  no_kegiatan        text not null default '',       -- No Kegiatan Usaha
  nama_proyek        text not null default '',
  skala_usaha        text not null default '',       -- Uraian Skala Usaha
  alamat_usaha       text not null default '',
  kab_usaha          text not null default '',
  kec_usaha          text not null default '',
  kel_usaha          text not null default '',
  tgl_pengajuan      date,                           -- Day of Tanggal Pengajuan Proyek
  kbli               text not null default '',
  judul_kbli         text not null default '',
  sektor             text not null default '',       -- KL/Sektor Pembina
  luas_tanah         numeric,
  satuan_tanah       text not null default '',
  investasi          numeric,                        -- Jumlah Investasi
  tki                integer,                        -- TKI
  arsip_dokumen      text not null default '',       -- Arsip Dokumen (tautan/keterangan)
  sumber             text not null default 'manual', -- 'import' | 'manual'
  file_import        text,
  created_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id) on delete set null,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users(id) on delete set null
);

create index if not exists oss_proyek_nib_idx on public.oss_proyek (nib);
create index if not exists oss_proyek_tgl_idx on public.oss_proyek (tgl_pengajuan);
create index if not exists oss_proyek_kec_idx on public.oss_proyek (kec_usaha);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'INSERT' then new.created_by := coalesce(new.created_by, auth.uid()); end if;
  return new;
end $$;

drop trigger if exists oss_proyek_touch on public.oss_proyek;
create trigger oss_proyek_touch before insert or update on public.oss_proyek
  for each row execute function public.touch_updated_at();

-- ---------- 3. Lampiran dokumen arsip ----------
create table if not exists public.oss_dokumen (
  id           uuid primary key default gen_random_uuid(),
  id_proyek    text not null references public.oss_proyek(id_proyek) on delete cascade on update cascade,
  label        text not null default '',     -- jenis dokumen, mis. NIB / PKKPR / Izin
  nama_file    text not null,
  path         text not null,                -- lokasi di Storage bucket 'arsip-dokumen'
  ukuran       bigint,
  tipe         text,
  uploaded_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists oss_dokumen_proyek_idx on public.oss_dokumen (id_proyek);

-- ---------- 4. Row Level Security ----------
-- Untuk database yang dibuat dengan versi skrip lama
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','operator','viewer','pending'));
alter table public.profiles alter column role set default 'pending';

alter table public.profiles    enable row level security;
alter table public.oss_proyek  enable row level security;
alter table public.oss_dokumen enable row level security;

drop policy if exists "profil: baca diri sendiri atau admin" on public.profiles;
create policy "profil: baca diri sendiri atau admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.app_role() = 'admin');

drop policy if exists "profil: admin ubah" on public.profiles;
create policy "profil: admin ubah" on public.profiles
  for update to authenticated using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

drop policy if exists "profil: admin hapus" on public.profiles;
create policy "profil: admin hapus" on public.profiles
  for delete to authenticated using (public.app_role() = 'admin' and id <> auth.uid());

-- Data proyek: semua peran boleh membaca; admin & operator boleh menulis
drop policy if exists "proyek: baca" on public.oss_proyek;
create policy "proyek: baca" on public.oss_proyek
  for select to authenticated using (public.app_role() in ('admin','operator','viewer'));

drop policy if exists "proyek: tambah" on public.oss_proyek;
create policy "proyek: tambah" on public.oss_proyek
  for insert to authenticated with check (public.app_role() in ('admin','operator'));

drop policy if exists "proyek: ubah" on public.oss_proyek;
create policy "proyek: ubah" on public.oss_proyek
  for update to authenticated using (public.app_role() in ('admin','operator')) with check (public.app_role() in ('admin','operator'));

drop policy if exists "proyek: hapus" on public.oss_proyek;
create policy "proyek: hapus" on public.oss_proyek
  for delete to authenticated using (public.app_role() in ('admin','operator'));

drop policy if exists "dokumen: baca" on public.oss_dokumen;
create policy "dokumen: baca" on public.oss_dokumen
  for select to authenticated using (public.app_role() in ('admin','operator','viewer'));

drop policy if exists "dokumen: tulis" on public.oss_dokumen;
create policy "dokumen: tulis" on public.oss_dokumen
  for all to authenticated using (public.app_role() in ('admin','operator')) with check (public.app_role() in ('admin','operator'));

-- ---------- 5. Storage untuk file dokumen (privat) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('arsip-dokumen', 'arsip-dokumen', false, 20971520,
        array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "arsip: baca" on storage.objects;
create policy "arsip: baca" on storage.objects
  for select to authenticated using (bucket_id = 'arsip-dokumen' and public.app_role() in ('admin','operator','viewer'));

drop policy if exists "arsip: unggah" on storage.objects;
create policy "arsip: unggah" on storage.objects
  for insert to authenticated with check (bucket_id = 'arsip-dokumen' and public.app_role() in ('admin','operator'));

drop policy if exists "arsip: hapus" on storage.objects;
create policy "arsip: hapus" on storage.objects
  for delete to authenticated using (bucket_id = 'arsip-dokumen' and public.app_role() in ('admin','operator'));

-- ---------- 6. Realtime (perubahan data langsung tampil di semua perangkat) ----------
do $$
begin
  begin alter publication supabase_realtime add table public.oss_proyek;  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.oss_dokumen; exception when duplicate_object then null; end;
end $$;
