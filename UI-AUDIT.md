# Audit UI Pitlane — penyederhanaan antarmuka

Lingkup: penyempurnaan UI Next.js/Tailwind yang sudah ada. Palet Pitlane dipertahankan: #FF4F28, #2563EB, #06B6D4, #0F172A, #F8FAFC. Mode Operate: fokus pada percakapan, bukan dekorasi.

## Perbaikan

- Tutup sidebar hanya di sidebar. Buka sidebar muncul di header hanya ketika sidebar tertutup.
- Hapus logo, badge aktif, roster mini, dan breadcrumb berlapis yang berulang di header.
- Satu judul chat; pencarian, Memory, tim, dan ekspor tetap tersedia.
- Sidebar tetap daftar proyek/chat sederhana. Pencarian isi pesan memakai satu entry point di header.
- Panel tim menjadi daftar agent: akun, model, status, kuota, serta reconnect. Hapus kartu bersarang dan label CLI/status/mode yang berulang.
- Composer memakai satu pilihan tujuan, satu pilihan pencatatan Project Memory, satu aksi Kirim/Hentikan. Input dan pesan menjadi lebih terbaca.
- Pesan AI tidak dibungkus kartu pada setiap balasan; identitas agent memakai nama konfigurasi aktual. Kuota dikelola di panel tim, bukan diulang pada setiap pesan.
- Empty state menjadi petunjuk kerja ringkas, tanpa hero promosi atau kartu contoh bertingkat.
- Label kecil dinaikkan ke ukuran standar. Monospace tidak lagi dipakai sebagai dekorasi pada kontrol.
- Memory memakai dialog Radix untuk fokus keyboard/Escape, dengan satu tombol tutup header.
- Clipboard melaporkan kegagalan dengan benar. Scroll mengikuti pesan baru hanya ketika pembaca masih di bagian bawah; pencarian tetap mempertahankan posisi target.
- State fokus, seleksi teks, caret, reduced motion, dan target sentuh memakai sistem yang sama.

## Verifikasi dan batas

- 54 tes backend/API lulus.
- TypeScript lulus.
- Pemindaian sumber Impeccable pada 21 komponen tidak menemukan anti-pattern regex; ada advisory ukuran literal terkait ramp DESIGN.md lama. Pemindaian sumber tidak menjalankan pemeriksaan kontras/layout hasil render.
- DESIGN.md masih mendokumentasikan tema lama yang berbeda dari brief palet pengguna. Untuk tugas ini, palet pengguna dan token CSS aktif menjadi otoritas; dokumen lama tidak dipakai untuk mengubah warna.
- Pemeriksaan browser desktop/mobile tidak dijalankan: pengaturan izin browser tersimpan menolak origin localhost. Tidak ada screenshot baru atau klaim verifikasi visual runtime.
- Fitur proyek, drag/drop, pemilihan agent, pencarian, hapus proyek dengan DELETE, hapus chat terakhir, ekspor, absen, dan kedua jenis memori tetap tersedia.

Panduan yang dipakai: Impeccable 4.8.0, context, audit, distill, Operate, craft-floor. Instalasi global tersedia untuk giliran berikutnya.
