"use client";

import React, { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle, RefreshCw, X } from "lucide-react";
import { AgentQuotaStatus, QuotaData, QuotaGroup, QuotaBucket } from "@/lib/types";
import { checkAgentQuota } from "@/lib/api";
import { formatJakartaDate } from "@/lib/utils";
import { toast } from "sonner";

interface QuotaPopoverProps {
  agentId: string;
  agentName: string;
  token: string;
  quotaStatus?: AgentQuotaStatus;
  isUrgent?: boolean;
  onQuotaUpdated?: (agentId: string, quota: any) => void;
}

export function QuotaPopover({
  agentId,
  agentName,
  token,
  quotaStatus,
  isUrgent = false,
  onQuotaUpdated,
}: QuotaPopoverProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localData, setLocalData] = useState<QuotaData | null>(quotaStatus?.data || null);

  useEffect(() => {setLocalData(quotaStatus?.data || null);}, [quotaStatus]);

  const handleRefresh = async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (agentId === "claude") {
        toast.info("Status Kuota Claude", {
          description: "CLI Claude tidak menyediakan persentase sisa kuota.",
        });
        setLoading(false);
        return;
      }
      const quota = await checkAgentQuota(agentId, token, true);
      setLocalData(quota);
      onQuotaUpdated?.(agentId, quota);
      toast.success("Data Limit Diperbarui", {
        description: `Limit kuota ${agentName} berhasil diperiksa.`,
      });
    } catch (err: any) {
      toast.error("Gagal Membaca Kuota", {
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const data = localData || quotaStatus?.data;
  const groups = data?.groups || [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs transition-colors shrink-0 ${
            isUrgent
              ? "bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500/25"
              : "bg-secondary/60 border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}
          title={isUrgent ? "Sisa limit ≤ 5%!" : `Lihat limit kuota ${agentName}`}
          aria-label={`Lihat limit kuota ${agentName}`}
        >
          {isUrgent ? <AlertTriangle className="w-3 h-3 text-amber-400" /> : <Clock className="w-3 h-3" />}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-4 border border-border bg-card text-foreground shadow-2xl" align="start">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-border/70">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm">Limit {agentName}</span>
            {isUrgent && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Kritis ≤5%
              </span>
            )}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground rounded p-0.5"
            aria-label="Tutup limit"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {agentId === "claude" ? (
          <div className="py-4 text-center">
            <p className="text-sm font-semibold text-muted-foreground">Tidak tersedia</p>
            <p className="text-xs text-muted-foreground/80 mt-1.5 leading-relaxed">
              CLI Claude belum menyediakan persentase sisa kuota yang dapat dibaca Pitstop.
            </p>
          </div>
        ) : groups.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground leading-relaxed">
            Data limit tidak dilaporkan oleh provider akun ini (<span className="text-foreground">Tidak tersedia</span>).
          </div>
        ) : (
          <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
            {groups.map((group, gIdx) => (
              <div key={gIdx} className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-secondary-foreground border-b border-border/40 pb-1">
                  <span>{group.name}</span>
                  {group.plan && <span className="text-xs text-muted-foreground font-normal uppercase tracking-wider">{group.plan}</span>}
                </div>
                {group.buckets.map((bucket, bIdx) => {
                  const hasRemaining = typeof bucket.remainingPercent === "number" && Number.isFinite(bucket.remainingPercent);
                  const isLow = hasRemaining && bucket.remainingPercent! <= 5;
                  const percentText = hasRemaining
                    ? bucket.remainingPercent! > 0 && bucket.remainingPercent! < 0.1
                      ? "<0,1%"
                      : `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(bucket.remainingPercent!)}%`
                    : "Tidak tersedia";

                  return (
                    <div key={bIdx} className="text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{bucket.name}</span>
                        <span className={`font-semibold ${isLow ? "text-amber-400" : "text-emerald-400"}`}>
                          {bucket.disabled ? "Tidak berlaku" : percentText}
                        </span>
                      </div>
                      {!bucket.disabled && hasRemaining && (
                        <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isLow ? "bg-amber-400" : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.max(2, Math.min(100, bucket.remainingPercent!))}%` }}
                          />
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground/75">
                        {bucket.disabled
                          ? "Batas dinonaktifkan provider."
                          : bucket.resetAt
                          ? `Reset: ${formatJakartaDate(bucket.resetAt)}`
                          : "Waktu reset belum dilaporkan."}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/60">
          <span className="text-xs text-muted-foreground">
            {data?.checkedAt ? `Dicek ${formatJakartaDate(data.checkedAt)}` : "Belum dicek"}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-2.5 gap-1.5"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
