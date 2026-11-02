"use client";
import {useI18n} from "@/lib/i18n";

import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

interface DeleteSessionAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionTitle: string;
  onConfirm: () => void;
}

export function DeleteSessionAlert({
  open,
  onOpenChange,
  sessionTitle,
  onConfirm,
}: DeleteSessionAlertProps) {
  const {t}=useI18n();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            <span>{t("Hapus Percakapan Ini?")}</span>
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("Sesi percakapan ")}<strong className="text-foreground font-semibold">"{sessionTitle}"</strong> {t(" akan dihapus dari daftar chat. Jika ini sesi terakhir, chat kosong baru akan dibuka otomatis. Project Memory bersama dan Soul Memory tetap tersimpan. ")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel autoFocus>{t("Batal")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
          >
            {t("Hapus Percakapan ")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
