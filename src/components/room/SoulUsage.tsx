interface SoulUsageProps { content: string; revision: number; compact?: boolean }

export function SoulUsage({ content, compact = false }: SoulUsageProps) {
  const core = content.split("<!-- PITLANE_AUTO_MEMORY -->")[0].trim();
  const coreLength = core.length;
  const percent = Math.min(100, Math.round(coreLength / 18000 * 100));
  const format = (value: number) => value.toLocaleString("id-ID");
  return (
    <div className={`space-y-1.5 ${compact ? "text-xs" : "text-xs"}`}>
      <div className="flex justify-between gap-2 text-muted-foreground">
        <span>Isi inti Soul</span>
        <span className="font-mono text-primary font-semibold">{percent}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className="h-full rounded-full bg-primary" style={{width:`${percent}%`}} />
      </div>
      <div className="flex flex-wrap justify-between gap-x-2 text-muted-foreground font-mono">
        <span>{format(coreLength)} / 18.000 karakter inti</span>
        <span>{format(content.length)} karakter total</span>
      </div>
      {!compact && <p className="text-xs text-muted-foreground">Total mencakup catatan otomatis. Batas 18.000 karakter berlaku untuk isi inti.</p>}
    </div>
  );
}
