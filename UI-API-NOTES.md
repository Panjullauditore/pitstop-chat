# Pitstop — kontrak memori, sesi dan CLI

Frontend Next.js: `127.0.0.1:4317`. Backend API: `127.0.0.1:4318`. Halaman utama backend mengarahkan ke frontend. Mutasi memakai `X-Room-Token`; mutasi konteks juga mengirim `X-Room-Session` untuk mencegah penulisan dari tab tertinggal.

## Soul Memory: cara berkomunikasi

Soul Memory adalah preferensi komunikasi global pengguna: bahasa, nada, panjang jawaban, cara menjelaskan, dan kebiasaan respons. Disimpan terpisah di `data/communication/brain.json`, dengan riwayat revisi. Seluruh proyek/sesi dan akun CLI membaca Soul yang sama. Percakapan, pin, dan checkpoint tidak menulis ke Soul.

`POST /api/soul`: `{content, revision}`, mengembalikan `{brain}` dengan `brain.soul` sebagai Soul komunikasi terkini. Revisi lama ditolak.

## Project Memory: konsep dan perkembangan

Project Memory menyimpan konsep inti dan keputusan yang diedit user, pin pesan yang dipilih user, arahan user terbaru, serta checkpoint AI. Checkpoint dan laporan progres dipisahkan dari konsep utama; usulan AI bukan keputusan final atau bukti pekerjaan terverifikasi.

- Penyimpanan proyek: `data/memories/<projectId>/brain.json`, dipakai bersama semua sesi proyek.
- Chat tanpa proyek: `data/memories/<sessionId>/brain.json`, khusus chat itu.
- `POST /api/project-memory`: `{content, revision, scopeId}`, mengembalikan `{projectMemory}`. Batas core dapat diatur per scope dari 1.000 sampai 100.000 karakter (default 18.000). `scopeId` memproteksi editor jika chat dipindahkan ke proyek berbeda saat dibuka. Revisi basi ditolak.
- `POST /api/pin`: `{messageId}`, menyimpan pesan selesai ke Project Memory, mengembalikan `{projectMemory}`.
- `syncMemory` pada `/api/send` mengatur pencatatan otomatis Project Memory, tanpa mengubah Soul komunikasi.
- `GET /api/brain/export`: cadangan Soul komunikasi dan Project Memory aktif. Token dibutuhkan.

Snapshot bootstrap/SSE memuat `brain.soul` (komunikasi), `projectMemory` (konsep/perkembangan), serta `projects`, `sessions`, `sessionId`, `enabledAgentIds`, transkrip dan status CLI. `projectMemory` memuat `scopeId`, `scopeName`, `shared`, `projectId`, `content`, `revision`, `updatedAt`, `pinnedIds`, dan `auto`.

Saat upgrade, konsep/pin/catatan otomatis dari Brain lama disalin ke Project Memory baru. Bagian komunikasi yang dikenali dimigrasikan ke Soul global. Dokumen Brain sesi lama dan arsip tidak dihapus. Ekstraksi legacy bersifat konservatif; sumber lama tetap tersedia untuk pemulihan.

## Akun dan prompt

Pada setiap giliran, aplikasi memberikan Soul komunikasi dan Project Memory aktif sebagai dua bagian terpisah. Keduanya disimpan lokal dalam aplikasi dan tidak bergantung pada ingatan pribadi akun CLI. Mengganti akun tidak menghapus data. Agent juga menerima kutipan relevan/terbaru dari sesi lain dalam proyek yang sama; riwayat panjang ditandai terpotong. Proyek lain tidak disertakan.

Absen membaca nama proyek dari Project Memory. Pengaturan model dan nama pengguna tetap mengikuti pengguna saat beralih sesi. Pilihan peserta mengikuti proyek atau subset sesi. CLI yang tidak terpasang/tidak login ditampilkan jujur. Persentase kuota dan email hanya ditampilkan jika provider melaporkannya.

## Proyek dan sesi

- `/api/projects/new`: `name`, `agentIds`; membuat proyek dan chat pertama.
- `/api/projects/update`: `projectId`, `name`, `agentIds`.
- `/api/projects/open`: `projectId`.
- `/api/projects/move`: `sessionId`, `projectId` (null untuk Terbaru). Chat memakai Project Memory tujuan, sementara dokumen memori lama tetap tersimpan.
- `/api/projects/session-agents`: `sessionId`, `agentIds` (null mengikuti proyek).
- `/api/projects/delete`: `projectId`, `confirmation: "DELETE"` persis. Sesi dipindahkan ke Terbaru dengan salinan Project Memory dan peserta efektif dipertahankan.
- `/api/sessions/new`, `/switch`, `/rename`, `/import`: mutasi sesi; respons `{state}`.
- `DELETE /api/sessions/:id`: mengeluarkan sesi dari daftar. Jika terakhir, buat chat kosong pengganti terlebih dahulu. Soul global dan Project Memory proyek tidak terhapus.

Indeks berada di `data/sessions.json`; transkrip awal tetap di `data/room.json`, transkrip baru di `data/sessions/<id>/room.json`. Sesi yang dihapus tetap memiliki berkas arsip. Migrasi riwayat browser idempoten.

Endpoint lain: `/api/bootstrap`, `/events`, `/send`, `/stop`, `/attendance`, `/models`, `/reconnect`, `/agents`, `/settings`, `/profile`, `/quota`, `/export`. Source CLI: bantuan CLI lokal, [OpenAI non-interactive mode](https://developers.openai.com/codex/noninteractive), dan [Claude CLI reference](https://code.claude.com/docs/en/cli-reference).

## Pembaruan rangkuman dan arsip

- `POST /api/project-memory/summary/settings`: `{scopeId, autoEnabled, agentId}`. Agent perangkum tidak mengubah penugasan PM.
- `POST /api/project-memory/summary/limit`: `{scopeId, maxCharacters}`. Batas yang lebih kecil dari isi tersimpan ditolak tanpa memotong teks.
- `POST /api/project-memory/summary/update` dan `/stop`: `{scopeId}`. Revisi dan identitas proyek diperiksa sebelum rangkuman disimpan.
- Penanda pesan per sesi memastikan pembaruan berikutnya melanjutkan diskusi yang belum tercakup.
- Status arsip abu-abu berarti belum dikonfirmasi masuk core; hijau berarti versi catatan tersebut telah diakui dalam rangkuman tersimpan. Catatan hijau dibersihkan pada 00.00 WIB berikutnya; chat asli dan penanda tetap ada.

## Verifikasi

`npm test` mencakup isolasi proyek, memori bersama, Soul global yang tidak tercampur konsep, migrasi pin, persistensi setelah restart, pemilihan agent, konfirmasi DELETE, API HTTP/SSE, dan perubahan akun/model. `npm run build` memverifikasi frontend dan TypeScript. Tes HTTP membutuhkan koneksi localhost.
