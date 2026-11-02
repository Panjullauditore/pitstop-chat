# Pitlane — One Room. One Team. One Goal.

Aplikasi ruang diskusi kolaboratif untuk pengguna, Codex, Antigravity, dan Claude. Menggunakan arsitektur modern berbasis **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, dan **shadcn/ui**, dengan backend Node.js untuk mengeksekusi CLI resmi yang terpasang secara lokal di sistem Anda.

---

## 🚀 Menjalankan Aplikasi di Windows

### Cara Termudah (Otomatis)
1. Klik dua kali berkas **`Start Pitlane.cmd`** di folder project.
2. Launcher akan otomatis:
   - Memastikan backend Node.js aktif di `127.0.0.1:4318`.
   - Menjalankan Next.js frontend di `http://127.0.0.1:4317`.
   - Membuka peramban secara otomatis ke alamat **`http://127.0.0.1:4317`**.

---

### Cara Manual (Terminal)

#### 1. Mode Production (Rekomendasi)
Jalankan perintah berikut:
```bash
# Build aplikasi Next.js jika ada perubahan
npm run build

# Menjalankan launcher ganda (backend + frontend production)
node launch.mjs
```
Akses di browser: <http://127.0.0.1:4317>

#### 2. Mode Development (Hot Reloading)
Jika ingin melakukan pengeditan antarmuka dengan reload instan:
- **Terminal 1 (Backend Server)**:
  ```bash
  $env:ROOM_PORT="4318"; $env:FRONTEND_PORT="4317"; node server.mjs
  ```
- **Terminal 2 (Next.js Dev Server)**:
  ```bash
  $env:ROOM_BACKEND_PORT="4318"; npm run dev
  ```
Buka: <http://127.0.0.1:4317>

#### 3. Menjalankan Pengujian Backend
```bash
npm test
```
Menjalankan seluruh 60 pengujian unit dan integrasi HTTP (`node --test test/*.test.mjs`).

## Lampiran file dan foto

Klik ikon paperclip pada kolom pesan, seret file ke kolom tersebut, atau paste foto dari clipboard. Thumbnail dapat diperiksa dan dilepas sebelum dikirim. Pesan boleh hanya berisi lampiran. Batasnya 5 file per pesan dan 10 MB per file.

Format yang didukung: PNG, JPG, WebP, GIF (frame pertama), PDF berisi teks, DOCX, serta file teks/kode seperti TXT, Markdown, CSV, JSON, TS/JS, Python, dan Luau. PDF scan tanpa teks ditolak dengan petunjuk mengunggah halamannya sebagai foto. PDF dibatasi 30 halaman pertama; teks tiap file maksimal 24.000 karakter, dengan pemberitahuan bila dipotong.

File asli dan versi gambar untuk AI tersimpan di `data/uploads/`. Riwayat hanya menyimpan metadata; endpoint unduh/preview memerlukan token lokal. Lampiran tidak dapat dipakai sebagai input agent dari sesi lain. Setiap giliran menyertakan maksimal 5 lampiran terbaru dalam sesi, termasuk saat bertanya lanjutan atau setelah restart/mengganti akun.

Codex menerima gambar lewat `exec --image`; Claude lewat blok gambar base64 pada input stream JSON. Antigravity headless hanya menerima teks, sehingga adapter secara eksplisit meminta `view_file` pada path foto upload. Tes pengenalan gambar dengan angka acak dan bentuk berwarna sudah berhasil pada Codex dan Antigravity yang terpasang. Claude memerlukan instalasi/login sebelum tes langsung. Referensi: [Codex CLI](https://learn.chatgpt.com/docs/cli/reference), [Antigravity headless](https://antigravity.google/docs/cli/headless), [Claude streaming input](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode).

Tes visual CLI bersifat opt-in dan memakai akun CLI asli, tanpa membuat pesan di chat pengguna:

```bash
node test/vision-smoke.mjs
```

---

## 🧩 Arsitektur & Komponen

Aplikasi telah dimigrasikan secara penuh ke Next.js App Router dengan pemecahan komponen modular:

- **Sidebar (`src/components/room/Sidebar.tsx`)**: Navigasi utama, brand neutral, tombol *Sesi Baru*, profil pengguna, daftar riwayat sesi, dan daftar agent aktif.
- **Session History (`src/components/room/SessionHistory.tsx`)**: Daftar percakapan lama, judul, waktu update berformat WIB, counter pesan, dan tombol hapus dengan konfirmasi aman.
- **Delete Session Alert (`src/components/room/DeleteSessionAlert.tsx`)**: Menggantikan `window.confirm()` dengan shadcn `AlertDialog` yang memiliki tombol **Batal** dan tombol merah **Hapus Percakapan**.
- **Chat Messages (`src/components/room/ChatMessages.tsx`)**: Transkrip percakapan real-time dengan streaming SSE, indikator kursor mengetik, penyorot sintaksis kode, dan tombol *Simpan ke Project Memory*.
- **Composer (`src/components/room/Composer.tsx`)**: Textarea responsif auto-grow, pemilih mode (diskusi otomatis hemat kuota, semua agent, atau agent tertentu), tombol Stop respons instan, dan hint keyboard.
- **Agent Card (`src/components/room/AgentCard.tsx`)**: Menampilkan nama agent, avatar, model/effort, badge status *Connected* / *Disconnected* nyata, tombol limit, dan tombol pintas Reconnect.
- **Quota Popover (`src/components/room/QuotaPopover.tsx`)**: Popover sisa kuota dengan bilah kemajuan, waktu reset WIB, penanganan sisa limit kritis $\le 5\%$, dan label jujur *"Tidak tersedia"* jika provider belum melaporkan data.
- **Reconnect Dialog (`src/components/room/ReconnectDialog.tsx`)**: Dialog petunjuk login CLI resmi dan tombol *Hubungkan Otomatis* untuk mendeteksi ulang CLI dan akun lokal.
- **Model Selector Dialog (`src/components/room/ModelSelectorDialog.tsx`)**: Konfigurasi model aktif dan reasoning effort per provider dengan tombol refresh akun/model.
- **Memory Drawer (`src/components/room/SoulMemoryDrawer.tsx`)**: Dua editor terpisah: Project Memory untuk konsep/perkembangan proyek, dan Soul Memory global untuk cara berkomunikasi dengan agent.
- **Attendance Dialog (`src/components/room/AttendanceDialog.tsx`)**: Panel verifikasi kehadiran yang secara eksklusif hanya menampilkan jawaban:
  `Hadir, Siap Melanjutkan Project [nama project dari Project Memory]`
- **Profile Dialog (`src/components/room/ProfileDialog.tsx`)**: Form penggantian nama tampilan pengguna yang tersinkronisasi ke profil sesi.

---

## 🔒 Keamanan & Data Pengguna

- **Data Persisten**: Seluruh riwayat percakapan (`data/room.json`), memori Soul (`data/brain.json`), serta cadangan sesi browser lama (`localStorage`) **tetap dipertahankan dan tidak terhapus**.
- **Origin & Port**: Port `4317` dipertahankan sehingga penyimpanan `localStorage` lama langsung terbaca tanpa kehilangan data.
- **Proxy Aman**: Next.js me-rewrite endpoint `/api/:path*` ke backend Node.js lokal (`127.0.0.1:4318`), menjaga isolasi jaringan agar tidak terbuka ke publik.
- **Sanitasi Konten**: Seluruh input dan balasan pesan AI di-escape sebelum dirender ke HTML.
- **Kejujuran Fitur**: Status koneksi, angka kuota, dan ketersediaan provider (seperti Claude yang membutuhkan instalasi dan login CLI) ditampilkan secara akurat tanpa manipulasi data.


## Sinkronisasi backend setelah redesign

Sesi, judul, transkrip, Soul, pin, dan absen kini disimpan server. Sesi baru berada di `data/sessions/<id>/`; indeksnya di `data/sessions.json`. Riwayat browser lama dimigrasikan tanpa menghapus cadangan. Hapus sesi mengeluarkannya dari daftar, dengan berkas arsip tetap tersedia untuk pemulihan manual.

Kartu agent menampilkan status akun CLI dan email bila provider menyediakannya. Codex dan Antigravity telah diuji menggunakan balasan CLI asli. Adapter Claude sudah tersedia, tetapi CLI harus dipasang dan login sebelum dapat dipakai; kuota persentasenya tidak tersedia. Satu agent per provider dapat dikonfigurasi melalui Tambah Agent. Integrasi Direct API belum tersedia.

Lihat [UI-API-NOTES.md](UI-API-NOTES.md) untuk kontrak endpoint dan batas dukungan.


## Proyek, chat, dan peserta

Tombol menu di header membuka/menutup sidebar pada desktop maupun ponsel. **Proyek Baru** membuat proyek dan chat pertamanya; **Sesi Baru** membuat chat di luar proyek. Tombol plus di judul proyek membuat chat langsung di proyek itu.

Seret baris chat ke kotak proyek untuk memindahkannya. Pilihan proyek di bawah judul chat menyediakan alternatif pada ponsel atau tanpa drag. Ikon pengaturan di judul proyek mengatur nama serta provider yang boleh ikut. Ikon pengaturan pada chat memilih sebagian agent proyek, atau mengikuti pilihan proyek secara otomatis.

Agent menerima kutipan relevan/terbaru dari sesi lain di proyek yang sama beserta kutipan konteks/checkpoint. Riwayat panjang diberi penanda pemotongan; proyek lain dan chat di luar proyek tidak ikut dalam konteks tersebut.


## Project Memory dan Soul Memory

**Project Memory** menyimpan konsep dan keputusan utama, pin pesan, arahan user, serta checkpoint perkembangan. Semua sesi dalam satu proyek memakai dokumen yang sama di `data/memories/<projectId>/brain.json`. Chat di luar proyek memakai dokumen khusus per chat. Mengganti akun CLI tidak mengubah dokumen aplikasi ini.

**Soul Memory** mengatur bahasa, nada, panjang jawaban, dan cara berkomunikasi AI. Berlaku global di `data/communication/brain.json`, terpisah dari konsep proyek. Checkpoint dan percakapan tidak mengubahnya.

Bahasa default aplikasi dan respons agent adalah English. Pilih English atau Bahasa Indonesia melalui **Settings → Language**. Preferensi bahasa disimpan global, berlaku pada permintaan agent berikutnya, dan mengikuti semua sesi serta akun. Isi catatan Soul tetap dipertahankan: aturan bahasa terkelola ditambahkan saat konteks dikirim ke agent, pada unduhan Soul Markdown, dan di `data/communication/SOUL.md`. Permintaan bahasa eksplisit pada pesan terbaru mengalahkan default ini. Mengganti bahasa tidak menerjemahkan riwayat chat atau mengubah Project Memory.

Data lama tetap dipertahankan. Konsep/pin/catatan otomatis disalin ke Project Memory baru, sedangkan bagian aturan komunikasi yang dikenali dipindahkan ke Soul global. File Brain sesi lama tetap menjadi arsip. Lihat UI-API-NOTES.md untuk skema terbaru.

## Project Manager dan keputusan General Manager

Proyek baru melalui tiga langkah: nama proyek, satu Project Manager, lalu agent tambahan. PM otomatis menjadi peserta setiap sesi proyek dan tidak dapat dikeluarkan melalui pilihan peserta sesi. Proyek lama dapat menetapkan PM melalui pengaturan proyek.

Untuk proyek dengan PM, tim memberi masukan terlebih dahulu dan PM membaca diskusi terakhir untuk membuat checkpoint resmi ke Project Memory. PM bertugas merencanakan, mengoordinasikan, serta mengawasi jadwal, anggaran, dan spesifikasi berdasarkan data user. Aplikasi tetap berupa ruang diskusi CLI; checkpoint bukan bukti bahwa pekerjaan eksternal sudah dilakukan. Soul Memory global tetap mengatur komunikasi dan gaya penulisan.

Tag di awal pesan (nama bot atau ID provider, misalnya `@DeepSeek Web` atau `@deepseek`) ditujukan hanya ke bot itu. PM tidak ditambahkan otomatis pada pesan langsung, dan PM yang offline tidak memblokir pesan langsung ke bot lain. Pengurutan tim lalu PM serta checkpoint resmi PM berlaku untuk Team (All).

Checkpoint `disagreement:true` atau `needsUser:true` menghentikan giliran berikutnya dan menyimpan pertanyaan keputusan di proyek. Semua sesi proyek diblokir untuk diskusi lanjutan sampai pemilik mengirim keputusan lewat panel General Manager dengan ID keputusan yang sesuai. Keputusan final disimpan, ditampilkan di Project Memory, dan dimasukkan ke prompt berikutnya. Agent diminta menerima keputusan user, dan tidak boleh membuka ulang perdebatan tanpa informasi baru atau permintaan user. Deteksi perdebatan bergantung pada checkpoint terstruktur dari CLI; penghentian setelah checkpoint diterima ditegakkan oleh backend dan diuji lintas sesi/restart.

## Linked App Chat (Codex / Antigravity)

Menu **… pada proyek → Linked App Chat** memilih chat native yang sudah ada. Cari judul chat dan periksa foldernya sebelum Save links. Tautan berlaku untuk semua sesi proyek; satu chat native tidak dapat ditautkan ke dua proyek Pitlane. Melepaskan tautan mempertahankan riwayat aplikasi dan mengembalikan pengiriman berikutnya ke adapter diskusi biasa. Tautan tidak dapat diubah selama diskusi proyek berjalan.

Codex memakai `app-server --stdio`, `thread/read`, `thread/resume` dengan ID yang sama, lalu `turn/start`. Tidak memakai `thread/start`, fork, atau session ephemeral pada jalur ini. Model mengikuti chat native, bukan pemilih model global Pitlane. Prompt yang tersimpan di history native mencakup konteks komunikasi/proyek dan instruksi checkpoint Pitlane; bukan hanya teks pendek yang diketik user. Balasan dan status riwayat disiarkan lewat SSE. Native App mungkin perlu membuka ulang chat atau menyegarkan daftar: konektor memakai proses app-server terpisah, bukan subscription daemon App. Hindari mengirim bersamaan dari Pitlane dan App pada chat yang sama.

Tes aktual 2 November 2026 pada Garage Town Konsep ditolak dengan `already has an active writer`: App masih memegang chat tersebut, sehingga konektor terpisah belum bisa mengirim. Tautan tersimpan, tetapi pengiriman native dan akses MCP Codex pada chat ini belum terverifikasi. Jangan menghapus lock atau menghentikan App untuk memaksakan pengambilalihan. Pemantauan bersamaan memerlukan koneksi bersama ke app-server yang memegang chat, yang belum tersedia pada konektor ini.

Pada chat Codex yang ditautkan, agent boleh menggunakan MCP miliknya untuk tugas eksplisit user pada putaran pertama. Giliran diskusi otomatis berikutnya tidak memberikan izin tugas baru; absen tetap tanpa tool. Permintaan approval atau input interaktif Codex tidak disetujui otomatis: Pitlane menghentikan giliran dan meminta user melanjutkan di aplikasi asal. Stop mengirim `turn/interrupt` ke ID giliran yang sama.

**Antigravity App memakai penghubung Remote Control, bukan CLI copy.** Tes CLI aktual ke chat asli mengembalikan `trajectory not found`. Pilih chat native dan URL Remote Control melalui Linked App Chat; pairing App dilakukan terpisah di Pitlane Bridge agar dapat memakai profil Chrome berbeda dari DeepSeek. Model dan persetujuan alat mengikuti App, bukan pengaturan CLI Pitlane. Agent boleh menggunakan MCP App untuk tugas eksplisit user pada putaran pertama; giliran diskusi otomatis berikutnya tidak memberikan izin tugas baru. Absen tetap tanpa tool. Limit CLI tidak ditampilkan sebagai limit akun App.

Folder game Roblox tidak diperlukan. Bila chat tidak punya folder kerja, Pitlane membuat `data/agent-workspaces/<projectId>`. Game tetap diakses lewat MCP milik Antigravity. Pengiriman memakai editor dan tombol Send resmi pada chat yang sama, diberi marker unik, lalu membaca respons baru lewat DOM. Tidak menyalin token akun atau menambal database App. Status Saved memerlukan marker permintaan pada riwayat database asli melalui pemeriksaan read-only. Pertahankan Chrome, tab Remote Control, Antigravity App, Roblox Studio dan backend Pitlane berjalan. Lihat `extension/README.md` untuk pemasangan dan batas pengujian aktual.

Tes konektor memakai proses app-server dan database fixture terisolasi; tidak menambahkan pesan ke chat asli. Sesi tanpa tautan serta provider lain tetap memakai konektor sebelumnya.

## DeepSeek Web dari Chrome aktif

DeepSeek sekarang memakai **Pitlane Bridge** di profil Chrome yang sudah login, bukan profil Playwright terpisah. Extension Codex tetap berguna untuk pemeriksaan oleh Codex, tetapi tidak menjadi konektor backend Pitlane.

Paket extension berada di `extension/`. Baca `extension/README.md`, pasang melalui Load unpacked, lalu buka pengaturan DeepSeek di Pitlane → **Generate pairing code**. Tempel kode sekali pakai pada popup Pitlane Bridge dan pilih Connect. Kode berlaku lima menit. Setelah pemasangan, refresh tab DeepSeek yang sudah login dan biarkan tab itu terbuka. Status Connected baru muncul setelah heartbeat dari extension, bukan sekadar setelah konfigurasi bot disimpan. Tes koneksi tersedia di pengaturan bot; prompt tes tidak menggunakan memory atau menulis transkrip Pitlane.

Bridge membuat tab sementara di profil Chrome yang sama untuk setiap giliran, mengisi konteks lengkap Room (Soul Memory, Project Memory, keputusan GM, riwayat), mengunggah foto bila tersedia, menekan tombol kirim halaman, dan meneruskan stream balasan ke SSE Pitlane. Tab asli tidak digunakan untuk menulis prompt dan tidak ditutup. Tab sementara ditutup setelah selesai/Stop; percakapannya dapat tersimpan di riwayat DeepSeek. Dokumen nonfoto telah masuk sebagai teks hasil ekstraksi. Upload yang tidak tersedia atau gagal menghentikan pengiriman. Model dipilih di browser DeepSeek.

Tidak ada pembacaan cookie, password, atau token akun DeepSeek. Host permission dibatasi ke DeepSeek dan localhost; kode backend hanya dihubungi pada `127.0.0.1:4318`. Credential pairing disimpan di extension-local storage yang dibatasi ke trusted contexts. Backend menyimpan hash-nya saja di `data/browser-bridge.json`. Disconnect mencabut grant; re-pair mengganti grant lama. State, prompt, dan lampiran hanya dikirim ke pemilik request aktif, dan hasil terlambat/duplikat ditolak.

CAPTCHA dan login tetap dilakukan user. Integrasi belum terbukti bekerja pada akun asli sampai extension dipasang dan tes koneksi selesai. Parser/transport dan alur pengiriman diuji dengan fixture terisolasi; tes akun sungguhan tidak dijalankan di CI. Perubahan UI atau protokol DeepSeek dapat memerlukan pembaruan extension. Adapter Playwright terpisah masih tersimpan sebagai kode lama untuk pengujian, tetapi bukan transport default DeepSeek.
