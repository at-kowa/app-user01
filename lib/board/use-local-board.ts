"use client";

// 第1段階：データをこのブラウザ（Edge）の中だけに保存する実装。
// 第2段階でデータベース（Supabase）の実装に差し替える。画面の部品は BoardApi だけを使う。
import { useCallback, useRef, useState } from "react";
import type { BoardApi, HistoryEntry, Prop, Role } from "./types";
import { LABELS } from "./types";
import { applyProcStatus, kubunForNew, makeProcs, nowStr, off } from "./logic";
import { seedProps } from "./seed";

const KEY = "app-user01-board-v1";

type LocalState = {
  props: Prop[];
  history: HistoryEntry[];
  warnDays: number;
  role: Role;
};

const seedState = (role: Role = "業務"): LocalState => ({ props: seedProps(), history: [], warnDays: 7, role });

function load(): { state: LocalState; ok: boolean } {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { state: JSON.parse(raw) as LocalState, ok: true };
    return { state: seedState(), ok: true };
  } catch {
    return { state: seedState(), ok: false };
  }
}

function save(s: LocalState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

const newId = (prefix: string) =>
  `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)}`;

export function useLocalBoard(): BoardApi {
  const [init] = useState(load);
  const [state, setState] = useState<LocalState>(init.state);
  const [storageOK, setStorageOK] = useState(init.ok);
  // 続けて変更しても最新の状態に積み重なるよう、今の状態をここにも持つ
  const current = useRef<LocalState>(init.state);

  // 変更は必ずここを通す：複製→変更→履歴→保存
  const commit = useCallback((mutate: (s: LocalState, log: (id: string, field: string, before: unknown, after: unknown) => void) => void) => {
    const s: LocalState = structuredClone(current.current);
    const log = (id: string, field: string, before: unknown, after: unknown) => {
      s.history.unshift({ at: nowStr(), role: s.role, id, field, before: String(before ?? ""), after: String(after ?? "") });
      if (s.history.length > 3000) s.history.length = 3000;
    };
    mutate(s, log);
    current.current = s;
    setState(s);
    setStorageOK(save(s));
  }, []);

  const find = (s: LocalState, id: string) => s.props.find((p) => p.id === id);

  const api: BoardApi = {
    ready: true,
    storageOK,
    props: state.props,
    history: state.history,
    role: state.role,
    warnDays: state.warnDays,
    setRole: (role) => commit((s) => void (s.role = role)),
    setWarnDays: (n) => commit((s) => void (s.warnDays = n)),

    updateProp: async (id, key, value) =>
      commit((s, log) => {
        const p = find(s, id);
        if (!p || String(p[key]) === String(value)) return;
        log(id, LABELS[key], p[key], value);
        (p as Record<string, unknown>)[key] = value;
      }),

    addMaterial: async (id) =>
      commit((s, log) => {
        const p = find(s, id);
        if (!p) return;
        p.mats.push({ id: newId(`${id}-m`), name: "新しい部材", ordered: off(0), eta: "", arrived: false });
        log(id, "材料の追加", "", "新しい部材");
      }),

    updateMaterial: async (id, matId, key, value) =>
      commit((s, log) => {
        const x = find(s, id)?.mats.find((m) => m.id === matId);
        if (!x || x[key] === value) return;
        if (key === "arrived") log(id, `材料「${x.name}」入荷`, x.arrived ? "入荷済み" : "未", value ? "入荷済み" : "未");
        else log(id, `材料「${x.name}」${{ name: "部材名", ordered: "発注日", eta: "入荷予定日" }[key]}`, x[key], value);
        (x as Record<string, unknown>)[key] = value;
      }),

    deleteMaterial: async (id, matId) =>
      commit((s, log) => {
        const p = find(s, id);
        const i = p?.mats.findIndex((m) => m.id === matId) ?? -1;
        if (!p || i < 0) return;
        log(id, "材料の削除", p.mats[i].name, "");
        p.mats.splice(i, 1);
      }),

    setProcStatus: async (id, index, val) =>
      commit((s, log) => {
        const p = find(s, id);
        const x = p?.procs[index];
        if (!p || !x || x.status === val) return;
        p.procs[index] = applyProcStatus(x, val);
        log(id, `工程「${x.name}」`, x.status, val);
      }),

    setProcDate: async (id, index, key, value) =>
      commit((s, log) => {
        const x = find(s, id)?.procs[index];
        if (!x || x[key] === value) return;
        log(id, `工程「${x.name}」${key === "start" ? "開始日" : "完了日"}`, x[key], value);
        x[key] = value;
      }),

    addDefect: async (id, input) =>
      commit((s, log) => {
        const p = find(s, id);
        if (!p) return;
        p.defects.push({ id: newId(`${id}-d`), ...input, date: off(0) });
        log(id, "不良の登録", "", `${input.process} ${input.count}個 ${input.note}`);
      }),

    deleteDefect: async (id, defectId) =>
      commit((s, log) => {
        const p = find(s, id);
        const i = p?.defects.findIndex((d) => d.id === defectId) ?? -1;
        if (!p || i < 0) return;
        const d = p.defects[i];
        log(id, "不良の削除", `${d.process} ${d.count}個`, "");
        p.defects.splice(i, 1);
      }),

    addProp: async (input) => {
      // 削除した物件の番号も履歴に残るので、使ったことのある番号は使い回さない
      const s0 = current.current;
      const max = s0.props.reduce((a, p) => Math.max(a, Number(p.id.replace(/\D/g, "")) || 0), 100);
      const used = new Set(s0.history.map((h) => h.id));
      let n = max + 1;
      while (used.has(`P-${n}`)) n++;
      const id = `P-${n}`;
      commit((s, log) => {
        const p: Prop = { id, ...input, ship: "", kubun: kubunForNew(s.role), mats: [], procs: makeProcs(0, false), defects: [] };
        s.props.push(p);
        log(id, "物件の追加", "", `${p.name}（${p.kubun}）`);
      });
      return id;
    },

    deleteProp: async (id) =>
      commit((s, log) => {
        const p = find(s, id);
        if (!p) return;
        log(id, "物件の削除", p.name, "");
        s.props = s.props.filter((x) => x.id !== id);
      }),

    reset: async () =>
      commit((s) => {
        Object.assign(s, seedState(s.role));
      }),
  };
  return api;
}
