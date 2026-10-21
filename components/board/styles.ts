import type { Status } from "@/lib/board/types";

// 状態ごとの色（色と文字の両方で示す）
export const ST: Record<Status, { bar: string; tag: string; dot: string }> = {
  遅れ: { bar: "border-l-st-red", tag: "bg-st-red-bg text-st-red", dot: "bg-st-red" },
  材料待ち: { bar: "border-l-st-yellow", tag: "bg-st-yellow-bg text-[#7A5C00]", dot: "bg-st-yellow" },
  進行中: { bar: "border-l-st-blue", tag: "bg-st-blue-bg text-st-blue", dot: "bg-st-blue" },
  引合: { bar: "border-l-white shadow-[inset_1px_0_0_var(--line)]", tag: "bg-white text-ink border border-line", dot: "bg-white" },
  出荷済み: { bar: "border-l-st-gray bg-[#F7F7F6]", tag: "bg-st-gray-bg text-[#4C5257]", dot: "bg-st-gray" },
};

export const tagBase = "inline-flex items-center rounded px-2 py-0.5 text-xs font-bold";
