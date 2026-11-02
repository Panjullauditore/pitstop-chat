"use client";
import {useI18n} from "@/lib/i18n";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, AlertCircle, Terminal, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { refreshCatalogModels, checkAgentQuota } from "@/lib/api";

interface ReconnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  onReconnected?: () => void;
}

export function ReconnectDialog({
  open,
  onOpenChange,
  token,
  onReconnected,
}: ReconnectDialogProps) {
  const {t}=useI18n();
  const [loading, setLoading] = useState(false);

  const handleAutoConnect = async () => {
    if (!token) {
      toast.error(t("Token Sesi Belum Siap"), {
        description: t("Muat ulang halaman agar token sesi lokal terhubung kembali."),
      });
      return;
    }

    setLoading(true);
    try {
      const checks = await Promise.all(["codex","antigravity","claude"].map(async agent => {
        const res = await fetch("/api/reconnect", {method:"POST",headers:{"Content-Type":"application/json","X-Room-Token":token},body:JSON.stringify({agent})});
        const data=await res.json();if(!res.ok)throw new Error(data.error);return `${agent}: ${data.connected ? t("Terhubung") : data.message}`;
      }));
      toast.info(t("Pemeriksaan akun selesai"), {description:checks.join(" · ")});
      onReconnected?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(t("Gagal Menghubungkan"), {
        description: err.message || t("Terjadi kesalahan saat memeriksa CLI lokal."),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            <span>{t("Sambungkan Ulang Agent AI")}</span>
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            {t("Petunjuk pengecekan koneksi akun dan CLI resmi di laptop Anda. ")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 my-2 text-xs">
          <div className="p-3 rounded-lg bg-secondary/50 border border-border space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Codex CLI (OpenAI)</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {t("Jalankan perintah ")}<code className="px-1.5 py-0.5 rounded bg-background border border-border text-foreground">codex login</code> {t(" di terminal untuk masuk ke akun ChatGPT yang memiliki hak akses Codex. ")}</p>
          </div>

          <div className="p-3 rounded-lg bg-secondary/50 border border-border space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <span className="w-2 h-2 rounded-full bg-sky-400"></span>
              <span>Antigravity CLI (Google agy)</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {t("Jalankan ")}<code className="px-1.5 py-0.5 rounded bg-background border border-border text-foreground">agy</code> {t(" secara interaktif di terminal untuk menyelesaikan login resmi Google. CLI headless tersimpan di folder LocalAppData. ")}</p>
          </div>

          <div className="p-3 rounded-lg bg-secondary/50 border border-border space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Claude (Anthropic)</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {t("Pasang Claude Code, lalu jalankan ")}<code className="px-1 text-foreground">claude auth login</code> {t(" di terminal. Setelah login, gunakan Hubungkan Otomatis untuk memeriksa akun. ")}</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("Batal ")}</Button>
          <Button onClick={handleAutoConnect} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? t("Memeriksa Akun…") : t("Hubungkan Otomatis")}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
