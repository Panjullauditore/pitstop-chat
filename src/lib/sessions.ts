import { SessionData, ChatMessage, SoulData } from "./types";

export const SESSIONS_STORAGE_KEY = "ai_room_sessions_v2";
export const ACTIVE_SESSION_ID_KEY = "ai_room_active_session_id_v2";
export const CUSTOM_AGENTS_STORAGE_KEY = "ai_room_custom_agents_v1";

export const DEFAULT_NEUTRAL_SOUL = `# Ruang Diskusi Proyek — Soul Sesi

## Identitas dan Tujuan Proyek
Ruang kerja kolaboratif untuk mendiskusikan arsitektur sistem, desain teknis, dan pengambilan keputusan proyek bersama tim dan AI agent. Fokus pada solusi yang jelas, terukur, dan dapat diimplementasikan.

## Keputusan Utama User
- Seluruh keputusan arah proyek, arsitektur inti, dan perubahan besar ditentukan oleh user.
- Usulan dan alternatif dari AI berfungsi sebagai masukan pembanding sebelum diambil kesepakatan.
- Jaga kesederhanaan desain dan hindari over-engineering pada tahap awal.

## Keadaan Pekerjaan yang Telah Dikonfirmasi
- Catat modul, komponen, atau spesifikasi yang sudah diselesaikan dan diverifikasi.

## Tahap Berikutnya
- Tentukan langkah konkret yang akan diselesaikan pada sesi kerja berikutnya.

## Gaya diskusi dan memori otomatis
- Jawab langsung ke inti, biasanya 2–4 kalimat dan maksimal sekitar 75 kata. Jangan mengulang konteks, pujian, atau kesimpulan yang sama. Lebih panjang hanya jika user memintanya.
- AI menentukan apakah diskusi masih perlu dilanjutkan. Berhenti ketika sepakat, tidak ada tambahan berguna, atau perlu keputusan user. User tidak perlu mengatur jumlah putaran.
- Hemat jatah: satu balasan hanya membawa ide baru, koreksi, atau keputusan yang perlu dibahas. Batas internal tetap mencegah percakapan berulang tanpa hasil.
- Soul diperbarui otomatis dari arahan user dan checkpoint singkat balasan, tanpa memanggil AI tambahan untuk merangkum.
- Pisahkan arahan user, usulan AI, dan laporan progres. Klaim progres dari percakapan belum dianggap terverifikasi atau pekerjaan selesai di Studio.
- Keputusan inti user tidak ditimpa oleh pembaruan otomatis. Riwayat revisi tetap disimpan; catatan lama di bagian otomatis bisa diringkas/diganti oleh konteks terbaru.
`;

export function loadStoredSessions(initialMessages?: ChatMessage[], initialSoul?: SoulData): { sessions: SessionData[]; activeId: string } {
  if (typeof window === "undefined") {
    return {
      sessions: [
        {
          id: "session-default",
          title: "Sesi Diskusi Proyek",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: initialMessages || [],
          soul: {
            content: initialSoul?.content || DEFAULT_NEUTRAL_SOUL,
            revision: initialSoul?.revision || 1,
            updatedAt: initialSoul?.updatedAt || new Date().toISOString(),
          },
        },
      ],
      activeId: "session-default",
    };
  }

  let sessions: SessionData[] = [];
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (raw) {
      sessions = JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Gagal membaca riwayat sesi dari localStorage:", err);
  }

  if (!Array.isArray(sessions) || sessions.length === 0) {
    sessions = [
      {
        id: "session-default",
        title: "Sesi Diskusi Proyek",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: initialMessages ? [...initialMessages] : [],
        soul: {
          content: initialSoul?.content || DEFAULT_NEUTRAL_SOUL,
          revision: initialSoul?.revision || 1,
          updatedAt: initialSoul?.updatedAt || new Date().toISOString(),
        },
      },
    ];
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    } catch {}
  } else if (initialMessages && initialMessages.length > 0) {
    // Keep default session in sync with initial messages if default session was empty
    const defaultSess = sessions.find((s) => s.id === "session-default");
    if (defaultSess && (!defaultSess.messages || defaultSess.messages.length === 0)) {
      defaultSess.messages = [...initialMessages];
    }
  }

  let activeId = localStorage.getItem(ACTIVE_SESSION_ID_KEY) || "session-default";
  if (!sessions.some((s) => s.id === activeId)) {
    activeId = sessions[0].id;
  }

  return { sessions, activeId };
}

export function saveSessionsToStorage(sessions: SessionData[], activeId?: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    if (activeId) {
      localStorage.setItem(ACTIVE_SESSION_ID_KEY, activeId);
    }
  } catch (err) {
    console.warn("Gagal menyimpan riwayat sesi ke localStorage:", err);
  }
}
