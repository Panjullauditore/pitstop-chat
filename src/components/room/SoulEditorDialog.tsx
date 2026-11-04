"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { saveSoulDocument } from "@/lib/api";
import { formatJakartaDate } from "@/lib/utils";
import { Download, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {useDownloadConfirmation,downloadFile} from './DownloadConfirmation';

interface SoulEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  initialContent: string;
  revision: number;
  updatedAt?: string;
  onSaved: (newContent: string, newRevision: number) => void;
}

export function SoulEditorDialog({
  open,
  onOpenChange,
  token,
  initialContent,
  revision,
  updatedAt,
  onSaved,
}: SoulEditorDialogProps) {
  const confirmDownload=useDownloadConfirmation();
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [currentRev, setCurrentRev] = useState(revision);

  useEffect(() => {
    if (open) {
      setContent(initialContent);
      setCurrentRev(revision);
    }
  }, [open, initialContent, revision]);

  const handleSave = async () => {
    if (!token) return;
    if (!content.trim()) {
      toast.error("Konten Kosong", {
        description: "Isi dokumen Soul sesi tidak boleh kosong.",
      });
      return;
    }

    setSaving(true);
    try {
      const brain = await saveSoulDocument(content, currentRev, token);
      const nextRev = brain?.soul?.revision || currentRev + 1;
      setCurrentRev(nextRev);
      onSaved(content, nextRev);
      toast.success("Soul Sesi Tersimpan", {
        description: `Dokumen Soul versi ${nextRev} berhasil disimpan ke memori sesi.`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Gagal Menyimpan Soul", {
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = () => {
    if (token) {
      confirmDownload({filename:'pitstop-memories.json',run:()=>downloadFile(`/api/brain/export?token=${encodeURIComponent(token)}`,'pitstop-memories.json')});
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <span>Soul Sesi Diskusi</span>
              </DialogTitle>
              <DialogDescription>
                Memori keputusan inti dan arah proyek yang dikirimkan ke setiap giliran diskusi AI.
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBackup}
              className="h-8 gap-1.5 text-xs shrink-0"
              title="Unduh cadangan JSON Soul"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Backup Soul</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="flex items-center justify-between text-xs text-muted-foreground py-1 border-b border-border/60">
          <span className="font-semibold px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
            Versi {currentRev}
          </span>
          <span>{updatedAt ? `Terakhir diperbarui: ${formatJakartaDate(updatedAt)}` : ""}</span>
        </div>

        <div className="flex-1 my-2 min-h-[300px]">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full min-h-[320px] p-3.5 rounded-lg border border-border bg-input text-xs text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            placeholder="Tuliskan tujuan proyek, keputusan utama, dan batas kerja..."
            spellCheck={false}
          />
        </div>

        <div className="p-2.5 rounded-lg bg-secondary/40 border border-border/70 text-xs text-muted-foreground space-y-1 leading-relaxed">
          <div className="flex items-center gap-1.5 font-semibold text-secondary-foreground">
            <AlertCircle className="w-3.5 h-3.5 text-primary" />
            <span>Aturan Jawaban Singkat untuk Menghemat Kuota:</span>
          </div>
          <p>
            AI diinstruksikan menjawab 2–4 kalimat (~75 kata) langsung ke inti, berhenti saat konsensus tercapai, dan hanya membawa ide baru atau koreksi yang berguna.
          </p>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Menyimpan…" : "Simpan Soul Sesi ↗"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
