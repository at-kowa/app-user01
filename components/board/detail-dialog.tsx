"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BoardApi, Prop, ProcStatus } from "@/lib/board/types";
import { KUBUNS, PROC_STATUSES, PROCS, TEAMS } from "@/lib/board/types";
import { can, md } from "@/lib/board/logic";
import { CommitDate, CommitNumber, CommitText, Field, ReadValue, Select } from "./fields";
import { StatusTags } from "./tags";

type Ask = (message: string, okLabel?: string) => Promise<boolean>;

export function DetailDialog({ api, id, onClose, ask }: { api: BoardApi; id: string | null; onClose: () => void; ask: Ask }) {
  const p = id ? api.props.find((x) => x.id === id) : undefined;
  return (
    <Dialog open={!!p} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-5 sm:max-w-[860px]"
        data-testid="detail"
      >
        {p && <DetailBody key={p.id} api={api} p={p} onClose={onClose} ask={ask} />}
      </DialogContent>
    </Dialog>
  );
}

function Lock({ ok, who }: { ok: boolean; who: string }) {
  return ok ? null : <span className="text-xs font-normal text-muted-foreground">{who}だけが書けます</span>;
}

function Section({ title, lock, children }: { title: string; lock?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-3.5 pb-1.5">
      <h3 className="mb-2.5 flex items-baseline gap-2.5 text-base font-bold">
        {title} {lock}
      </h3>
      {children}
    </section>
  );
}

function DetailBody({ api, p, onClose, ask }: { api: BoardApi; p: Prop; onClose: () => void; ask: Ask }) {
  const r = api.role;
  const o = can.order(r);
  const m = can.mats(r);
  const pr = can.procs(r);
  const hist = api.history.filter((h) => h.id === p.id);

  const [defP, setDefP] = useState<string>(PROCS[0]);
  const [defN, setDefN] = useState("");
  const [defNote, setDefNote] = useState("");
  const [defErr, setDefErr] = useState("");

  const addDefect = async () => {
    const n = Number(defN);
    if (!n || n < 1) {
      setDefErr("不良の数を1以上で入れてください");
      return;
    }
    setDefErr("");
    await api.addDefect(p.id, { process: defP, count: n, note: defNote.trim() });
    setDefN("");
    setDefNote("");
  };

  return (
    <>
      <div className="mb-1.5 flex items-start justify-between gap-3 border-b border-line pb-3">
        <div>
          <div className="text-[13px] text-muted-foreground">
            {p.id}・役割：{r}
          </div>
          <DialogTitle className="text-xl font-bold">{p.name}</DialogTitle>
          <StatusTags p={p} warnDays={api.warnDays} className="mt-1.5" />
        </div>
        <Button variant="outline" size="touch" onClick={onClose}>
          閉じる
        </Button>
      </div>

      <Section title="受注" lock={<Lock ok={o} who="営業・業務" />}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-4 gap-y-2.5">
          <Field label="品名">{o ? <CommitText value={p.name} required onCommit={(v) => api.updateProp(p.id, "name", v)} /> : <ReadValue value={p.name} />}</Field>
          <Field label="客先">{o ? <CommitText value={p.cust} onCommit={(v) => api.updateProp(p.id, "cust", v)} /> : <ReadValue value={p.cust} />}</Field>
          <Field label="数量">{o ? <CommitNumber value={p.qty} onCommit={(v) => api.updateProp(p.id, "qty", v)} /> : <ReadValue value={p.qty} />}</Field>
          <Field label="重量(kg)">{o ? <CommitNumber value={p.weight} onCommit={(v) => api.updateProp(p.id, "weight", v)} /> : <ReadValue value={p.weight} />}</Field>
          <Field label="希望納期">{o ? <CommitDate value={p.due} onCommit={(v) => api.updateProp(p.id, "due", v)} /> : <ReadValue value={p.due || "—"} />}</Field>
          <Field label="出荷予定日">{o ? <CommitDate value={p.ship} onCommit={(v) => api.updateProp(p.id, "ship", v)} /> : <ReadValue value={p.ship || "—"} />}</Field>
          <Field label="担当班">{o ? <Select value={p.team} options={TEAMS} onChange={(v) => api.updateProp(p.id, "team", v)} /> : <ReadValue value={p.team} />}</Field>
          <Field label="受注区分">{can.kubun(r) ? <Select value={p.kubun} options={KUBUNS} onChange={(v) => api.updateProp(p.id, "kubun", v)} /> : <ReadValue value={p.kubun} />}</Field>
        </div>
      </Section>

      <Section title="材料" lock={<Lock ok={m} who="業務" />}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>部材名</TableHead>
              <TableHead>発注日</TableHead>
              <TableHead>入荷予定日</TableHead>
              <TableHead>入荷済み</TableHead>
              {m && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.mats.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-[13px] text-muted-foreground">
                  部材はまだ登録されていません
                </TableCell>
              </TableRow>
            )}
            {p.mats.map((x) =>
              m ? (
                <TableRow key={x.id}>
                  <TableCell className="min-w-36">
                    <CommitText value={x.name} ariaLabel="部材名" onCommit={(v) => api.updateMaterial(p.id, x.id, "name", v)} />
                  </TableCell>
                  <TableCell>
                    <CommitDate value={x.ordered} ariaLabel="発注日" onCommit={(v) => api.updateMaterial(p.id, x.id, "ordered", v)} />
                  </TableCell>
                  <TableCell>
                    <CommitDate value={x.eta} ariaLabel="入荷予定日" onCommit={(v) => api.updateMaterial(p.id, x.id, "eta", v)} />
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      className="size-6"
                      checked={x.arrived}
                      aria-label="入荷済み"
                      onCheckedChange={(c) => api.updateMaterial(p.id, x.id, "arrived", !!c)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="touch-sm"
                      className="border-st-red text-st-red"
                      onClick={async () => {
                        if (await ask(`部材「${x.name}」を削除します。よろしいですか？`)) await api.deleteMaterial(p.id, x.id);
                      }}
                    >
                      削除
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={x.id}>
                  <TableCell>{x.name}</TableCell>
                  <TableCell>{md(x.ordered)}</TableCell>
                  <TableCell>{md(x.eta)}</TableCell>
                  <TableCell>{x.arrived ? "入荷済み" : "未"}</TableCell>
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
        {m && (
          <div className="mt-2 flex gap-2">
            <Button variant="outline" size="touch-sm" onClick={() => api.addMaterial(p.id)}>
              部材を追加
            </Button>
          </div>
        )}
      </Section>

      <Section title="工程・不良" lock={<Lock ok={pr} who="現場" />}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>工程</TableHead>
              <TableHead>状態</TableHead>
              <TableHead>開始日</TableHead>
              <TableHead>完了日</TableHead>
              {pr && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.procs.map((x, i) =>
              pr ? (
                <TableRow key={x.name}>
                  <TableCell>{x.name}</TableCell>
                  <TableCell className="min-w-28">
                    <Select value={x.status} options={PROC_STATUSES} ariaLabel={`${x.name}の状態`} onChange={(v) => api.setProcStatus(p.id, i, v as ProcStatus)} />
                  </TableCell>
                  <TableCell>
                    <CommitDate value={x.start} ariaLabel={`${x.name}の開始日`} onCommit={(v) => api.setProcDate(p.id, i, "start", v)} />
                  </TableCell>
                  <TableCell>
                    <CommitDate value={x.end} ariaLabel={`${x.name}の完了日`} onCommit={(v) => api.setProcDate(p.id, i, "end", v)} />
                  </TableCell>
                  <TableCell>
                    {x.status === "未着手" && (
                      <Button variant="outline" size="touch-sm" onClick={() => api.setProcStatus(p.id, i, "作業中")}>
                        開始
                      </Button>
                    )}
                    {x.status === "作業中" && (
                      <Button size="touch-sm" onClick={() => api.setProcStatus(p.id, i, "完了")}>
                        完了
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={x.name}>
                  <TableCell>{x.name}</TableCell>
                  <TableCell>{x.status}</TableCell>
                  <TableCell>{md(x.start)}</TableCell>
                  <TableCell>{md(x.end)}</TableCell>
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>

        <h3 className="mt-4 mb-2.5 text-base font-bold">不良</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日付</TableHead>
              <TableHead>工程</TableHead>
              <TableHead>数</TableHead>
              <TableHead>ひとこと</TableHead>
              {pr && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.defects.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-[13px] text-muted-foreground">
                  不良の登録はありません
                </TableCell>
              </TableRow>
            )}
            {p.defects.map((x) => (
              <TableRow key={x.id}>
                <TableCell>{md(x.date)}</TableCell>
                <TableCell>{x.process}</TableCell>
                <TableCell>{x.count}</TableCell>
                <TableCell className="whitespace-normal">{x.note}</TableCell>
                {pr && (
                  <TableCell>
                    <Button
                      variant="outline"
                      size="touch-sm"
                      className="border-st-red text-st-red"
                      onClick={async () => {
                        if (await ask("この不良の記録を削除します。よろしいですか？")) await api.deleteDefect(p.id, x.id);
                      }}
                    >
                      削除
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {pr && (
          <>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <Field label="工程" className="w-36">
                <Select value={defP} options={PROCS} onChange={setDefP} ariaLabel="不良の工程" />
              </Field>
              <Field label="数" className="w-24">
                <Input type="number" min={1} inputMode="numeric" value={defN} onChange={(e) => setDefN(e.target.value)} className="h-10 bg-white text-[15px] md:text-[15px]" aria-label="不良の数" />
              </Field>
              <Field label="ひとこと" className="min-w-44 flex-1">
                <Input type="text" value={defNote} onChange={(e) => setDefNote(e.target.value)} className="h-10 bg-white text-[15px] md:text-[15px]" aria-label="ひとこと" />
              </Field>
              <Button variant="outline" size="touch" onClick={addDefect}>
                不良を登録
              </Button>
            </div>
            <div className="min-h-5 text-[13px] text-st-red" role="alert">
              {defErr}
            </div>
          </>
        )}
      </Section>

      <Section title="変更履歴">
        {hist.length ? (
          <ul className="max-h-56 overflow-auto text-[13px]">
            {hist.map((h, i) => (
              <li key={i} className="border-b border-[#E6E8E4] py-1">
                {h.at}　{h.role}　{h.field}：{h.before || "（空）"} → {h.after || "（空）"}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-[13px] text-muted-foreground">まだ変更はありません</div>
        )}
      </Section>

      {can.addDel(r) && (
        <div className="mt-2 border-t border-line pt-3.5">
          <Button
            variant="outline"
            size="touch"
            className="border-st-red text-st-red"
            onClick={async () => {
              if (await ask(`物件 ${p.id}「${p.name}」を削除します。元に戻せません。よろしいですか？`)) {
                await api.deleteProp(p.id);
                onClose();
              }
            }}
          >
            この物件を削除
          </Button>
        </div>
      )}
    </>
  );
}
