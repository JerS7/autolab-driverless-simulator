# AutoLab — Tutorial Simulator Transportasi Driverless

Simulator edukasi berbahasa Indonesia. HTML, CSS, dan JavaScript; tanpa database, akun, API key, atau proses build. Semua status perjalanan berada di memori dan hilang saat halaman dimuat ulang.

## Menjalankan

Klik dua kali **Mulai Simulator.cmd** (membutuhkan Node.js), atau jalankan `node server.cjs` dari folder ini, lalu buka http://127.0.0.1:4173. Tutup terminal untuk menghentikan server. Alternatif: buka `index.html` langsung dengan internet aktif; jika browser membatasi permintaan API dari file lokal, gunakan server.

## Tutorial penggunaan

1. Pilih titik keberangkatan dan tujuan berbeda di Jakarta.
2. Tekan **Hitung rute** dan tunggu jalur hijau muncul.
3. Atur batas kecepatan 10–60 km/jam. Pilih waktu 1×, 5×, atau 20×.
4. Tekan **Mulai**. Amati jarak, kecepatan, waktu simulasi, dan posisi kendaraan.
5. Sisipkan **Lampu merah**, **Pejalan kaki**, atau **Hambatan jalan** saat berjalan. Satu kejadian aktif pada satu waktu; dinonaktifkan pada 100 meter terakhir agar ada ruang pengereman.
6. Sistem mengerem sebelum titik kejadian, menunggu 8 / 6 / 12 detik simulasi, lalu melanjutkan. Kondisi aman tersebut merupakan skenario buatan.
7. Coba **Jeda**, **Lanjutkan**, **Berhenti darurat**, dan **Reset**. Perjalanan otomatis dijeda ketika tab disembunyikan.
8. Ikuti lima langkah tutorial di bawah peta dan periksa log keputusan.

## Cara kerja

- [Leaflet 1.9.4](https://leafletjs.com/examples/quick-start/) menampilkan peta; library disimpan di `vendor`.
- [OpenStreetMap](https://www.openstreetmap.org/copyright) menyediakan tile peta daring dengan atribusi tetap terlihat.
- [OSRM Route API](https://project-osrm.org/docs/v5.24.0/api/#route-service) mengembalikan geometri jalan: `https://router.project-osrm.org/route/v1/driving/{lon,lat};{lon,lat}?overview=full&geometries=geojson`.
- Panjang jalur dihitung dari segmen koordinat; kendaraan diinterpolasi sepanjang jalur tersebut. Akselerasi model 2 m/s², perlambatan 3 m/s². Integrasi menggunakan sublangkah maksimum 0,025 detik simulasi agar percepatan waktu tidak melewati titik berhenti.
- Jarak pengereman ditentukan dengan `v² / (2a)`. Sensor virtual memberi kejadian di depan kendaraan. Kendaraan berhenti sebelum penanda kejadian dan melanjutkan setelah waktu tunggu selesai.
- Berhenti darurat adalah penghentian simulator seketika, bukan model pengereman fisik. Kecepatan tidak memperhitungkan belokan, batas jalan aktual, atau kendaraan lain.
- Data tidak disimpan ke localStorage atau database. Koordinat rute dikirim ke OSRM; tile peta diminta ke OpenStreetMap. Layanan publik membutuhkan internet dan tidak menjamin ketersediaan. Gagal mengambil rute menampilkan pesan dan tidak membuat jalur palsu.

Ini model aturan sederhana untuk pembelajaran persepsi → perencanaan → kontrol, bukan sistem AI pengemudi nyata, navigasi langsung, atau perangkat kendali kendaraan.

## Struktur

- `index.html` — antarmuka dan tutorial.
- `style.css` — tampilan responsif desktop dan ponsel.
- `app.js` — peta, API rute, simulasi, kontrol, tutorial, dan log.
- `server.cjs` — server lokal tanpa dependensi npm, hanya melayani aset aplikasi.
- `vendor/` — Leaflet (lisensi BSD-2-Clause, lihat LICENSE.txt).

Halaman juga mendaftarkan alat baca status bila browser mendukung WebMCP; fitur ini opsional dan tidak diperlukan untuk penggunaan biasa.

## Verifikasi

Jalankan `node test.cjs` untuk pengujian model dengan respons API tiruan: rute, jeda/lanjut, darurat, tiga skenario berhenti dan lanjut, kedatangan, reset, tujuan sama, serta kegagalan API. Semua skenario lulus pada pemeriksaan pembuatan.

Uji browser juga berhasil memuat tile peta dan rute OSRM Monas → Bundaran HI, menjalankan kendaraan, menyisipkan pejalan kaki, menghentikan darurat, mereset, dan berpindah langkah tutorial. Alat WebMCP baca status berhasil dipanggil.
