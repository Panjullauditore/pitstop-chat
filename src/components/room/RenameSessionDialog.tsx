"use client";
import {useI18n} from "@/lib/i18n";

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
import { Edit2 } from "lucide-react";

interface RenameSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTitle: string;
  onRename: (newTitle: string) => void;
}

export function RenameSessionDialog({
  open,
  onOpenChange,
  currentTitle,
  onRename,
}: RenameSessionDialogProps) {
  const {t}=useI18n();
  const [title, setTitle] = useState(currentTitle);

  useEffect(() => {
    if (open) {
      setTitle(currentTitle);
    }
  }, [open, currentTitle]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (trimmed) {
      onRename(trimmed);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-primary" />
            <span>{t("Ubah Judul Sesi")}</span>
          </DialogTitle>
          <DialogDescription>
            {t("Ganti judul sesi percakapan agar mudah ditemukan di riwayat tim. ")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 my-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t("Judul Sesi")}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("Masukkan judul sesi...")}
              maxLength={80}
              required
              autoFocus
              className="w-full text-sm h-9 px-3 rounded-md bg-secondary/60 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("Batal ")}</Button>
            <Button type="submit">
              {t("Simpan Judul ")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
