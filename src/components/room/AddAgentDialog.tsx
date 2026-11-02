"use client";

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
import { CatalogData, ProviderId, AgentDefinition } from "@/lib/types";
import { Terminal, Cpu, Brain, Info, PlusCircle } from "lucide-react";
import { toast } from "sonner";

interface AddAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: Record<string, CatalogData>;
  agents: AgentDefinition[];
  onAgentAdded: (agent: AgentDefinition) => Promise<void>;
}


export function AddAgentDialog({
  open,
  onOpenChange,
  catalog,
  agents,
  onAgentAdded,
}: AddAgentDialogProps) {
  const [activeTab, setActiveTab] = useState<"cli" | "api">("cli");
  const [provider, setProvider] = useState<ProviderId>("codex");
  const [name, setName] = useState("Codex");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [role, setRole] = useState("Rekan diskusi");
  const [effort, setEffort] = useState("");

  const handleProviderSelect = (p: ProviderId) => {
    setProvider(p);
    if (p === "codex") {
      setName("Codex Lead");
      setModel("");
    } else if (p === "antigravity") {
      setName("Antigravity Arch");
      setModel("");
    } else if (p === "claude") {
      setName("Claude Orchestrator");
      setModel("");
    }
  };

  const getAvailableModels = () => {
    if (provider === "codex") return catalog.codex?.models || [];
    if (provider === "antigravity") return catalog.antigravity?.models || [];
    return catalog.claude?.models || [];
  };

  const [saving, setSaving] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    if (saving) return;
    if (activeTab === "api") {toast.error("Gunakan CLI lokal untuk menghubungkan provider."); return;}
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Nama Wajib Diisi", { description: "Masukkan nama agent yang valid." });
      return;
    }

    const finalModel = model === "__custom__" ? customModel.trim() : model;
    if (model === "__custom__" && !finalModel) {
      toast.error("Model Wajib Dipilih", { description: "Pilih model atau isi Model ID manual." });
      return;
    }

    const newAgent: AgentDefinition = {
      id: provider,
      name: trimmedName,
      provider,
      installed: false,
      connection: "disconnected",
      model: finalModel,
      effort,
      role,
    };

    setSaving(true);
    try {
      await onAgentAdded(newAgent);
      toast.success("Konfigurasi agent tersimpan", {description:"Status akun mengikuti hasil pemeriksaan CLI."});
      onOpenChange(false);
    } catch (error: any) {toast.error("Gagal menyimpan agent", {description:error.message});}
    finally {setSaving(false);}

  };

  const models = getAvailableModels();
  const status = (id: string) => agents.find(agent=>agent.id===id)?.connection === "connected" ? "Terhubung" : "Belum terhubung";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-card border-border shadow-2xl">
        {/* Modal Header */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border bg-card/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold shrink-0">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm sm:text-base font-bold text-foreground">
                Konfigurasi agent
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Pilih provider CLI, nama agent, dan model yang akan dipakai.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {activeTab === "cli" ? (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Pilih CLI Provider yang Terpasang
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {/* Codex Option */}
                <div
                  onClick={() => handleProviderSelect("codex")}
                  className={`border rounded-xl p-2.5 cursor-pointer text-center transition-all ${
                    provider === "codex"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card/60 hover:border-primary/40"
                  }`}
                >
                  <Terminal className={`w-5 h-5 mx-auto mb-1 ${provider === "codex" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="text-xs font-semibold text-foreground">Codex CLI</div>
                  <div className="text-xs text-emerald-400 font-medium">{status("codex")}</div>
                </div>

                {/* Antigravity Option */}
                <div
                  onClick={() => handleProviderSelect("antigravity")}
                  className={`border rounded-xl p-2.5 cursor-pointer text-center transition-all ${
                    provider === "antigravity"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card/60 hover:border-primary/40"
                  }`}
                >
                  <Cpu className={`w-5 h-5 mx-auto mb-1 ${provider === "antigravity" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="text-xs font-semibold text-foreground">Antigravity</div>
                  <div className="text-xs text-emerald-400 font-medium">{status("antigravity")}</div>
                </div>

                {/* Claude Option */}
                <div
                  onClick={() => handleProviderSelect("claude")}
                  className={`border rounded-xl p-2.5 cursor-pointer text-center transition-all ${
                    provider === "claude"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card/60 hover:border-primary/40"
                  }`}
                >
                  <Brain className={`w-5 h-5 mx-auto mb-1 ${provider === "claude" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="text-xs font-semibold text-foreground">Claude CLI</div>
                  <div className="text-xs text-amber-400 font-medium">{status("claude")}</div>
                </div>
              </div>


            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Endpoint Base URL
                </label>
                <input
                  type="text"
                  defaultValue="https://api.openai.com/v1"
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  placeholder="https://api.openai.com/v1 atau http://localhost:11434"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  API Key / Token Rahasia
                </label>
                <input
                  type="password"
                  disabled
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  placeholder="sk-••••••••••••••••"
                />
              </div>
            </div>
          )}

          {/* Common Configuration Form */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Nama Panggilan Agent
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: DB Optimizer, Pentester, DevOps Bot"
                required
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Model yang Didukung
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">Default CLI</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.id}
                    </option>
                  ))}
                  <option value="__custom__">Model Manual…</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Peran Tim
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Peran spesialis"
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {model === "__custom__" && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Model ID Manual
                </label>
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="Ketik model ID spesifik..."
                  required
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            )}

            {/* Reasoning Effort Toggle */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Reasoning Effort (Daya Penalaran)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["", "low", "medium", "high"] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setEffort(lvl)}
                    className={`py-1.5 px-2 rounded-lg border text-xs transition-all text-center capitalize ${
                      effort === lvl
                        ? "border-primary bg-primary/20 text-primary font-bold shadow-xs"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                    }`}
                  >
                    {lvl || "Default"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-border flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs h-9"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={saving || activeTab === "api"}
              className="gap-1.5 text-xs h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Tambahkan ke Sesi</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
