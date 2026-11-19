# Arsip Digital OSS

Aplikasi web untuk mengarsipkan data proyek **OSS RBA** sesuai *Format Arsip OSS* (33 kolom), lengkap dengan dashboard laporan dan penyimpanan dokumen PDF.

**Teknologi:** React 18 + TypeScript + Vite (frontend, di-hosting di **Vercel**) · **Supabase** (database PostgreSQL, login, penyimpanan file).

## Fitur

| Halaman | Isi |
|---|---|
| **Login** | Masuk dengan email & kata sandi. Hanya pengguna yang dibuat admin yang bisa masuk. |
| **Dashboard** | Angka ringkas (total proyek, pelaku usaha/NIB, investasi, tenaga kerja, kelengkapan arsip), tren pengajuan per bulan, sebaran per kecamatan, risiko, skala usaha, sektor pembina, jenis perusahaan, 10 KBLI teratas, pelaku usaha teratas, dan rekap per kecamatan. Bisa difilter per tahun, bulan, dan kecamatan, lalu **diunduh sebagai laporan Excel** (9 sheet). |
| **Data Arsip** | Tabel dengan pencarian, filter, dan pengurutan. Klik baris untuk detail lengkap, edit, hapus, serta **unggah/lihat dokumen PDF**. Export ke Excel dengan format 33 kolom asli. |
| **Input Data** | Formulir manual. NIB yang sudah ada mengisi otomatis data pelaku usaha; KBLI yang pernah dipakai mengisi otomatis judul & sektor. |
| **Import Excel** | Seret file .xlsx/.xls/.csv dari OSS. Kolom dicocokkan otomatis, ada pratinjau (data baru / sudah ada / bermasalah), pilihan *perbarui* atau *lewati* data yang sudah ada. |
| **Pengguna** | (Admin) mengatur peran tiap pengguna. |

**Peran pengguna**

- **Admin**: semua akses, kelola pengguna, dan kosongkan seluruh data.
- **Operator**: lihat, tambah, ubah, hapus, import, dan unggah dokumen.
- **Pembaca**: hanya melihat dashboard dan data.
- **Nonaktif**: belum punya akses. Ini status bawaan untuk akun baru.

Keamanan diterapkan di database (Row Level Security), jadi aturan peran tetap berlaku walaupun ada yang mencoba mengakses API langsung.

---

## Langkah 1: Siapkan Supabase

1. Buka <https://supabase.com>, lalu **New project**. Catat kata sandi database.
2. Buka **SQL Editor → New query**, salin **seluruh** isi file `supabase/schema.sql`, lalu klik **Run**.
   Skrip ini membuat tabel, aturan keamanan, bucket penyimpanan `arsip-dokumen` (privat, maks. 20 MB per file), dan realtime.
3. Matikan pendaftaran publik: **Authentication → Sign In / Providers → Email**, lalu nonaktifkan **Allow new users to sign up**.
   (Pengaturan ini disarankan. Kalau tetap terbuka, akun yang mendaftar sendiri pun hanya berstatus *Nonaktif* dan tidak bisa melihat data.)
4. Buat akun admin pertama: **Authentication → Users → Add user → Create new user**. Isi email & kata sandi, centang **Auto Confirm User**.
   👉 **Pengguna pertama otomatis menjadi Admin.**
5. Ambil kunci API: **Project Settings → API** (atau **Data API**). Salin:
   - **Project URL**, untuk `VITE_SUPABASE_URL`
   - **anon public** key, untuk `VITE_SUPABASE_ANON_KEY`

> ⚠️ Jangan pernah memakai kunci **service_role** di aplikasi ini.

## Langkah 2: Coba di komputer sendiri (opsional)

Perlu Node.js 18 atau lebih baru.

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
# isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env
npm run dev
```

Lalu buka <http://localhost:5173>.

## Langkah 3: Deploy ke Vercel

### Cara A: lewat GitHub (disarankan)

1. Unggah folder proyek ini ke repository GitHub baru (file `.env` dan folder `node_modules` tidak ikut, sudah diatur di `.gitignore`).
2. Di <https://vercel.com>, pilih **Add New → Project**, lalu **Import** repository tersebut.
3. *Framework Preset* akan terdeteksi otomatis sebagai **Vite**. Build command `npm run build` dan output `dist` sudah benar.
4. Buka **Environment Variables**, lalu tambahkan:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL dari Supabase |
   | `VITE_SUPABASE_ANON_KEY` | anon public key |
   | `VITE_NAMA_INSTANSI` | `DPMPTSP Kabupaten Belu` (opsional) |

5. Klik **Deploy**. Setelah selesai, aplikasi bisa diakses di `https://nama-proyek.vercel.app`.

Setiap kali ada perubahan yang di-*push* ke GitHub, Vercel otomatis men-deploy ulang.

### Cara B: Vercel CLI

```bash
npx vercel            # ikuti pertanyaan, pilih "Vite"
npx vercel env add VITE_SUPABASE_URL
npx vercel env add VITE_SUPABASE_ANON_KEY
npx vercel --prod
```

> Bila mengubah Environment Variables, lakukan **Redeploy**, karena nilai `VITE_…` dibaca saat build.

## Langkah 4: Atur URL di Supabase

**Authentication → URL Configuration**, lalu isi **Site URL** dengan alamat Vercel Anda (mis. `https://arsip-oss.vercel.app`).

---

## Cara pakai singkat

1. Masuk sebagai admin, lalu buka **Import Excel** dan seret file unduhan OSS.
2. Periksa pratinjau, lalu klik **Simpan**.
3. Tambah staf: buat akun di Supabase (Langkah 1 nomor 4), lalu di menu **Pengguna** ubah perannya menjadi *Operator* atau *Pembaca*.
4. Lampirkan dokumen: buka **Data Arsip**, klik baris proyek, lalu **Unggah dokumen** (PDF/JPG/PNG/WEBP).

## Catatan pengolahan data

- **Id Proyek** menjadi kunci unik. Import ulang file yang sama tidak membuat data ganda.
- **Tanggal** dikenali dari format `01/07/2020`, `24 April 2026`, maupun tanggal Excel. Tanggal yang tidak terbaca disimpan kosong dan diberi tanda di pratinjau.
- **Angka** mengikuti format Indonesia: `14.177` dibaca 14177, `885,58` dibaca 885,58.
- Teks placeholder dari unduhan OSS ("Alamat Perusahaan", "kelurahan", "kecamatan", "kab_kota") bisa otomatis dikosongkan saat import.
- Penulisan kecamatan yang berbeda (mis. `TasifetoTimur`) dikelompokkan sebagai `Tasifeto Timur` di dashboard. Data aslinya tidak diubah.
- Saat import memperbarui data lama, dokumen yang sudah dilampirkan **tidak** terhapus.

## Struktur folder

```
supabase/schema.sql      skema database + keamanan + storage (jalankan sekali)
src/lib/api.ts           semua komunikasi dengan Supabase
src/lib/columns.ts       definisi 33 kolom Format Arsip OSS
src/lib/format.ts        pembacaan tanggal/angka & format rupiah
src/lib/excel.ts         import & export Excel
src/pages/               Login, Dashboard, DataArsip, InputData, ImportExcel, Pengguna
src/components/          Layout, grafik, modal detail
vercel.json              agar alamat halaman (mis. /data) tidak 404 saat di-refresh
```

## Kapasitas paket gratis Supabase

Database 500 MB cukup untuk ratusan ribu baris proyek. Storage 1 GB setara kira-kira 2.000–5.000 file PDF (tergantung ukuran). Bila dokumen bertambah banyak, naikkan paket Supabase.

## Mengatasi masalah

| Gejala | Penyebab & solusi |
|---|---|
| Muncul layar "Konfigurasi Supabase belum diisi" | Environment Variables belum diisi di Vercel, atau belum *Redeploy* setelah diisi. |
| "Profil belum terdaftar" | `schema.sql` belum dijalankan. Jalankan, lalu login ulang. |
| "Menunggu persetujuan" | Admin belum memberi peran. Ubah lewat menu **Pengguna**. |
| "Anda tidak memiliki izin" | Peran Anda *Pembaca*. Minta admin mengubahnya menjadi *Operator*. |
| Halaman 404 saat refresh di Vercel | Pastikan file `vercel.json` ikut ter-upload. |
| Unggah dokumen gagal | File lebih dari 20 MB atau bukan PDF/JPG/PNG/WEBP. |
