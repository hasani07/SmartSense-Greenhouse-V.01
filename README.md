# Dashboard Monitoring Kualitas Air

## Cara upload ke GitHub (tanpa command line)

1. Buka github.com, login, klik "+" di kanan atas → New repository.
   Beri nama (misal `dashboard-air`), biarkan kosong (jangan centang
   "Add README"), klik Create repository.
2. Di halaman repo yang baru, klik link kecil
   "uploading an existing file".
3. Extract folder ini (dari .zip), lalu drag SEMUA isi folder
   (bukan foldernya sendiri, tapi isinya: app/, package.json, dst)
   ke area upload di GitHub.
4. Scroll ke bawah, klik "Commit changes".

Catatan: file `.env.local` sengaja TIDAK ikut ter-upload (sudah
diblokir lewat .gitignore) karena berisi kredensial. Isi environment
variable-nya langsung di Vercel nanti (lihat di bawah).

## Cara deploy ke Vercel

1. Buka vercel.com, login pakai akun GitHub yang sama.
2. Add New → Project → pilih repo `dashboard-air` yang barusan dibuat.
3. Sebelum klik Deploy, buka bagian "Environment Variables", tambahkan:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   (nilainya lihat di file .env.local.example di folder ini)
4. Klik Deploy. Tunggu ~1 menit, dapat URL publik seperti
   dashboard-air.vercel.app.
