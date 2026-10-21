"use client";

// 削除などの前に出す確認（ブラウザ標準の confirm の代わり）
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";

export function useConfirm() {
  const [msg, setMsg] = useState<string | null>(null);
  const [okLabel, setOkLabel] = useState("削除する");
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const ask = useCallback(
    (message: string, ok = "削除する") =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setOkLabel(ok);
        setMsg(message);
      }),
    [],
  );

  const answer = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setMsg(null);
  };

  const element = (
    <Dialog open={msg !== null} onOpenChange={(open) => !open && answer(false)}>
      <DialogContent showCloseButton={false} className="sm:max-w-md" data-testid="confirm">
        <DialogTitle className="text-base leading-relaxed font-bold">{msg}</DialogTitle>
        <DialogFooter>
          <Button variant="outline" size="touch" onClick={() => answer(false)}>
            やめる
          </Button>
          <Button size="touch" className="bg-st-red hover:bg-st-red/85" onClick={() => answer(true)}>
            {okLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { ask, element };
}
