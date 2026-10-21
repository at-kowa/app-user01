// 状態の自動判定など、画面に依存しない決まりごと
import type { Prop, ProcStatus, Proc, Role, Status } from "./types";
import { PROCS } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

export const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const today = () => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
};

// 今日から n 日後（マイナスなら前）の日付
export const off = (n: number) => {
  const t = today();
  t.setDate(t.getDate() + n);
  return fmt(t);
};

export const daysTo = (s: string): number | null => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - today().getTime()) / 864e5);
};

// 2026-10-05 → 10/5
export const md = (s: string) => (s ? `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}` : "—");

export const nowStr = () => {
  const n = new Date();
  return `${fmt(n)} ${pad(n.getHours())}:${pad(n.getMinutes())}`;
};

export const shipped = (p: Prop) => p.procs[PROCS.length - 1]?.status === "完了";

// 上から順に確かめ、最初に当てはまった状態にする
export function status(p: Prop): Status {
  if (shipped(p)) return "出荷済み";
  if (p.kubun === "引合") return "引合";
  const dt = daysTo(p.due);
  if (dt !== null && dt < 0) return "遅れ";
  if (p.mats.some((m) => !m.arrived)) return "材料待ち";
  return "進行中";
}

export function isWarn(p: Prop, warnDays: number) {
  const st = status(p);
  if (st !== "材料待ち" && st !== "進行中") return false;
  const dt = daysTo(p.due);
  return dt !== null && dt >= 0 && dt <= warnDays;
}

export const defectCount = (p: Prop) => p.defects.reduce((a, d) => a + Number(d.count || 0), 0);

// 完了していない最初の工程
export const curProc = (p: Prop) => p.procs.find((x) => x.status !== "完了")?.name ?? "—";

// 役割ごとに書ける欄
export const can = {
  order: (r: Role) => r === "営業" || r === "業務",
  kubun: (r: Role) => r === "業務",
  mats: (r: Role) => r === "業務",
  procs: (r: Role) => r === "現場",
  addDel: (r: Role) => r === "営業" || r === "業務",
};

// 営業が追加すると引合、業務が追加すると受注
export const kubunForNew = (r: Role) => (r === "営業" ? "引合" : "受注");

// 工程の状態を変えたときの日付の決まり
export function applyProcStatus(x: Proc, val: ProcStatus): Proc {
  const next = { ...x, status: val };
  if (val === "作業中" && !next.start) next.start = off(0);
  if (val === "完了") {
    if (!next.start) next.start = off(0);
    if (!next.end) next.end = off(0);
  }
  if (val === "未着手") {
    next.start = "";
    next.end = "";
  }
  return next;
}

// done 個の工程が完了、doing なら次の工程が作業中、の状態を作る（初期データ用）
export function makeProcs(done: number, doing: boolean): Proc[] {
  return PROCS.map((name, i) => {
    if (i < done) {
      const e = -(done - i) * 2;
      return { name, status: "完了", start: off(e - 2), end: off(e) };
    }
    if (i === done && doing) return { name, status: "作業中", start: off(-1), end: "" };
    return { name, status: "未着手", start: "", end: "" };
  });
}
