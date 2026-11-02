"use client";

import React, { useState, useMemo } from "react";
import { SessionData } from "@/lib/types";
import { DeleteSessionAlert } from "./DeleteSessionAlert";
import { RenameSessionDialog } from "./RenameSessionDialog";
import {
  MessageSquare,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  X,
  Calendar,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface SessionHistoryProps {
  sessions: SessionData[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
}

export function SessionHistory({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
}: SessionHistoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SessionData | null>(null);
  const [renameTarget, setRenameTarget] = useState<SessionData | null>(null);

  // Filtered by search
  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.messages.some((m) => m.text.toLowerCase().includes(q))
    );
  }, [sessions, searchQuery]);

  // Group by relative date (Hari Ini, Kemarin, 7 Hari Terakhir, Sebelumnya)
  const groupedSessions = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const startOf7Days = startOfToday - 7 * 86400000;

    const groups: { label: string; items: SessionData[] }[] = [
      { label: "Hari Ini", items: [] },
      { label: "Kemarin", items: [] },
      { label: "7 Hari Terakhir", items: [] },
      { label: "Sebelumnya", items: [] },
    ];

    for (const session of filteredSessions) {
      const time = new Date(session.updatedAt || session.createdAt).getTime();
      if (time >= startOfToday) {
        groups[0].items.push(session);
      } else if (time >= startOfYesterday) {
        groups[1].items.push(session);
      } else if (time >= startOf7Days) {
        groups[2].items.push(session);
      } else {
        groups[3].items.push(session);
      }
    }

    return groups.filter((g) => g.items.length > 0);
  }, [filteredSessions]);

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari sesi percakapan…"
          className="w-full text-xs h-8 pl-8 pr-7 rounded-md bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
            aria-label="Hapus pencarian"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Grouped Sessions List */}
      {groupedSessions.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          {searchQuery ? "Tidak ada sesi yang cocok." : "Belum ada riwayat sesi."}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedSessions.map((group) => (
            <div key={group.label} className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase px-2">
                {group.label}
              </span>

              <div className="space-y-0.5">
                {group.items.map((session) => {
                  const isActive = session.id === activeSessionId;


                  return (
                    <div
                      key={session.id}
                      role="button"
                      tabIndex={0}
                      onKeyDown={event => {if(event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {event.preventDefault();onSelectSession(session.id);}}}
                      onClick={() => onSelectSession(session.id)}
                      className={`group flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-lg text-left cursor-pointer transition-colors ${
                        isActive
                          ? "bg-secondary/90 text-foreground border border-border/80 shadow-sm"
                          : "hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        <MessageSquare
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? "text-primary" : "text-muted-foreground/80"
                          }`}
                        />
                        <span
                          className={`text-xs truncate ${
                            isActive ? "font-semibold text-foreground" : "font-normal text-secondary-foreground"
                          }`}
                          title={session.title}
                        >
                          {session.title}
                        </span>
                      </div>

                      {/* Right actions: count & options menu */}
                      <div className="flex items-center gap-1 shrink-0">


                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-opacity"
                              title="Pilihan sesi"
                              aria-label={`Pilihan sesi ${session.title}`}
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="end"
                            className="w-40 p-1 bg-card border border-border shadow-xl space-y-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => setRenameTarget(session)}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-secondary-foreground hover:text-foreground hover:bg-secondary/80 rounded-md text-left transition-colors"
                            >
                              <Edit2 className="w-3 h-3 text-muted-foreground" />
                              <span>Ubah Judul</span>
                            </button>
                            <>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(session)}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/15 rounded-md text-left transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Hapus Sesi</span>
                              </button>
                            </>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Alert */}
      <DeleteSessionAlert
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        sessionTitle={deleteTarget?.title || ""}
        onConfirm={() => {
          if (deleteTarget) {
            onDeleteSession(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />

      {/* Rename Dialog */}
      <RenameSessionDialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        currentTitle={renameTarget?.title || ""}
        onRename={(newTitle) => {
          if (renameTarget) {
            onRenameSession(renameTarget.id, newTitle);
            setRenameTarget(null);
          }
        }}
      />
    </div>
  );
}
