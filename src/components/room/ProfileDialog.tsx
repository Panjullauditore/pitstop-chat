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
import { saveDisplayName } from "@/lib/api";
import { User } from "lucide-react";
import { toast } from "sonner";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  currentName: string;
  onSaved: (newName: string) => void;
}

export function ProfileDialog({
  open,
  onOpenChange,
  token,
  currentName,
  onSaved,
}: ProfileDialogProps) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(currentName);
    }
  }, [open, currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Nama Tidak Valid", {
        description: "Nama tampilan tidak boleh kosong.",
      });
      return;
    }

    setSaving(true);
    try {
      await saveDisplayName(trimmed, token);
      onSaved(trimmed);
      toast.success("Nama Diperbarui", {
        description: `Nama tampilan Anda berhasil diubah menjadi "${trimmed}".`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Gagal Menyimpan Nama", {
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <span>Ubah Nama Pengguna</span>
          </DialogTitle>
          <DialogDescription>
            Nama ini akan tampil di daftar peserta dan seluruh riwayat chat diskusi Anda.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 my-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Nama Tampilan</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              required
              autoFocus
              placeholder="Masukkan nama Anda..."
              className="w-full text-sm h-9 px-3 rounded-md bg-secondary/60 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan Nama ↗"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
