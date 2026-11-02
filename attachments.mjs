import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, extname } from 'node:path';
import sharp from 'sharp';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 5;
const MAX_TEXT = 24000;
const TEXT_EXTENSIONS = new Set('.txt .md .markdown .csv .tsv .json .jsonl .yaml .yml .xml .html .css .scss .js .jsx .mjs .cjs .ts .tsx .py .lua .luau .sql .sh .ps1 .bat .log .ini .toml .rs .go .java .c .h .cpp .hpp .cs .rb .php .svelte .vue .gitignore'.split(' '));
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

function validateDocxArchive(bytes) {
  const end = bytes.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
  if (end < 0 || end + 22 > bytes.length) throw new Error('Arsip DOCX tidak valid.');
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16), expanded = 0;
  if (count > 2000) throw new Error('Dokumen Word memiliki terlalu banyak bagian.');
  for (let i=0;i<count;i++) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset)!==0x02014b50) throw new Error('Arsip DOCX tidak valid.');
    expanded += bytes.readUInt32LE(offset+24);
    if (expanded > 40*1024*1024) throw new Error('Isi dokumen Word setelah dekompresi maksimal 40 MB.');
    offset += 46+bytes.readUInt16LE(offset+28)+bytes.readUInt16LE(offset+30)+bytes.readUInt16LE(offset+32);
  }
}

function validId(id) {
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) throw new Error('ID lampiran tidak valid.');
  return id;
}
function publicAttachment(record) {
  const { id, name, mimeType, size, kind, truncated, notice } = record;
  return { id, name, mimeType, size, kind, truncated, notice };
}

export class AttachmentStore {
  constructor(directory) { this.directory = join(directory, 'uploads'); }
  async create({ name, bytes, sessionId }) {
    if (typeof name !== 'string' || !name.trim() || name.length > 240 || /[\x00-\x1f/\\]/.test(name)) throw new Error('Nama file tidak valid.');
    if (!Buffer.isBuffer(bytes) || !bytes.length) throw new Error('File kosong tidak dapat diunggah.');
    if (bytes.length > MAX_FILE_BYTES) throw new Error('Ukuran file maksimal 10 MB.');
    const extension = extname(name).toLowerCase();
    let kind, mimeType, text = '', vision, notice = '', truncated = false;
    if (IMAGE_EXTENSIONS.has(extension)) {
      const processor = sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'error' });
      const metadata = await processor.metadata();
      if (!['png', 'jpeg', 'webp', 'gif'].includes(metadata.format)) throw new Error('Isi file bukan foto PNG, JPG, WebP, atau GIF yang valid.');
      mimeType = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }[metadata.format];
      // CLI receives actual, bounded image pixels; originals remain available for download.
      vision = await processor.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).toBuffer();
      kind = 'image';
      if ((metadata.pages || 1) > 1) notice = 'AI membaca frame pertama gambar animasi.';
    } else if (extension === '.pdf') {
      if (!bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error('Isi file PDF tidak valid.');
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(bytes), isEvalSupported: false });
      try {
        const result = await parser.getText({ first: 30 });
        text = result.text;
        if (result.total > 30) { truncated = true; notice = 'AI membaca teks dari 30 halaman pertama PDF.'; }
      } finally { await parser.destroy(); }
      if (!text.trim()) throw new Error('PDF ini tidak memiliki teks yang dapat dibaca. Unggah halaman scan sebagai foto PNG/JPG.');
      kind = 'document'; mimeType = 'application/pdf';
    } else if (extension === '.docx') {
      validateDocxArchive(bytes);
      const mammoth = await import('mammoth');
      text = (await mammoth.extractRawText({ buffer: bytes }, { externalFileAccess: false })).value;
      if (!text.trim()) throw new Error('Dokumen Word tidak memiliki teks yang dapat dibaca.');
      kind = 'document'; mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (TEXT_EXTENSIONS.has(extension) || name === '.gitignore') {
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { throw new Error('File teks harus menggunakan encoding UTF-8.'); }
      if (text.includes('\0')) throw new Error('File biner tidak dapat dibaca sebagai teks.');
      kind = 'text'; mimeType = 'text/plain';
    } else throw new Error('Format belum didukung. Gunakan PNG, JPG, WebP, GIF, PDF, DOCX, atau file teks/kode.');
    if (text.length > MAX_TEXT) { truncated = true; notice = [notice, 'Teks dibatasi hingga 24.000 karakter.'].filter(Boolean).join(' '); }
    const record = { id: randomUUID(), name, mimeType, size: bytes.length, kind, sessionId, text: text.slice(0, MAX_TEXT), truncated, notice };
    const directory = join(this.directory, record.id);
    await mkdir(directory, { recursive: true });
    try {
      await writeFile(join(directory, 'original'), bytes);
      if (vision) await writeFile(join(directory, 'vision.jpg'), vision);
      await writeFile(join(directory, 'metadata.json'), JSON.stringify(record));
    } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
    return publicAttachment(record);
  }
  async get(id) {
    validId(id);
    try { return JSON.parse(await readFile(join(this.directory, id, 'metadata.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') throw new Error('Lampiran tidak ditemukan. Unggah kembali file ini.'); throw error; }
  }
  async resolve(ids, sessionId) {
    if (!Array.isArray(ids) || ids.length > MAX_ATTACHMENTS || new Set(ids).size !== ids.length) throw new Error('Maksimal 5 lampiran berbeda per pesan.');
    const records = await Promise.all(ids.map(id => this.get(id)));
    if (records.some(record => record.sessionId !== sessionId)) throw new Error('Lampiran berasal dari sesi lain. Unggah kembali di sesi ini.');
    return records.map(publicAttachment);
  }
  async original(id) {
    const record = await this.get(id);
    return { record, bytes: await readFile(join(this.directory, validId(id), 'original')) };
  }
  async input(attachments, sessionId) {
    await this.resolve(attachments.map(a => a.id), sessionId);
    const images = []; const documents = []; let budget = 40000;
    for (const attachment of attachments) {
      const record = await this.get(attachment.id);
      if (record.kind === 'image') images.push({ id: record.id, name: record.name, path: join(this.directory, record.id, 'vision.jpg'), mimeType: 'image/jpeg' });
      else {
        const content = record.text.slice(0, Math.max(0, budget)); budget -= content.length;
        documents.push({ name: record.name, text: content, truncated: record.truncated || content.length < record.text.length, notice: record.notice });
      }
    }
    return { images, documents };
  }
}
