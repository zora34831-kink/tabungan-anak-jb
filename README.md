
# TABUNGAN ANAK JB

Aplikasi pengelola tabungan dan transaksi pribadi.

## Menjalankan di komputer

```bash
npm install
npm run dev
```

## Build APK melalui GitHub Actions

1. Upload seluruh file proyek ke repository GitHub.
2. Buka tab Actions.
3. Pilih Build TABUNGAN ANAK JB APK.
4. Tekan Run workflow.
5. Tunggu proses build selesai.
6. Download artifact tabungan-anak-jb-apk.

## Build lokal

```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

## Catatan

- Data disimpan secara lokal di perangkat.
- Login menggunakan username saja, bukan autentikasi aman.
- Jangan menyimpan kata sandi atau informasi rahasia.
- Pengingat salat membutuhkan izin notifikasi Android.
- Periksa kembali jadwal dan lokasi salat yang dipilih.
- 
