"use client";
import {useI18n} from "@/lib/i18n";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AttendanceState } from "@/lib/types";
import { runAttendance } from "@/lib/api";
import { CheckCircle2, UserCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatJakartaDate } from "@/lib/utils";

interface AttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  attendance: AttendanceState | null;
  onRunStarted?: () => void;
}

export function AttendanceDialog({
  open,
  onOpenChange,
  token,
  attendance,
  onRunStarted,
}: AttendanceDialogProps) {
  const {t}=useI18n();
  const [submitting, setSubmitting] = useState(false);

  const handleRunAttendance = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      await runAttendance(token);
      onRunStarted?.();
      toast.info(t("Absen Dimulai"), {
        description: t("Memanggil agent untuk memverifikasi ingatan nama proyek dari Soul."),
      });
    } catch (err: any) {
      toast.error(t("Gagal Memulai Absen"), {
        description: err.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const agents = Object.keys(attendance?.agents || {}).map(id => ({id,name:id,avatar:id[0].toUpperCase(),color:"bg-secondary text-primary border-border"}));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            <span>{t("Panel Absen Agent")}</span>
          </DialogTitle>
          <DialogDescription>
            {t("Memverifikasi langsung kesiapan agent dan ingatan nama proyek dari Soul sesi ini. ")}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between pb-3 border-b border-border/70 my-1">
          <Button
            onClick={handleRunAttendance}
            disabled={submitting || attendance?.status === "running"}
            className="gap-2 text-xs h-8"
          >
            {attendance?.status === "running" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t("Sedang Absen…")}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t("Absen Semua Agent ↗")}</span>
              </>
            )}
          </Button>
          <span className="text-xs text-muted-foreground">
            {attendance?.finishedAt
              ? t("Terakhir: {0}", [formatJakartaDate(attendance.finishedAt)])
              : t("Hanya absen satu baris, tanpa diskusi teks.")}
          </span>
        </div>

        {/* Clean attendance results: ONLY "Hadir, Siap Melanjutkan Project [nama project]" */}
        <div className="space-y-3 my-2">
          {agents.map((ag) => {
            const result = attendance?.agents?.[ag.id];
            const status = result?.status || "waiting";

            let displayText = t("Belum absen.");
            let textClass = "text-muted-foreground bg-secondary/30 border-border";

            if (status === "done") {
              displayText = result?.text || t("Hadir.");
              textClass = "text-emerald-400 bg-emerald-950/20 border-emerald-500/30";
            } else if (status === "streaming") {
              displayText = t("Memeriksa ingatan proyek…");
              textClass = "text-primary bg-primary/10 border-primary/20 animate-pulse";
            } else if (status === "waiting") {
              displayText = t("Menunggu giliran…");
              textClass = "text-muted-foreground bg-secondary/30 border-border";
            } else if (status === "error") {
              displayText = t("Gagal absen: {0}", [result?.text || "Tidak ada respons"]);
              textClass = "text-destructive bg-destructive/10 border-destructive/20";
            } else if (status === "stopped") {
              displayText = t("Absen dihentikan.");
              textClass = "text-muted-foreground bg-secondary/30 border-border";
            }

            return (
              <div key={ag.id} className="p-3.5 rounded-lg border border-border bg-card/60 space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-md border flex items-center justify-center font-bold text-xs ${ag.color}`}>
                    {ag.avatar}
                  </div>
                  <span className="font-semibold text-xs text-foreground">{ag.name}</span>
                </div>

                <div className={`p-2.5 rounded-md border text-xs font-medium leading-relaxed font-sans ${textClass}`}>
                  {displayText}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
