import { Button } from "@/components/ui/button";

// 保存できなかったときの理由（黙って失敗しない）
export function ErrorBar({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 border-l-4 border-st-red bg-st-red-bg px-5 py-2.5 text-[14px] text-st-red">
      <span className="font-bold">保存できませんでした</span>
      <span className="text-ink">{message}</span>
      <span className="flex-1" />
      <Button variant="outline" size="touch-sm" onClick={onClose}>
        閉じる
      </Button>
    </div>
  );
}
