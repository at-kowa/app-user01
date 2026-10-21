import type { Prop } from "@/lib/board/types";
import { curProc, daysTo, defectCount, md, status } from "@/lib/board/logic";
import { cn } from "@/lib/utils";
import { ST } from "./styles";
import { StatusTags } from "./tags";

export function PropCard({ p, warnDays, onOpen }: { p: Prop; warnDays: number; onOpen: (id: string) => void }) {
  const st = status(p);
  const dt = daysTo(p.due);
  const arrived = p.mats.filter((m) => m.arrived).length;

  return (
    <div
      role="button"
      tabIndex={0}
      data-id={p.id}
      aria-label={`${p.id} ${p.name} ${st}`}
      onClick={() => onOpen(p.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(p.id);
        }
      }}
      className={cn(
        "grid cursor-pointer grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 rounded-md border border-line border-l-[12px] bg-white px-3.5 py-3 transition-colors hover:border-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-st-blue",
        ST[st].bar,
      )}
    >
      <div className="text-[13px] text-muted-foreground tabular-nums">
        {p.id}・{p.team}
      </div>
      <div className="col-start-2 row-span-3 row-start-1 text-right">
        {st === "出荷済み" ? (
          <small className="text-xs text-muted-foreground">出荷済み</small>
        ) : dt === null ? (
          <small className="text-xs text-muted-foreground">納期未定</small>
        ) : dt < 0 ? (
          <>
            <b className="block text-3xl leading-none text-st-red tabular-nums">{-dt}</b>
            <small className="text-xs text-muted-foreground">日超過</small>
          </>
        ) : (
          <>
            <b className="block text-3xl leading-none tabular-nums">{dt}</b>
            <small className="text-xs text-muted-foreground">日後が納期</small>
          </>
        )}
      </div>
      <div className="text-lg leading-snug font-bold">{p.name}</div>
      <div className="text-[13px] text-muted-foreground">
        {p.cust}・希望納期 {md(p.due)}
      </div>
      <StatusTags p={p} warnDays={warnDays} className="col-span-2 mt-1.5 mb-0.5" />
      <div className="col-span-2 mt-1.5 grid grid-cols-4 gap-1">
        {p.procs.map((x) => (
          <span
            key={x.name}
            className={cn(
              "truncate rounded-sm border border-line py-0.5 text-center text-[11.5px] text-muted-foreground",
              x.status === "完了" && "border-ink bg-ink text-white",
              x.status === "作業中" && "border-2 border-st-blue font-bold text-st-blue",
            )}
          >
            {x.name}
          </span>
        ))}
      </div>
      <div className="col-span-2 mt-1.5 flex flex-wrap gap-x-3.5 text-[13px] text-muted-foreground [&_b]:text-ink [&_b]:tabular-nums">
        <span>
          現在の工程 <b>{curProc(p)}</b>
        </span>
        <span>
          材料 <b>{arrived}/{p.mats.length}</b>
        </span>
        <span>
          不良 <b>{defectCount(p)}</b>
        </span>
        <span>
          出荷予定日 <b>{md(p.ship)}</b>
        </span>
      </div>
    </div>
  );
}
