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
import { CatalogData, ModelSelection } from "@/lib/types";
import { refreshCatalogModels, saveModelSettings } from "@/lib/api";
import { RefreshCw, Cpu } from "lucide-react";
import { toast } from "sonner";

interface ModelSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: Record<string, CatalogData>;
  currentSelections: Record<string, ModelSelection>;
  token: string;
  onSaved: (selections: Record<string, ModelSelection>) => void;
  onCatalogRefreshed: (newCatalog: Record<string, CatalogData>) => void;
}

const EFFORT_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra High",
  max: "Max",
  ultra: "Ultra",
  minimal: "Minimal",
};

export function ModelSelectorDialog({
  open,
  onOpenChange,
  catalog,
  currentSelections,
  token,
  onSaved,
  onCatalogRefreshed,
}: ModelSelectorDialogProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [codexModel, setCodexModel] = useState("");
  const [codexCustom, setCodexCustom] = useState("");
  const [codexEffort, setCodexEffort] = useState("");

  const [agyModel, setAgyModel] = useState("");
  const [agyCustom, setAgyCustom] = useState("");
  const [agyEffort, setAgyEffort] = useState("");

  // Populate form from currentSelections
  useEffect(() => {
    if (open) {
      const cSel = currentSelections.codex || {};
      const cModels = catalog.codex?.models || [];
      const cKnown = cModels.some((m) => m.id === cSel.model);
      setCodexModel(cSel.model ? (cKnown ? cSel.model : "__custom__") : "");
      setCodexCustom(cKnown ? "" : cSel.model || "");
      setCodexEffort(cSel.effort || "");

      const aSel = currentSelections.antigravity || {};
      const aModels = catalog.antigravity?.models || [];
      const aKnown = aModels.some((m) => m.id === aSel.model);
      setAgyModel(aSel.model ? (aKnown ? aSel.model : "__custom__") : "");
      setAgyCustom(aKnown ? "" : aSel.model || "");
      setAgyEffort(aSel.effort || "");
    }
  }, [open, catalog]);

  const handleRefresh = async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const newCat = await refreshCatalogModels(token);
      onCatalogRefreshed(newCat);
      toast.success("Daftar Model Diperbarui", {
        description: "Model terbaru berhasil dibaca dari akun CLI lokal.",
      });
    } catch (err: any) {
      toast.error("Gagal Memperbarui Model", {
        description: err.message,
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSaving(true);
    try {
      const selections: Record<string, any> = {
        codex: {
          model: codexModel === "__custom__" ? codexCustom.trim() : codexModel,
          effort: codexEffort,
          custom: codexModel === "__custom__",
        },
        antigravity: {
          model: agyModel === "__custom__" ? agyCustom.trim() : agyModel,
          effort: agyEffort,
          custom: agyModel === "__custom__",
        },
      };

      if (codexModel === "__custom__" && !selections.codex.model) {
        throw new Error("Silakan isi Model ID manual untuk Codex.");
      }
      if (agyModel === "__custom__" && !selections.antigravity.model) {
        throw new Error("Silakan isi Model ID manual untuk Antigravity.");
      }

      const saved = await saveModelSettings(selections, token);
      onSaved(saved.selections);
      toast.success("Pengaturan Model Tersimpan", {
        description: "Pilihan model dan reasoning effort berhasil disimpan.",
      });
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Gagal Menyimpan Pengaturan", {
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  // Helper for options
  const codexModels = catalog.codex?.models || [];
  const selectedCodexObj = codexModels.find((m) => m.id === codexModel);
  const codexEfforts = codexModel === "__custom__"
    ? ["low", "medium", "high", "xhigh", "max", "ultra"]
    : selectedCodexObj?.efforts || [];

  const agyModels = catalog.antigravity?.models || [];
  const selectedAgyObj = agyModels.find((m) => m.id === agyModel);
  const agyEfforts = agyModel === "__custom__"
    ? ["low", "medium", "high", "xhigh", "max"]
    : selectedAgyObj?.efforts || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary" />
            <span>Pengaturan Model & Reasoning</span>
          </DialogTitle>
          <DialogDescription>
            Tentukan pilihan model dan kedalaman reasoning effort untuk setiap provider AI lokal.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between pb-3 border-b border-border/70">
          <span className="text-xs text-muted-foreground">Daftar dibaca langsung dari CLI akun Anda.</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Membaca CLI…" : "Refresh Model / Akun"}</span>
          </Button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 my-2">
          {/* Codex Config */}
          <div className="p-3.5 rounded-lg border border-border bg-card/60 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Codex (OpenAI CLI)</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Pilihan Model</label>
              <select
                value={codexModel}
                onChange={(e) => setCodexModel(e.target.value)}
                className="w-full text-xs h-9 px-3 rounded-md bg-secondary/60 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Default CLI</option>
                {codexModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
                <option value="__custom__">Model ID Manual…</option>
              </select>
            </div>

            {codexModel === "__custom__" && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Model ID Manual</label>
                <input
                  type="text"
                  value={codexCustom}
                  onChange={(e) => setCodexCustom(e.target.value)}
                  placeholder="contoh: gpt-6.1-sol"
                  className="w-full text-xs h-9 px-3 rounded-md bg-secondary/60 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Reasoning Effort</label>
              <select
                value={codexEffort}
                onChange={(e) => setCodexEffort(e.target.value)}
                disabled={!codexEfforts.length}
                className="w-full text-xs h-9 px-3 rounded-md bg-secondary/60 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                <option value="">
                  {codexEfforts.length ? "Default Provider" : "Tidak didukung oleh model ini"}
                </option>
                {codexEfforts.map((eff) => (
                  <option key={eff} value={eff}>
                    {EFFORT_LABELS[eff] || eff}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Antigravity Config */}
          <div className="p-3.5 rounded-lg border border-border bg-card/60 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
              <span className="w-2 h-2 rounded-full bg-sky-400"></span>
              <span>Antigravity (Google agy)</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Pilihan Model</label>
              <select
                value={agyModel}
                onChange={(e) => setAgyModel(e.target.value)}
                className="w-full text-xs h-9 px-3 rounded-md bg-secondary/60 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Default CLI</option>
                {agyModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
                <option value="__custom__">Model ID Manual…</option>
              </select>
            </div>

            {agyModel === "__custom__" && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Model ID Manual</label>
                <input
                  type="text"
                  value={agyCustom}
                  onChange={(e) => setAgyCustom(e.target.value)}
                  placeholder="Model ID Antigravity..."
                  className="w-full text-xs h-9 px-3 rounded-md bg-secondary/60 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Reasoning Effort</label>
              <select
                value={agyEffort}
                onChange={(e) => setAgyEffort(e.target.value)}
                disabled={!agyEfforts.length}
                className="w-full text-xs h-9 px-3 rounded-md bg-secondary/60 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                <option value="">
                  {agyEfforts.length ? "Default Provider" : "Tidak didukung oleh model ini"}
                </option>
                {agyEfforts.map((eff) => (
                  <option key={eff} value={eff}>
                    {EFFORT_LABELS[eff] || eff}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan Pilihan Model ↗"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
