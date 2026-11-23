-- =====================================================================
--  ARSIP DIGITAL OSS & SICANTIK — Skema database Supabase (versi 4)
--  Jalankan seluruh isi file ini di Supabase: SQL Editor > New query > Run
--
--  • Instalasi baru  : langsung jalankan.
--  • Sudah pakai versi sebelumnya: jalankan juga. Data lama dipindahkan
--    otomatis ke tabel Pelaku Usaha & Pemohon (tidak ada data yang hilang).
--  Versi 4 menambah Master KBLI & Master Jenis Izin.
--  Aman dijalankan berulang kali.
-- =====================================================================

-- ---------- 1. Profil pengguna & peran ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  nama        text,
  role        text not null default 'pending',
  created_at  timestamptz not null default now()
);
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','operator','viewer','pending'));
alter table public.profiles alter column role set default 'pending';

-- Pengguna pertama otomatis admin; berikutnya 'pending' (tanpa akses) sampai admin memberi peran
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nama, role)
  values (
    new.id, new.email,
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

insert into public.profiles (id, email, nama, role)
select u.id, u.email, split_part(u.email, '@', 1),
       case when row_number() over (order by u.created_at) = 1
             and not exists (select 1 from public.profiles) then 'admin' else 'pending' end
from auth.users u
on conflict (id) do nothing;

create or replace function public.app_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'INSERT' then new.created_by := coalesce(new.created_by, auth.uid()); end if;
  return new;
end $$;

-- =====================================================================
--  OSS RBA
-- =====================================================================

-- ---------- 2. Pelaku usaha (satu NIB bisa punya banyak proyek) ----------
create table if not exists public.pelaku_usaha (
  nib                text primary key,
  nama_perusahaan    text not null default '',
  jenis_perusahaan   text not null default '',
  status_pm          text not null default '',
  tgl_terbit_oss     date,
  nik                text not null default '',
  nohp               text not null default '',
  email              text not null default '',
  username           text not null default '',
  alamat_perusahaan  text not null default '',
  kel_perusahaan     text not null default '',
  kec_perusahaan     text not null default '',
  kab_perusahaan     text not null default '',
  created_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id) on delete set null,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users(id) on delete set null
);
create index if not exists pelaku_nama_idx on public.pelaku_usaha (lower(nama_perusahaan));

-- ---------- 3. Proyek OSS ----------
create table if not exists public.oss_proyek (
  id_proyek          text primary key,
  nib                text not null,
  jenis_proyek       text not null default '',
  risiko             text not null default '',
  no_kegiatan        text not null default '',
  nama_proyek        text not null default '',
  skala_usaha        text not null default '',
  alamat_usaha       text not null default '',
  kab_usaha          text not null default '',
  kec_usaha          text not null default '',
  kel_usaha          text not null default '',
  tgl_pengajuan      date,
  kbli               text not null default '',
  judul_kbli         text not null default '',
  sektor             text not null default '',
  luas_tanah         numeric,
  satuan_tanah       text not null default '',
  investasi          numeric,
  tki                integer,
  arsip_dokumen      text not null default '',
  sumber             text not null default 'manual',
  file_import        text,
  created_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id) on delete set null,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users(id) on delete set null
);

-- Migrasi dari versi lama: data pelaku usaha yang dulu tersimpan di setiap baris proyek
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'oss_proyek' and column_name = 'nama_perusahaan') then
    update public.oss_proyek set nib = 'TANPA-NIB-' || id_proyek where coalesce(nib, '') = '';
    insert into public.pelaku_usaha (nib, nama_perusahaan, jenis_perusahaan, status_pm, tgl_terbit_oss, nik, nohp, email, username,
                                     alamat_perusahaan, kel_perusahaan, kec_perusahaan, kab_perusahaan)
    select distinct on (nib) nib, nama_perusahaan, jenis_perusahaan, status_pm, tgl_terbit_oss, nik, nohp, email, username,
           alamat_perusahaan, kel_perusahaan, kec_perusahaan, kab_perusahaan
    from public.oss_proyek
    order by nib, updated_at desc
    on conflict (nib) do nothing;
    alter table public.oss_proyek
      drop column nama_perusahaan, drop column jenis_perusahaan, drop column status_pm, drop column tgl_terbit_oss,
      drop column nik, drop column nohp, drop column email, drop column username, drop column alamat_perusahaan,
      drop column kel_perusahaan, drop column kec_perusahaan, drop column kab_perusahaan;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'oss_proyek_nib_fkey') then
    alter table public.oss_proyek add constraint oss_proyek_nib_fkey
      foreign key (nib) references public.pelaku_usaha(nib) on update cascade on delete restrict;
  end if;
end $$;

create index if not exists oss_proyek_nib_idx on public.oss_proyek (nib);
create index if not exists oss_proyek_tgl_idx on public.oss_proyek (tgl_pengajuan);
create index if not exists oss_proyek_kec_idx on public.oss_proyek (kec_usaha);

drop trigger if exists pelaku_touch on public.pelaku_usaha;
create trigger pelaku_touch before insert or update on public.pelaku_usaha
  for each row execute function public.touch_updated_at();
drop trigger if exists oss_proyek_touch on public.oss_proyek;
create trigger oss_proyek_touch before insert or update on public.oss_proyek
  for each row execute function public.touch_updated_at();

-- ---------- 4. Dokumen arsip proyek (boleh lebih dari satu per proyek) ----------
create table if not exists public.oss_dokumen (
  id           uuid primary key default gen_random_uuid(),
  id_proyek    text not null references public.oss_proyek(id_proyek) on delete cascade on update cascade,
  label        text not null default '',
  nama_file    text not null,
  path         text not null,
  ukuran       bigint,
  tipe         text,
  uploaded_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists oss_dokumen_proyek_idx on public.oss_dokumen (id_proyek);

-- =====================================================================
--  SICANTIK
-- =====================================================================

-- ---------- 5. Pemohon (satu pemohon bisa mengajukan banyak izin) ----------
--  id_pemohon = No. KTP (bila berisi ≥ 8 digit), selain itu 'NM-' + nama
create table if not exists public.sicantik_pemohon (
  id_pemohon   text primary key,
  nama         text not null default '',
  no_ktp       text not null default '',
  no_hp        text not null default '',
  email        text not null default '',
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id) on delete set null
);
create index if not exists pemohon_ktp_idx on public.sicantik_pemohon (no_ktp);
create index if not exists pemohon_nama_idx on public.sicantik_pemohon (lower(nama));

-- ---------- 6. Permohonan izin SiCantik ----------
create table if not exists public.sicantik_izin (
  id_sicantik     text primary key,
  pemohon_id      text,
  izin            text not null default '',
  nomor_izin      text not null default '',
  jenis           text not null default '',
  tanggal         date,
  lokasi          text not null default '',
  no_permohonan   text not null default '',
  tgl_penetapan   date,
  lokasi_izin     text not null default '',
  keterangan      text not null default '',
  sumber          text not null default 'manual',
  file_import     text,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id) on delete set null
);
alter table public.sicantik_izin add column if not exists pemohon_id text;

-- Migrasi dari versi lama: data pemohon yang dulu tersimpan di setiap baris izin
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'sicantik_izin' and column_name = 'pemohon') then
    update public.sicantik_izin set pemohon_id =
      case when no_ktp ~ '^[0-9]{8,}$' then no_ktp
           else 'NM-' || coalesce(nullif(trim(both '-' from regexp_replace(lower(pemohon), '[^a-z0-9]+', '-', 'g')), ''), 'tanpa-nama')
      end
    where pemohon_id is null;
    insert into public.sicantik_pemohon (id_pemohon, nama, no_ktp, no_hp, email)
    select distinct on (pemohon_id) pemohon_id, pemohon, no_ktp, no_hp, email
    from public.sicantik_izin
    order by pemohon_id, updated_at desc
    on conflict (id_pemohon) do nothing;
    alter table public.sicantik_izin drop column pemohon, drop column no_ktp, drop column no_hp, drop column email;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sicantik_izin_pemohon_fkey') then
    alter table public.sicantik_izin alter column pemohon_id set not null;
    alter table public.sicantik_izin add constraint sicantik_izin_pemohon_fkey
      foreign key (pemohon_id) references public.sicantik_pemohon(id_pemohon) on update cascade on delete restrict;
  end if;
end $$;

drop index if exists public.sicantik_ktp_idx;
create index if not exists sicantik_pemohon_idx on public.sicantik_izin (pemohon_id);
create index if not exists sicantik_tanggal_idx on public.sicantik_izin (tanggal);
create index if not exists sicantik_izin_idx on public.sicantik_izin (izin);

drop trigger if exists pemohon_touch on public.sicantik_pemohon;
create trigger pemohon_touch before insert or update on public.sicantik_pemohon
  for each row execute function public.touch_updated_at();
drop trigger if exists sicantik_touch on public.sicantik_izin;
create trigger sicantik_touch before insert or update on public.sicantik_izin
  for each row execute function public.touch_updated_at();

create table if not exists public.sicantik_dokumen (
  id           uuid primary key default gen_random_uuid(),
  id_sicantik  text not null references public.sicantik_izin(id_sicantik) on delete cascade on update cascade,
  label        text not null default '',
  nama_file    text not null,
  path         text not null,
  ukuran       bigint,
  tipe         text,
  uploaded_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists sicantik_dokumen_idx on public.sicantik_dokumen (id_sicantik);

-- =====================================================================
--  MASTER DATA
-- =====================================================================

-- ---------- 7. Master KBLI (per versi, mis. 2025 / 2020) ----------
--  Tidak dikunci ke oss_proyek karena proyek lama bisa memakai KBLI versi sebelumnya.
create table if not exists public.master_kbli (
  versi       text not null default '2025',
  kode        text not null,
  tingkat     text not null default '',   -- Kategori / Golongan Pokok / Golongan / Subgolongan / Kelompok
  judul       text not null default '',
  uraian      text not null default '',
  kategori    text not null default '',   -- huruf kategori A–V
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null,
  primary key (versi, kode)
);
create index if not exists master_kbli_kode_idx on public.master_kbli (kode);
drop trigger if exists master_kbli_touch on public.master_kbli;
create trigger master_kbli_touch before insert or update on public.master_kbli
  for each row execute function public.touch_updated_at();

-- ---------- 8. Master Jenis Izin SiCantik ----------
create table if not exists public.master_jenis_izin (
  nama          text primary key,               -- nama izin persis seperti di SiCantik
  singkatan     text not null default '',       -- mis. SIP-PV
  kategori      text not null default '',       -- mis. Izin Praktik Tenaga Kesehatan
  persyaratan   text not null default '',       -- satu persyaratan per baris
  lama_layanan  integer,                        -- standar waktu layanan (hari)
  masa_berlaku  text not null default '',
  keterangan    text not null default '',
  aktif         boolean not null default true,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id) on delete set null
);
drop trigger if exists master_jenis_izin_touch on public.master_jenis_izin;
create trigger master_jenis_izin_touch before insert or update on public.master_jenis_izin
  for each row execute function public.touch_updated_at();

-- Isi awal dari jenis izin yang sudah ada di data permohonan, lalu hubungkan
insert into public.master_jenis_izin (nama, singkatan, kategori)
select distinct izin,
  coalesce(substring(izin from '\(([A-Z][A-Za-z]*(?:-[A-Za-z]+)*)\)'), ''),
  case
    when izin ~* 'praktik' then 'Izin Praktik Tenaga Kesehatan'
    when izin ~* 'kkpr|pemanfaatan ruang' then 'Tata Ruang (KKPR/PKKPR)'
    when izin ~* 'paud|pendidikan' then 'Pendidikan (PAUD)'
    when izin ~* 'kekayaan daerah|ipkd' then 'Pemanfaatan Kekayaan Daerah'
    when izin ~* 'penelitian' then 'Penelitian'
    when izin ~* 'sosial' then 'Kesejahteraan Sosial'
    else 'Lainnya'
  end
from public.sicantik_izin
where izin <> ''
on conflict (nama) do nothing;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sicantik_izin_izin_fkey') then
    alter table public.sicantik_izin add constraint sicantik_izin_izin_fkey
      foreign key (izin) references public.master_jenis_izin(nama) on update cascade on delete restrict;
  end if;
end $$;

-- =====================================================================
--  KEAMANAN (Row Level Security)
--  admin & operator: baca + tulis · viewer: baca · pending: tidak ada akses
-- =====================================================================
alter table public.profiles         enable row level security;
alter table public.pelaku_usaha     enable row level security;
alter table public.oss_proyek       enable row level security;
alter table public.oss_dokumen      enable row level security;
alter table public.sicantik_pemohon enable row level security;
alter table public.sicantik_izin    enable row level security;
alter table public.sicantik_dokumen enable row level security;

drop policy if exists "profil: baca diri sendiri atau admin" on public.profiles;
create policy "profil: baca diri sendiri atau admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.app_role() = 'admin');
drop policy if exists "profil: admin ubah" on public.profiles;
create policy "profil: admin ubah" on public.profiles
  for update to authenticated using (public.app_role() = 'admin') with check (public.app_role() = 'admin');
drop policy if exists "profil: admin hapus" on public.profiles;
create policy "profil: admin hapus" on public.profiles
  for delete to authenticated using (public.app_role() = 'admin' and id <> auth.uid());

-- Kebijakan baca/tulis yang sama untuk semua tabel data
do $$
declare t text;
begin
  foreach t in array array['pelaku_usaha','oss_proyek','oss_dokumen','sicantik_pemohon','sicantik_izin','sicantik_dokumen'] loop
    execute format('drop policy if exists "data: baca" on public.%I', t);
    execute format('create policy "data: baca" on public.%I for select to authenticated using (public.app_role() in (''admin'',''operator'',''viewer''))', t);
    execute format('drop policy if exists "data: tulis" on public.%I', t);
    execute format('create policy "data: tulis" on public.%I for all to authenticated using (public.app_role() in (''admin'',''operator'')) with check (public.app_role() in (''admin'',''operator''))', t);
  end loop;
end $$;

-- Master data: semua peran membaca; KBLI hanya admin yang mengubah;
-- jenis izin boleh ditambah operator (otomatis saat import), diubah/dihapus admin
alter table public.master_kbli       enable row level security;
alter table public.master_jenis_izin enable row level security;
drop policy if exists "master: baca" on public.master_kbli;
create policy "master: baca" on public.master_kbli for select to authenticated using (public.app_role() in ('admin','operator','viewer'));
drop policy if exists "master: admin" on public.master_kbli;
create policy "master: admin" on public.master_kbli for all to authenticated using (public.app_role() = 'admin') with check (public.app_role() = 'admin');
drop policy if exists "master: baca" on public.master_jenis_izin;
create policy "master: baca" on public.master_jenis_izin for select to authenticated using (public.app_role() in ('admin','operator','viewer'));
drop policy if exists "master: tambah" on public.master_jenis_izin;
create policy "master: tambah" on public.master_jenis_izin for insert to authenticated with check (public.app_role() in ('admin','operator'));
drop policy if exists "master: ubah" on public.master_jenis_izin;
create policy "master: ubah" on public.master_jenis_izin for update to authenticated using (public.app_role() = 'admin') with check (public.app_role() = 'admin');
drop policy if exists "master: hapus" on public.master_jenis_izin;
create policy "master: hapus" on public.master_jenis_izin for delete to authenticated using (public.app_role() = 'admin');

-- Bersihkan nama kebijakan versi lama
drop policy if exists "proyek: baca" on public.oss_proyek;
drop policy if exists "proyek: tambah" on public.oss_proyek;
drop policy if exists "proyek: ubah" on public.oss_proyek;
drop policy if exists "proyek: hapus" on public.oss_proyek;
drop policy if exists "dokumen: baca" on public.oss_dokumen;
drop policy if exists "dokumen: tulis" on public.oss_dokumen;
drop policy if exists "sicantik: baca" on public.sicantik_izin;
drop policy if exists "sicantik: tambah" on public.sicantik_izin;
drop policy if exists "sicantik: ubah" on public.sicantik_izin;
drop policy if exists "sicantik: hapus" on public.sicantik_izin;
drop policy if exists "sicantik dokumen: baca" on public.sicantik_dokumen;
drop policy if exists "sicantik dokumen: tulis" on public.sicantik_dokumen;

-- ---------- Storage file dokumen (privat) ----------
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

-- ---------- Realtime ----------
do $$
declare t text;
begin
  foreach t in array array['pelaku_usaha','oss_proyek','oss_dokumen','sicantik_pemohon','sicantik_izin','sicantik_dokumen','master_kbli','master_jenis_izin'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
