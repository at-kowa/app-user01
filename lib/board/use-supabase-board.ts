"use client";

// 第2段階：データを Supabase（app_user01_ の表）に保存する実装。
// 書ける欄の制限・変更履歴・物件番号・受注区分の決定はデータベース側（RLS・トリガー）が行う。
// ここは読み書きを頼み、断られたら理由を画面に出すだけ。
import { useCallback, useEffect, useState } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import type { BoardApi, HistoryEntry, ProcStatus, Prop, Role } from "./types";
import { applyProcStatus, jstDateTime, kubunForNew, off } from "./logic";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

export type BoardPhase = "loading" | "ok" | "norole" | "noconfig" | "offline";

const T = {
  roles: "app_user01_roles",
  props: "app_user01_properties",
  mats: "app_user01_materials",
  procs: "app_user01_processes",
  defects: "app_user01_defects",
  history: "app_user01_history",
} as const;

type Row = Record<string, unknown>;
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const numOrEmpty = (v: unknown): number | "" => (v === null || v === undefined || v === "" ? "" : Number(v));
const orNull = (v: string | number | "") => (v === "" ? null : v);

// データベースが断ったときの理由を、画面に出す言葉にする
function explain(e: Pick<PostgrestError, "code" | "message">): string {
  if (e.code === "P0001") return e.message; // トリガーが返した理由（例：受注区分は業務だけが書けます）
  if (e.code === "42501") return "この操作は今の役割ではできません（データベースが止めました）";
  if (e.code === "23514") return "入力できない値です（文字数や数の範囲を確かめてください）";
  if (e.code === "23502") return "必須の項目が空です";
  if (e.code === "22007" || e.code === "22008") return "日付の形が正しくありません";
  if (/fetch|network/i.test(e.message)) return "データベースにつながりません。ネットワークを確かめて「最新にする」を押してください";
  return `保存できませんでした（${e.message}）`;
}

function assemble(props: Row[], mats: Row[], procs: Row[], defects: Row[]): Prop[] {
  const byId = new Map<string, Prop>();
  for (const r of props) {
    byId.set(s(r.id), {
      id: s(r.id),
      name: s(r.name),
      cust: s(r.cust),
      qty: numOrEmpty(r.qty),
      weight: numOrEmpty(r.weight),
      due: s(r.due),
      ship: s(r.ship),
      team: s(r.team),
      kubun: s(r.kubun) as Prop["kubun"],
      mats: [],
      procs: [],
      defects: [],
    });
  }
  for (const r of mats) byId.get(s(r.property_id))?.mats.push({ id: s(r.id), name: s(r.name), ordered: s(r.ordered), eta: s(r.eta), arrived: Boolean(r.arrived) });
  for (const r of procs)
    byId.get(s(r.property_id))?.procs.push({ name: s(r.name), status: s(r.status) as ProcStatus, start: s(r.start_date), end: s(r.end_date) });
  for (const r of defects)
    byId.get(s(r.property_id))?.defects.push({ id: s(r.id), process: s(r.process), count: Number(r.count), note: s(r.note), date: s(r.date) });
  return [...byId.values()];
}

export function useSupabaseBoard(): { api: BoardApi; phase: BoardPhase; reload: () => Promise<void>; signOut: () => Promise<void> } {
  const [phase, setPhase] = useState<BoardPhase>(hasSupabaseConfig ? "loading" : "noconfig");
  const [props, setProps] = useState<Prop[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [role, setRole] = useState<Role>("工場長");
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [client] = useState(() => (hasSupabaseConfig ? createClient() : null));

  const load = useCallback(async () => {
    const c = client;
    if (!c) return;
    const [r, p, m, pr, d, h] = await Promise.all([
      c.from(T.roles).select("role").maybeSingle(),
      c.from(T.props).select("id,name,cust,qty,weight,due,ship,team,kubun"),
      c.from(T.mats).select("id,property_id,name,ordered,eta,arrived").order("id"),
      c.from(T.procs).select("property_id,seq,name,status,start_date,end_date").order("seq"),
      c.from(T.defects).select("id,property_id,process,count,note,date").order("id"),
      c.from(T.history).select("id,at,role,property_id,field,before,after").order("id", { ascending: false }).limit(3000),
    ]);
    const firstErr = [r, p, m, pr, d, h].find((x) => x.error)?.error;
    if (firstErr) {
      setError(explain(firstErr));
      setPhase((ph) => (ph === "loading" ? "offline" : ph));
      return;
    }
    if (!r.data) {
      setPhase("norole");
      return;
    }
    setRole(r.data.role as Role);
    setProps(assemble(p.data ?? [], m.data ?? [], pr.data ?? [], d.data ?? []));
    setHistory(
      (h.data ?? []).map((x) => ({ at: jstDateTime(s(x.at)), role: s(x.role) as Role, id: s(x.property_id), field: s(x.field), before: s(x.before), after: s(x.after) })),
    );
    setPhase("ok");
  }, [client]);

  useEffect(() => {
    // 画面を開いたときに1回読む（データベースから取ってきた結果を画面の状態に入れる）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // 書き込みを頼む → 断られたら理由を出して入力欄を戻す → どちらでも最新を読み直す
  // 断られても「0行」で返ってくる場合（RLSで対象が見つからない）も、断られたものとして扱う
  const run = useCallback(
    async (op: () => PromiseLike<{ data: unknown; error: PostgrestError | null }>) => {
      const { data, error: e } = await op();
      if (e) {
        setError(explain(e));
        setResetKey((k) => k + 1);
      } else if (Array.isArray(data) && data.length === 0) {
        setError("この操作は今の役割ではできません（データベースが止めました）");
        setResetKey((k) => k + 1);
      }
      await load();
      return data;
    },
    [load],
  );

  const c = () => client!;
  const current = (id: string) => props.find((p) => p.id === id);

  const api: BoardApi = {
    ready: phase === "ok",
    storageOK: true,
    storageNote: "架空のデータだけを入れてください。データは研修用のデータベースに保存され、役割を登録したアカウントだけが見られます。",
    error,
    clearError: () => setError(null),
    resetKey,
    props,
    history,
    role,
    warnDays: 7,
    setRole: null,
    setWarnDays: null,

    updateProp: async (id, key, value) => {
      const v = key === "qty" || key === "weight" || key === "ship" ? orNull(value as string | number) : value;
      await run(() => c().from(T.props).update({ [key]: v }).eq("id", id).select("id"));
    },
    addMaterial: async (id) => {
      await run(() => c().from(T.mats).insert({ property_id: id, name: "新しい部材", ordered: off(0), eta: null, arrived: false }).select("id"));
    },
    updateMaterial: async (_id, matId, key, value) => {
      const v = key === "ordered" || key === "eta" ? orNull(value as string) : value;
      await run(() => c().from(T.mats).update({ [key]: v }).eq("id", Number(matId)).select("id"));
    },
    deleteMaterial: async (_id, matId) => {
      await run(() => c().from(T.mats).delete().eq("id", Number(matId)).select("id"));
    },
    setProcStatus: async (id, index, status) => {
      const x = current(id)?.procs[index];
      if (!x || x.status === status) return;
      const n = applyProcStatus(x, status);
      await run(() =>
        c()
          .from(T.procs)
          .update({ status: n.status, start_date: orNull(n.start), end_date: orNull(n.end) })
          .eq("property_id", id)
          .eq("seq", index + 1)
          .select("seq"),
      );
    },
    setProcDate: async (id, index, key, value) => {
      await run(() =>
        c()
          .from(T.procs)
          .update({ [key === "start" ? "start_date" : "end_date"]: orNull(value) })
          .eq("property_id", id)
          .eq("seq", index + 1)
          .select("seq"),
      );
    },
    addDefect: async (id, input) => {
      await run(() => c().from(T.defects).insert({ property_id: id, process: input.process, count: input.count, note: input.note }).select("id"));
    },
    deleteDefect: async (_id, defectId) => {
      await run(() => c().from(T.defects).delete().eq("id", Number(defectId)).select("id"));
    },
    addProp: async (input) => {
      // 物件番号と受注区分はデータベースが決める（送った受注区分は役割で上書きされる）
      const data = await run(() =>
        c()
          .from(T.props)
          .insert({ name: input.name, cust: input.cust, qty: orNull(input.qty), weight: orNull(input.weight), due: input.due, team: input.team, kubun: kubunForNew(role) })
          .select("id"),
      );
      return Array.isArray(data) && data[0] ? s((data[0] as Row).id) : null;
    },
    deleteProp: async (id) => {
      await run(() => c().from(T.props).delete().eq("id", id).select("id"));
    },
    reset: null,
  };

  const signOut = async () => {
    await client?.auth.signOut();
    window.location.replace("/login");
  };

  return { api, phase, reload: load, signOut };
}
