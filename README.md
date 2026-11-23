# Arsip Digital OSS & SiCantik

Aplikasi web arsip digital perizinan dengan dua sumber data:

- **OSS RBA**: data proyek sesuai *Format Arsip OSS* (33 kolom).
- **SiCantik**: data permohonan izin sesuai *Rekap SiCantik* (13 kolom), misalnya izin praktik tenaga kesehatan, KKPR/PKKPR, PAUD, dan IPKD.

Keduanya dilengkapi dashboard laporan, input manual, import Excel, dan penyimpanan dokumen PDF.

**Teknologi:** React 18 + TypeScript + Vite (frontend, di-hosting di **Vercel**) · **Supabase** (database PostgreSQL, login, penyimpanan file).

## Fitur

**Beranda** menampilkan ringkasan kedua sumber data, tren per bulan, dan daftar data yang terakhir diperbarui.

### Data induk & arsip dokumen

- **Pelaku Usaha (OSS):** satu NIB bisa punya banyak proyek/KBLI. Data pelaku (nama, NIK, alamat, dan seterusnya) disimpan sekali saja. Saat input proyek, cukup **pilih NIB atau nama pelaku usaha**. Bila data pelaku diubah, perubahannya berlaku untuk semua proyeknya.
- **Pemohon (SiCantik):** satu pemohon bisa mengajukan banyak izin. Saat input permohonan, cukup **pilih No. KTP atau nama pemohon**.
- **Arsip dokumen:** setiap proyek/permohonan bisa dilampiri **banyak dokumen** sekaligus (seret beberapa file). Setiap file diberi jenis dokumennya, mis. NIB, PKKPR, STR, atau KTP. Jenis dokumen ditebak otomatis dari nama file dan bisa diubah.

### Master data

- **Master KBLI** (menu OSS RBA → *Master KBLI*): daftar KBLI berjenjang (Kategori, Golongan Pokok, Golongan, Subgolongan, Kelompok) lengkap dengan uraian, bisa dicari berdasarkan kode, judul, atau isi uraian. Admin mengimpor file KBLI (kolom `kode, tingkat, judul, uraian, kategori`, mis. `kbli-2025-lengkap.xlsx`) dan bisa menyimpan lebih dari satu versi (2025, 2020, dan seterusnya). Kegunaannya:
  - saat input proyek, KBLI dipilih dari master dan judulnya terisi otomatis;
  - dashboard OSS menampilkan sebaran per **kategori KBLI**, dan Data Arsip bisa difilter per kategori;
  - detail proyek menampilkan uraian KBLI-nya;
  - kode KBLI di arsip yang **tidak ada di master** (biasanya KBLI 2020) ditandai dan dirangkum di halaman Master KBLI.
- **Master Jenis Izin** (menu SiCantik → *Jenis Izin*): nama izin, singkatan, kategori, **standar waktu layanan (hari)**, masa berlaku, **persyaratan dokumen**, dan keterangan/dasar hukum. Kegunaannya:
  - jenis izin pada input permohonan dipilih dari master (dikelompokkan per kategori);
  - persyaratan menjadi **daftar periksa dokumen** di formulir dan di detail permohonan, sekaligus pilihan jenis dokumen saat unggah;
  - standar waktu dipakai untuk menghitung **% tepat waktu** di dashboard, detail permohonan, dan halaman Jenis Izin;
  - mengganti nama jenis izin otomatis ikut mengganti nama izin di semua permohonannya;
  - jenis izin baru dari file rekap otomatis ditambahkan ke master saat import.

### Menu OSS RBA (`/oss`)

| Halaman | Isi |
|---|---|
| **Login** | Masuk dengan email & kata sandi. Hanya pengguna yang dibuat admin yang bisa masuk. |
| **Dashboard** | Angka ringkas (total proyek, pelaku usaha/NIB, investasi, tenaga kerja, kelengkapan arsip), tren pengajuan per bulan, sebaran per kecamatan, risiko, skala usaha, sektor pembina, jenis perusahaan, 10 KBLI teratas, pelaku usaha teratas, dan rekap per kecamatan. Bisa difilter per tahun, bulan, dan kecamatan, lalu **diunduh sebagai laporan Excel** (9 sheet). |
| **Data Arsip** | Tabel dengan pencarian, filter, dan pengurutan. Klik baris untuk detail lengkap, edit, hapus, serta **unggah/lihat dokumen PDF**. Export ke Excel dengan format 33 kolom asli. |
| **Pelaku Usaha** | Daftar pelaku usaha beserta jumlah proyek, investasi, TKI, dan dokumennya. Klik untuk melihat semua proyeknya, mengubah data pelaku, atau menambah proyek baru untuk pelaku tersebut. |
| **Input Data** | Langkah 1: pilih pelaku usaha (cari NIB/nama), atau tambah pelaku baru. Langkah 2–4: data proyek, lokasi, dan KBLI. KBLI yang pernah dipakai mengisi otomatis judul & sektor. Langkah 5: unggah banyak dokumen. |
| **Import Excel** | Seret file .xlsx/.xls/.csv dari OSS. Kolom dicocokkan otomatis, ada pratinjau (data baru / sudah ada / bermasalah), pilihan *perbarui* atau *lewati* data yang sudah ada. |

### Menu SiCantik (`/sicantik`)

| Halaman | Isi |
|---|---|
| **Dashboard** | Total permohonan, jumlah yang sudah dan belum ditetapkan, rata-rata lama proses (tanggal permohonan sampai penetapan), dan pemohon unik. Grafik tren bulanan, kategori izin, jenis permohonan (Baru/Perpanjangan/Perubahan/Pencabutan), status penetapan, jenis izin terbanyak, lama proses per jenis izin, lokasi/fasilitas teratas, daftar permohonan yang paling lama belum ditetapkan, dan rekap per jenis izin. Ada **laporan Excel** (7 sheet). |
| **Data Arsip** | Pencarian (pemohon, nomor izin, no. permohonan, KTP, lokasi), filter kategori, jenis izin, permohonan, status, tahun, dan arsip. Klik baris untuk detail, edit, hapus, dan unggah dokumen. |
| **Pemohon** | Daftar pemohon beserta jumlah permohonan, yang sudah ditetapkan, dan dokumennya. Klik untuk melihat semua izinnya, mengubah data pemohon, atau menambah permohonan baru. |
| **Input Data** | Langkah 1: pilih pemohon (cari No. KTP/nama), atau tambah pemohon baru. Langkah 2–3: data izin & lokasi (ID dibuat otomatis bila dikosongkan). Langkah 4: unggah banyak dokumen. |
| **Import Excel** | Kolom **ID** menjadi kunci. Nilai "-" pada nomor izin/tanggal penetapan dibaca sebagai *belum ditetapkan*. Import ulang rekap terbaru akan memperbarui status izin yang sudah ditetapkan. |

### Pengaturan

| Halaman | Isi |
|---|---|
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
   Skrip ini membuat tabel OSS & SiCantik, aturan keamanan, bucket penyimpanan `arsip-dokumen` (privat, maks. 20 MB per file), dan realtime.
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

1. Masuk sebagai admin, buka **OSS RBA → Import Excel** dan seret file unduhan OSS. Lakukan hal yang sama di **SiCantik → Import Excel** untuk file rekap SiCantik.
2. Periksa pratinjau, lalu klik **Simpan**.
3. Tambah staf: buat akun di Supabase (Langkah 1 nomor 4), lalu di menu **Pengguna** ubah perannya menjadi *Operator* atau *Pembaca*.
4. Lampirkan dokumen: buka **Data Arsip** (OSS atau SiCantik), klik barisnya, lalu **Unggah dokumen** (PDF/JPG/PNG/WEBP).

## Catatan pengolahan data

**OSS**

- **Id Proyek** menjadi kunci unik. Import ulang file yang sama tidak membuat data ganda.
- **Tanggal** dikenali dari format `01/07/2020`, `24 April 2026`, maupun tanggal Excel. Tanggal yang tidak terbaca disimpan kosong dan diberi tanda di pratinjau.
- **Angka** mengikuti format Indonesia: `14.177` dibaca 14177, `885,58` dibaca 885,58.
- Teks placeholder dari unduhan OSS ("Alamat Perusahaan", "kelurahan", "kecamatan", "kab_kota") bisa otomatis dikosongkan saat import.
- Penulisan kecamatan yang berbeda (mis. `TasifetoTimur`) dikelompokkan sebagai `Tasifeto Timur` di dashboard. Data aslinya tidak diubah.
- Saat import memperbarui data lama, dokumen yang sudah dilampirkan **tidak** terhapus.
- Import membuat atau memperbarui **pelaku usaha per NIB** lebih dulu, lalu proyeknya. Kolom data pelaku yang kosong di file tidak menghapus data pelaku yang sudah ada.

**SiCantik**
- **ID** SiCantik menjadi kunci unik. Rekap bisa diimport berulang kali (mis. tiap bulan) tanpa data ganda.
- Tanda kutip di depan No. KTP (`'5304…`) otomatis dibuang.
- Status *Sudah ditetapkan* = ada nomor izin atau tanggal penetapan.
- Lama proses = selisih hari antara **Tanggal** permohonan dan **Tanggal Penetapan**.
- Kategori izin (Tenaga Kesehatan, Tata Ruang, PAUD, dll.) dikenali otomatis dari nama izin.
- Pemohon dikenali dari **No. KTP** (bila berisi minimal 8 digit). Pemohon tanpa KTP yang valid dikenali dari namanya.

## Mengisi master data pertama kali

1. **Master KBLI**: masuk sebagai Admin, buka **OSS RBA → Master KBLI → Import Excel**, lalu pilih `kbli-2025-lengkap.xlsx`. Versi terisi otomatis dari nama file (2025). Ada 2.444 kode, prosesnya beberapa detik.
2. **Master Jenis Izin**: setelah `schema.sql` dijalankan, jenis izin yang sudah ada di data SiCantik otomatis masuk ke master. Untuk instalasi baru, jenis izin terisi saat rekap SiCantik diimpor. Lengkapi standar waktu dan persyaratan tiap jenis izin di **SiCantik → Jenis Izin**.

Master data hanya bisa diubah oleh **Admin**. Operator boleh menambah jenis izin baru (otomatis saat import).

## Memperbarui database yang sudah ada

Sudah memakai versi sebelumnya? Cukup **jalankan ulang seluruh isi `supabase/schema.sql`** di SQL Editor. Skrip ini otomatis:

1. membuat tabel `pelaku_usaha` dan `sicantik_pemohon`,
2. memindahkan data pelaku usaha dan pemohon dari baris proyek/izin yang sudah ada ke tabel tersebut (satu per NIB atau pemohon),
3. menghubungkan proyek ke pelaku usaha dan izin ke pemohon.

Versi 4 juga membuat tabel `master_kbli` dan `master_jenis_izin`, lalu mengisi master jenis izin dari data permohonan yang sudah ada.

Tidak ada data atau dokumen yang hilang, dan skrip aman dijalankan berulang. Proyek lama yang NIB-nya kosong diberi NIB sementara `TANPA-NIB-<Id Proyek>`, yang bisa Anda perbaiki di menu **Pelaku Usaha**.

> Sebaiknya *backup* dulu sebelum menjalankan: **Database → Backups**, atau ekspor data dari menu Data Arsip.

## Struktur folder

```
supabase/schema.sql      skema database + migrasi otomatis + keamanan + storage (jalankan saat pasang / update)
src/lib/api.ts           semua komunikasi dengan Supabase
src/lib/columns.ts       definisi 33 kolom Format Arsip OSS
src/lib/sicantik.ts      definisi 13 kolom Rekap SiCantik, status, kategori, lama proses
src/lib/format.ts        pembacaan tanggal/angka & format rupiah
src/lib/excel.ts         import & export Excel
src/pages/               Login, Beranda, halaman OSS (Dashboard, DataArsip, Pelaku, InputData, ImportExcel), Pengguna
src/pages/sicantik/      halaman SiCantik (Dashboard, Data, Pemohon, Input, Import)
src/components/          Layout, grafik, modal detail, pemilih NIB/KTP (MasterPicker), unggah banyak dokumen (DocUploader)
src/lib/forms.ts         definisi isian formulir & validasi
src/lib/master.ts        Master KBLI (indeks, hierarki, kategori) & Master Jenis Izin (persyaratan, standar waktu)
src/pages/master/        halaman Master KBLI & Master Jenis Izin
vercel.json              agar alamat halaman (mis. /data) tidak 404 saat di-refresh
```

## Kapasitas paket gratis Supabase

Database 500 MB cukup untuk ratusan ribu baris data OSS dan SiCantik. Storage 1 GB setara kira-kira 2.000–5.000 file PDF (tergantung ukuran). Bila dokumen bertambah banyak, naikkan paket Supabase.

## Mengatasi masalah

| Gejala | Penyebab & solusi |
|---|---|
| Muncul layar "Konfigurasi Supabase belum diisi" | Environment Variables belum diisi di Vercel, atau belum *Redeploy* setelah diisi. |
| "Profil belum terdaftar" | `schema.sql` belum dijalankan. Jalankan, lalu login ulang. |
| "Menunggu persetujuan" | Admin belum memberi peran. Ubah lewat menu **Pengguna**. |
| "Anda tidak memiliki izin" | Peran Anda *Pembaca*. Minta admin mengubahnya menjadi *Operator*. |
| Halaman 404 saat refresh di Vercel | Pastikan file `vercel.json` ikut ter-upload. |
| Unggah dokumen gagal | File lebih dari 20 MB atau bukan PDF/JPG/PNG/WEBP. |
