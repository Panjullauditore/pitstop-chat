import {MAX_MEMORY_CHARACTERS} from './src/lib/memory-limits.mjs';
export const AUTO_MARKER = '<!-- PITLANE_AUTO_MEMORY -->';
export const POLICY_MARKER = '## Gaya diskusi dan memori otomatis';
export const TEAM_AUTONOMY_POLICY = 'Address routine questions, reviews, and differences of opinion to the other agents first. The team may continue without the General Manager while working within the authorized scope. Set needsUser=true only when an essential decision or approval belongs to the GM and the affected work genuinely cannot proceed safely without it. Address the GM directly with one concise question, why it blocks progress, and the recommended option. A disagreement by itself is not a reason to stop. Never treat silence as approval.';
export const COMMUNICATION_POLICY = `${POLICY_MARKER}
- Jawab langsung ke inti, biasanya 2–4 kalimat dan maksimal sekitar 75 kata. Jangan mengulang konteks, pujian, atau kesimpulan yang sama. Lebih panjang hanya jika user memintanya.
- AI menentukan apakah diskusi masih perlu dilanjutkan. Berhenti ketika sepakat, tidak ada tambahan berguna, atau perlu keputusan user. User tidak perlu mengatur jumlah putaran.
- Hemat jatah: satu balasan hanya membawa ide baru, koreksi, atau keputusan yang perlu dibahas. Batas internal tetap mencegah percakapan berulang tanpa hasil.
- Soul diperbarui otomatis dari arahan user dan checkpoint singkat balasan, tanpa memanggil AI tambahan untuk merangkum.
- Pisahkan arahan user, usulan AI, dan laporan progres. Klaim progres dari percakapan belum dianggap terverifikasi atau pekerjaan selesai di Studio.
- Keputusan inti user tidak ditimpa oleh pembaruan otomatis. Riwayat revisi tetap disimpan; catatan lama di bagian otomatis bisa diringkas/diganti oleh konteks terbaru.
`;

export function visibleReply(text) {
  return String(text).replace(/\s*<pitlane>[\s\S]*$/i,'').trim();
}

export function parseAttendanceReply(text){
  const reply=String(text).trim();
  if(!/^(?:Hadir, Siap Melanjutkan Project|Present, Ready to Continue Project) [^\r\n]{1,120}$/.test(reply))throw new Error('Format absen tidak sesuai. Agent harus menyebut proyeknya dalam satu kalimat absen saja.');
  return reply;
}

export function parseReply(text) {
  const source=String(text);
  const match=source.match(/<pitlane>\s*([\s\S]*?)\s*<\/pitlane>\s*$/i);
  let control=null;
  if(match)try{
    const value=JSON.parse(match[1]);
    if(typeof value.continue==='boolean' && typeof value.needsUser==='boolean'){
      const short=(key,max)=>typeof value[key]==='string' ? value[key].trim().slice(0,max) : '';
      control={continue:value.continue&&!value.needsUser,needsUser:value.needsUser,summary:short('summary',260),next:short('next',160),reportedProgress:short('reportedProgress',240)};
      if(value.disagreement===true)control.disagreement=true;
      if(typeof value.question==='string')control.question=short('question',1000);
      const memory=value.projectMemory;
      if(memory&&Number.isInteger(memory.baseRevision)&&memory.baseRevision>0&&typeof memory.content==='string'&&memory.content.trim()&&memory.content.length<=MAX_MEMORY_CHARACTERS&&!memory.content.includes(AUTO_MARKER)){
        control.projectMemory={baseRevision:memory.baseRevision,content:memory.content.trim()};
      }
    }
  }catch{}
  const reply=visibleReply(source);
  if(!reply)throw new Error('Agent mengembalikan checkpoint tanpa jawaban untuk user.');
  return {text:reply,control};
}

export function stripAutomaticMemory(content) { return String(content).split(AUTO_MARKER)[0].trim(); }
export function composeSoul(value) {
  const auto=value.auto || {};
  const notes=(auto.userNotes || []).map(note=>`- [${note.at}] Arahan user: ${note.text}`).join('\n');
  const updates=(auto.updates || []).map(item=>`- [${item.at}] ${item.agent}: ${item.summary || 'Checkpoint percakapan.'}${item.next ? '\n  Langkah/usulan berikutnya: '+item.next : ''}${item.reportedProgress ? '\n  Laporan progres BELUM DIVERIFIKASI: '+item.reportedProgress : ''}`).join('\n');
  const decisions=(auto.gmDecisions || []).map(item=>`- [${item.at}] Keputusan final user / General Manager: ${item.text}`).join('\n');
  return stripAutomaticMemory(value.soul.content)+'\n\n'+AUTO_MARKER+'\n## Memori perkembangan otomatis\nBagian ini diperbarui app. Arahan di sini adalah kutipan percakapan; usulan AI bukan keputusan final dan laporan progres bukan bukti verifikasi Studio.\n\n### Arahan user terbaru\n'+(notes || 'Belum ada arahan baru yang tercatat otomatis.')+'\n\n### Checkpoint diskusi terbaru\n'+(updates || 'Belum ada checkpoint baru.')+'\n'+(decisions?'\n### Keputusan final General Manager\n'+decisions+'\n':'');
}
