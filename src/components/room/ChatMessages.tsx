"use client";
import {useI18n} from "@/lib/i18n";

import { HighlightMatch } from "./MessageSearch";
import { ChatWelcome } from "./ChatWelcome";
import { ChatAttachments } from "./ChatAttachments";
import React, { useRef, useEffect, useLayoutEffect, useState } from "react";
import { ChatMessage, AgentQuotaStatus, AgentDefinition } from "@/lib/types";
import {
  Bookmark,
  Check,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { pinChatMessage } from "@/lib/api";

interface ChatMessagesProps {
  agents?: AgentDefinition[];
  searchTarget?: {messageId:string;query:string;nonce:number}|null;
  messages: ChatMessage[];
  scrollRequest?: number;
  currentUserName: string;
  avatar?: string;
  managerId?: string;
  token: string;
  quotaMap: Record<string, AgentQuotaStatus>;
  pinnedIds?: string[];
  onPromptSelected: (promptText: string) => void;
  onMessagePinned?: (messageId: string) => void;
}

export function ChatMessages({
  agents = [],
  searchTarget,
  messages,
  scrollRequest = 0,
  currentUserName,
  avatar,
  managerId,
  token,
  quotaMap,
  pinnedIds = [],
  onPromptSelected,
  onMessagePinned,
}: ChatMessagesProps) {
  const {t}=useI18n();
  const messageRefs = useRef(new Map<string,HTMLDivElement>());
  const highlight = (text:string) => <HighlightMatch text={text} query={searchTarget?.query || ""}/>;
  const followTail=useRef(true);
  const previousSearch=useRef(false);
  const lastUserMessageId=useRef<string|undefined>(undefined);
  const previousScrollRequest=useRef(scrollRequest);
  const containerRef = useRef<HTMLDivElement>(null);
  const [copiedSnippetIdx, setCopiedSnippetIdx] = useState<string | null>(null);
  const userInitial = Array.from(currentUserName)[0]?.toLocaleUpperCase("id-ID") || "U";

  useLayoutEffect(() => {
    const el = containerRef.current;
    const latestUser=messages.findLast(message=>message.role==='user');
    if(latestUser?.id!==lastUserMessageId.current||scrollRequest!==previousScrollRequest.current)followTail.current=true;
    lastUserMessageId.current=latestUser?.id;
    previousScrollRequest.current=scrollRequest;
    if (el && !searchTarget && (followTail.current || previousSearch.current)) {
      followTail.current=true;
      el.scrollTop = el.scrollHeight;
    }
    previousSearch.current=Boolean(searchTarget);
  }, [messages,searchTarget,scrollRequest]);
  useEffect(()=>{
    const el=containerRef.current;if(!el)return;
    const observer=new ResizeObserver(()=>{if(followTail.current&&!searchTarget)el.scrollTop=el.scrollHeight;});
    observer.observe(el);if(el.firstElementChild)observer.observe(el.firstElementChild);
    return()=>observer.disconnect();
  },[messages.length>0,searchTarget]);
  useEffect(()=>{
    if(!searchTarget)return;
    const node=messageRefs.current.get(searchTarget.messageId);
    if(node){node.scrollIntoView({behavior:"smooth",block:"center"});node.focus({preventScroll:true});}
  },[searchTarget]);

  const handlePin = async (messageId: string) => {
    if (!token) return;
    try {
      await pinChatMessage(messageId, token);
      onMessagePinned?.(messageId);
      toast.success(t("Tersimpan ke Project Memory"), {
        description: t("Poin keputusan berhasil disematkan ke dokumen memori sesi."),
      });
    } catch (err: any) {
      toast.error(t("Gagal Menyimpan"), {
        description: err.message,
      });
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {await navigator.clipboard.writeText(text);setCopiedSnippetIdx(id);toast.success(t("Teks disalin"));setTimeout(()=>setCopiedSnippetIdx(null),2000);}
    catch {toast.error(t("Tidak bisa menyalin teks"),{description:t("Izinkan clipboard di browser, atau pilih dan salin teks secara manual.")});}
  };

  const formatText = (text: string, messageId: string) => {
    return text.split(/(```[\s\S]*?```)/g).map((part, idx) => {
      if (part.startsWith("```")) {
        const firstLineBreak = part.indexOf("\n");
        const lang =
          firstLineBreak > 3
            ? part.slice(3, firstLineBreak).trim()
            : "code";
        const codeContent = part
          .replace(/^```[^\n]*\n?/, "")
          .replace(/```$/, "");
        const snippetId = `${messageId}-${idx}`;

        return (
          <div
            key={idx}
            className="my-3 rounded-lg bg-rail border border-border overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/60 border-b border-border text-xs text-muted-foreground">
              <span>{lang || "snippet"}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(codeContent, snippetId)}
                className="hover:text-foreground transition-colors flex items-center gap-1 py-0.5 px-1.5 rounded hover:bg-secondary"
              >
                {copiedSnippetIdx === snippetId ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-xs">{t("Tersalin")}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span className="text-xs">{t("Salin")}</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 text-[12px] font-mono text-foreground overflow-x-auto leading-relaxed">
              <code>{highlight(codeContent)}</code>
            </pre>
          </div>
        );
      }
      return (
        <span key={idx} className="whitespace-pre-wrap leading-relaxed">
          {part.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g).map((sub, sIdx) => {
            if (sub.startsWith("`") && sub.endsWith("`")) {
              return (
                <code
                  key={sIdx}
                  className="px-1.5 py-0.5 rounded bg-secondary border border-border/80 font-mono text-xs text-primary"
                >
                  {highlight(sub.slice(1, -1))}
                </code>
              );
            }
            if (sub.startsWith("**") && sub.endsWith("**")) {
              return (
                <strong key={sIdx} className="font-semibold text-foreground">
                  {highlight(sub.slice(2, -2))}
                </strong>
              );
            }
            return <React.Fragment key={sIdx}>{highlight(sub)}</React.Fragment>;
          })}
        </span>
      );
    });
  };

  const getAgentAvatar = (role: string) => {
    switch (role) {
      case "codex":
        return {
          code: "CX",
          bg: "bg-rail text-foreground border-border",
          tag: "Codex",
        };
      case "antigravity":
        return {
          code: "AG",
          bg: "bg-secondary text-primary border-border",
          tag: "Antigravity",
        };
      case "claude":
        return {
          code: "CL",
          bg: "bg-primary/15 text-primary border-primary/30",
          tag: "Claude",
        };
      default:
        return {
          code: role.slice(0, 2).toUpperCase(),
          bg: "bg-secondary text-foreground border-border",
          tag: role,
        };
    }
  };

  const getRoleDisplayName = (role: string) => {
    if (role === "user") return currentUserName;
    const agent=agents.find(item=>item.id===role);if(agent)return agent.name;
    if (role === "codex") return "Codex";
    if (role === "antigravity") return "Antigravity";
    if (role === "claude") return "Claude";
    return role;
  };

  if (!messages.length) return <ChatWelcome onPromptSelected={onPromptSelected}/>;

  return (
    <div ref={containerRef} onScroll={event=>{const el=event.currentTarget;followTail.current=el.scrollHeight-el.scrollTop-el.clientHeight<96;}} className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-6 custom-scrollbar">
      <div className="w-full space-y-8">
        {          messages.map((message) => {
            const isUser = message.role === "user";
            const isPinned = pinnedIds.includes(message.id);
            const quotaStatus = quotaMap[message.role];
            const isLow = Boolean(quotaStatus?.warnings?.length);
            const time = new Date(message.at || Date.now()).toLocaleTimeString("id-ID", {
              timeZone: "Asia/Jakarta",
              hour: "2-digit",
              minute: "2-digit",
            });

            if (isUser) {
              return (
                <div key={message.id} data-message-id={message.id} tabIndex={-1} ref={node=>{if(node)messageRefs.current.set(message.id,node);else messageRefs.current.delete(message.id);}} className={`flex gap-3 justify-end items-start group rounded-xl scroll-mt-6 ${searchTarget?.messageId===message.id?'ring-2 ring-primary ring-offset-4 ring-offset-background':''}`}>
                  <div className="flex min-w-0 flex-col items-end max-w-[calc(100%-44px)] sm:max-w-[min(80%,760px)]">
                    <div className="flex flex-wrap justify-end items-center gap-x-2 gap-y-1 mb-2 px-1">
                      <span className="text-xs font-mono font-semibold text-brand-yellow uppercase">{currentUserName}</span>
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">{managerId?'General Manager':t("Pengguna")}</span>
                      <span className="text-[11px] font-mono text-muted-foreground">{time}</span>
                    </div>
                    <div className="w-fit max-w-full [overflow-wrap:anywhere] bg-card border border-primary/40 rounded-xl rounded-tr-sm px-4 py-3 text-sm text-foreground">
                      {message.attachments?.length ? <div className={message.text?'mb-3':''}><ChatAttachments attachments={message.attachments} token={token}/></div> : null}
                      {message.text&&<p className="whitespace-pre-wrap leading-relaxed">{highlight(message.text)}</p>}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-xs text-primary shrink-0">
                    {avatar?<img src={avatar} alt={t("Foto profil")} className="h-full w-full rounded-md object-cover"/>:userInitial}
                  </div>
                </div>
              );
            }

            const agentMeta = getAgentAvatar(message.role);

            return (
              <div key={message.id} data-message-id={message.id} tabIndex={-1} ref={node=>{if(node)messageRefs.current.set(message.id,node);else messageRefs.current.delete(message.id);}} className={`flex gap-3 items-start group rounded-xl scroll-mt-6 ${searchTarget?.messageId===message.id?'ring-2 ring-primary ring-offset-4 ring-offset-background':''}`}>
                {/* Agent Avatar */}
                <div
                  className={`w-8 h-8 rounded-md ${agentMeta.bg} border flex items-center justify-center font-bold text-xs font-mono shrink-0 mt-1 shadow-sm`}
                >
                  {agents.find(agent=>agent.id===message.role)?.avatar ? <img src={agents.find(agent=>agent.id===message.role)?.avatar} alt="" className="w-full h-full rounded-md object-cover"/> : agentMeta.code}
                </div>

                {/* Message Body */}
                <div className="flex-1 min-w-0 space-y-3">
                  {/* Agent Header Meta */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-sm font-display font-bold text-foreground">
                      {getRoleDisplayName(message.role)}
                    </span>
                    {message.nativeChat&&<span className="text-xs text-brand-cyan" title={message.nativeChat.title}>{t("Tersimpan di chat aplikasi")}</span>}
                    {message.manualImport&&<span className="text-xs text-muted-foreground">{message.status==='done'?t("Web · diimpor user"):t("Web · manual")}</span>}
                    {message.role===managerId&&<span className="text-xs text-brand-cyan">Project Manager</span>}

                    {/* Model Pill */}
                    <span className="text-[10px] font-mono text-muted-foreground empty:hidden rounded border border-border bg-secondary px-2 py-1">
                      {message.modelName || message.model || ""}
                    </span>

                    {/* Effort Pill */}
                    {message.effort && (
                      <span className="text-[10px] font-mono text-primary uppercase rounded border border-primary/30 bg-primary/10 px-2 py-1">
                        <span>{message.effort}</span>
                      </span>
                    )}

                    <span className="text-xs text-muted-foreground">
                      {time}
                    </span>
                  </div>

                  {/* Message Card */}
                  <div
                    className={`w-fit max-w-full sm:max-w-[min(100%,72ch)] min-w-0 [overflow-wrap:anywhere] rounded-xl rounded-tl-sm border px-4 py-3 text-sm leading-7 text-foreground space-y-3 ${
                      message.status === "error"
                        ? "border-destructive/40 bg-destructive/10"
                        : message.status === "streaming"
                        ? "border-brand-cyan/40 bg-card"
                        : "border-border/70 bg-card"
                    }`}
                  >
                    {message.text ? (
                      formatText(message.text, message.id)
                    ) : message.status === "streaming" ? (
                      <span className="text-muted-foreground italic flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span>{message.manualImport?t("Menunggu balasan yang disalin dari DeepSeek web…"):t("Sedang menyusun solusi teknis…")}</span>
                      </span>
                    ) : message.status === "stopped" ? (
                      <span className="text-muted-foreground italic">{t("Respons dihentikan.")}</span>
                    ) : null}

                    {message.status === "streaming" && (
                      <span className="streaming-cursor font-mono font-bold ml-1">▍</span>
                    )}
                  </div>

                  {/* Action Bar */}
                  {message.status === "done" && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-1 font-mono uppercase text-[10px]">
                      <button
                        type="button"
                        disabled={isPinned}
                        onClick={() => handlePin(message.id)}
                        className={`inline-flex items-center gap-1 transition-colors ${
                          isPinned
                            ? "text-emerald-400 cursor-default"
                            : "text-muted-foreground hover:text-primary"
                        }`}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${isPinned ? "fill-emerald-400" : ""}`} />
                        <span>{isPinned ? t("Tersimpan di Soul") : t("Simpan ke Project Memory")}</span>
                      </button>

                      <span className="text-border">•</span>

                      <button
                        type="button"
                        onClick={() => copyToClipboard(message.text, message.id)}
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t("Salin Jawaban")}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        }
      </div>
    </div>
  );
}
