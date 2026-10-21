"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BoardApi, Status } from "@/lib/board/types";
import { ROLES, STATES, TEAMS } from "@/lib/board/types";
import { can, defectCount, isWarn, shipped, status } from "@/lib/board/logic";
import { cn } from "@/lib/utils";
import { useConfirm } from "./confirm";
import { DetailDialog } from "./detail-dialog";
import { Select } from "./fields";
import { NewPropDialog } from "./new-prop-dialog";
import { PropCard } from "./prop-card";
import { ST } from "./styles";

type StateFilter = "すべて" | Status | "納期注意";

const chip =
  "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-line bg-white px-3.5 py-1.5 aria-pressed:border-ink aria-pressed:shadow-[inset_0_0_0_1px_var(--ink)]";

// 欄を離れたときに確定する入力があるので、閉じる前にフォーカスを外して確定させる
const blurActive = () => (document.activeElement as HTMLElement | null)?.blur?.();

export function Board({ api, headerExtra }: { api: BoardApi; headerExtra?: React.ReactNode }) {
  const [fState, setFState] = useState<StateFilter>("すべて");
  const [fTeam, setFTeam] = useState("すべて");
  const [fDefect, setFDefect] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const { ask, element: confirmElement } = useConfirm();

  const props = api.props;
  const cnt = (s: Status) => props.filter((p) => status(p) === s).length;
  const warnN = props.filter((p) => isWarn(p, api.warnDays)).length;
  const defN = props.filter((p) => !shipped(p) && defectCount(p) > 0).length;

  const items = props
    .filter((p) => {
      if (fTeam !== "すべて" && p.team !== fTeam) return false;
      if (fState === "納期注意") {
        if (!isWarn(p, api.warnDays)) return false;
      } else if (fState !== "すべて" && status(p) !== fState) return false;
      if (fDefect && !(defectCount(p) > 0 && !shipped(p))) return false;
      return true;
    })
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));

  const close = () => {
    blurActive();
    setOpenId(null);
  };

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 bg-ink px-5 py-3.5 text-white">
        <h1 className="text-xl font-bold tracking-wide">
          物件状況ボード<span className="ml-2.5 text-[13px] font-normal text-[#C9D1D6]">架空データの試作</span>
        </h1>
        <div className="flex flex-wrap items-center gap-1.5" aria-label="役割">
          {api.setRole ? (
            <>
              <span className="mr-1 text-[13px] text-[#C9D1D6]">役割</span>
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={api.role === r}
                  onClick={() => api.setRole?.(r)}
                  className="min-h-11 min-w-19 cursor-pointer rounded-md border border-[#56636C] px-3.5 aria-pressed:border-white aria-pressed:bg-white aria-pressed:font-bold aria-pressed:text-ink"
                >
                  {r}
                </button>
              ))}
            </>
          ) : (
            <span className="text-[13px] text-[#C9D1D6]">
              役割 <b className="text-white">{api.role}</b>
            </span>
          )}
          {headerExtra}
        </div>
      </header>

      {!api.storageOK && (
        <div className="bg-st-yellow-bg px-5 py-2.5 text-[13px] text-[#5E4700]">この画面では入力内容を保存できません。Edgeの通常のウィンドウで開いてください。</div>
      )}

      <div className="flex flex-wrap items-stretch gap-2 px-5 pt-3.5 pb-1" data-testid="summary">
        <button type="button" className={chip} aria-pressed={fState === "すべて"} onClick={() => setFState("すべて")}>
          すべて <b className="text-xl tabular-nums">{props.length}</b>
        </button>
        {STATES.map((s) => (
          <button key={s} type="button" className={chip} aria-pressed={fState === s} onClick={() => setFState(s)} data-st={s}>
            <span className={cn("inline-block size-3 rounded-[2px] border border-black/15", ST[s].dot)} />
            {s} <b className="text-xl tabular-nums">{cnt(s)}</b>
          </button>
        ))}
        <button type="button" className={chip} aria-pressed={fState === "納期注意"} onClick={() => setFState("納期注意")} data-st="納期注意">
          納期注意 <b className="text-xl tabular-nums">{warnN}</b>
        </button>
        <button type="button" className={chip} aria-pressed={fDefect} onClick={() => setFDefect(!fDefect)} data-def="1">
          不良あり <b className="text-xl tabular-nums">{defN}</b>
        </button>
      </div>
      <div className="flex flex-wrap gap-3.5 px-5 pt-1 text-[13px] text-muted-foreground" data-testid="teams">
        班ごとの進行中：
        {TEAMS.map((tm) => (
          <span key={tm}>
            {tm} <b className="text-ink tabular-nums">{props.filter((p) => p.team === tm && status(p) === "進行中").length}</b> 件
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2.5 px-5 py-3">
        <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          担当班
          <Select value={fTeam} options={["すべて", ...TEAMS]} onChange={setFTeam} className="w-28" ariaLabel="担当班で絞り込む" />
        </label>
        <span className="text-[13px] text-muted-foreground" data-testid="count">
          {items.length} 件表示（納期の近い順）
        </span>
        <span className="flex-1" />
        {can.addDel(api.role) && (
          <Button size="touch" onClick={() => setNewOpen(true)}>
            物件を追加
          </Button>
        )}
      </div>

      <main className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 px-5 pb-6 max-sm:px-3" data-testid="list">
        {!api.ready ? (
          <div className="col-span-full rounded-md border border-dashed border-line bg-white p-10 text-center text-muted-foreground">読み込んでいます…</div>
        ) : items.length === 0 ? (
          <div className="col-span-full rounded-md border border-dashed border-line bg-white p-10 text-center text-muted-foreground">
            条件に合う物件はありません。上の絞り込みを「すべて」に戻してください。
          </div>
        ) : (
          items.map((p) => <PropCard key={p.id} p={p} warnDays={api.warnDays} onOpen={setOpenId} />)
        )}
      </main>

      <footer className="flex flex-wrap items-center gap-3 border-t border-line px-5 pt-4 pb-8 text-[13px] text-muted-foreground">
        <span>架空のデータだけを入れてください。データはこのPCのEdgeの中だけに保存され、閲覧データを削除すると消えます。</span>
        <span className="flex-1" />
        <label className="flex items-center gap-1.5">
          納期注意の日数
          <Input
            key={api.warnDays}
            type="number"
            min={1}
            max={60}
            defaultValue={api.warnDays}
            className="h-10 w-[70px] bg-white"
            aria-label="納期注意の日数"
            onBlur={(e) => {
              const v = Number(e.currentTarget.value);
              if (!v || v < 1 || v > 60) e.currentTarget.value = String(api.warnDays);
              else if (v !== api.warnDays) api.setWarnDays(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          日以内
        </label>
        {api.reset && (
          <Button
            variant="outline"
            size="touch-sm"
            className="border-st-red text-st-red"
            onClick={async () => {
              if (!(await ask("入力した内容と変更履歴をすべて消して、初期データに戻します。よろしいですか？", "初期データに戻す"))) return;
              await api.reset?.();
              setFState("すべて");
              setFTeam("すべて");
              setFDefect(false);
            }}
          >
            初期データに戻す
          </Button>
        )}
      </footer>

      <DetailDialog api={api} id={openId} onClose={close} ask={ask} />
      <NewPropDialog
        api={api}
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(id) => {
          setNewOpen(false);
          setOpenId(id);
        }}
      />
      {confirmElement}
    </div>
  );
}
