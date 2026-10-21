"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { BoardApi } from "@/lib/board/types";
import { TEAMS } from "@/lib/board/types";
import { kubunForNew } from "@/lib/board/logic";
import { Field, Select } from "./fields";

const inputCls = "h-10 bg-white text-[15px] md:text-[15px]";

export function NewPropDialog({ api, open, onClose, onCreated }: { api: BoardApi; open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="p-5 sm:max-w-[860px]" data-testid="new-prop">
        {open && <NewPropForm api={api} onClose={onClose} onCreated={onCreated} />}
      </DialogContent>
    </Dialog>
  );
}

function NewPropForm({ api, onClose, onCreated }: { api: BoardApi; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [cust, setCust] = useState("");
  const [qty, setQty] = useState("");
  const [weight, setWeight] = useState("");
  const [due, setDue] = useState("");
  const [team, setTeam] = useState<string>(TEAMS[0]);
  const [err, setErr] = useState("");
  const kub = kubunForNew(api.role);

  const save = async () => {
    if (!name.trim()) return setErr("品名を入れてください");
    if (!due) return setErr("希望納期を入れてください");
    setErr("");
    const id = await api.addProp({ name: name.trim(), cust: cust.trim(), qty: Number(qty) || "", weight: Number(weight) || "", due, team });
    if (id) onCreated(id);
  };

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
        <div>
          <div className="text-[13px] text-muted-foreground">
            役割：{api.role}（「{kub}」として登録されます）
          </div>
          <DialogTitle className="text-xl font-bold">物件を追加</DialogTitle>
        </div>
        <Button variant="outline" size="touch" onClick={onClose}>
          閉じる
        </Button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-4 gap-y-2.5 pt-1">
        <Field label="品名">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="客先（架空）">
          <Input value={cust} onChange={(e) => setCust(e.target.value)} className={inputCls} />
        </Field>
        <Field label="数量">
          <Input type="number" min={0} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} />
        </Field>
        <Field label="重量(kg)">
          <Input type="number" min={0} inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value)} className={inputCls} />
        </Field>
        <Field label="希望納期">
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} />
        </Field>
        <Field label="担当班">
          <Select value={team} options={TEAMS} onChange={setTeam} />
        </Field>
      </div>
      <div className="min-h-5 text-[13px] text-st-red" role="alert">
        {err}
      </div>
      <div>
        <Button size="touch" onClick={save}>
          物件を追加
        </Button>
      </div>
    </>
  );
}
