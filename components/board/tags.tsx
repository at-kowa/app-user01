import type { Prop } from "@/lib/board/types";
import { defectCount, isWarn, shipped, status } from "@/lib/board/logic";
import { cn } from "@/lib/utils";
import { ST, tagBase } from "./styles";

// 状態・納期注意・不良ありの目印
export function StatusTags({ p, warnDays, className }: { p: Prop; warnDays: number; className?: string }) {
  const st = status(p);
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      <span className={cn(tagBase, ST[st].tag)}>{st}</span>
      {isWarn(p, warnDays) && <span className={cn(tagBase, "border border-st-red bg-white text-st-red")}>納期注意</span>}
      {defectCount(p) > 0 && !shipped(p) && <span className={cn(tagBase, "bg-ink text-white")}>不良あり</span>}
    </div>
  );
}
