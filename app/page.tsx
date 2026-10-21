"use client";

import { Board } from "@/components/board/board";
import { useSupabaseBoard } from "@/lib/board/use-supabase-board";

const headBtn =
  "min-h-11 cursor-pointer rounded-md border border-[#56636C] px-3.5 text-white hover:border-white disabled:cursor-default disabled:opacity-60";

function Message({ title, children, onSignOut }: { title: string; children: React.ReactNode; onSignOut?: () => void }) {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="flex items-center justify-between gap-3 bg-ink px-5 py-3.5 text-white">
        <h1 className="text-xl font-bold tracking-wide">
          物件状況ボード<span className="ml-2.5 text-[13px] font-normal text-[#C9D1D6]">架空データの試作</span>
        </h1>
        {onSignOut && (
          <button type="button" className={headBtn} onClick={onSignOut}>
            ログアウト
          </button>
        )}
      </header>
      <main className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-md border border-line bg-white p-6" role="alert">
          <h2 className="mb-2 text-lg font-bold">{title}</h2>
          <div className="text-[15px]">{children}</div>
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  const { api, phase, reload, signOut } = useSupabaseBoard();

  if (phase === "noconfig")
    return <Message title="接続先が設定されていません">環境変数（NEXT_PUBLIC_SUPABASE_URL・NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY）が入っていません。作成者に連絡してください。</Message>;
  if (phase === "norole")
    return (
      <Message title="このアカウントには役割が登録されていません" onSignOut={signOut}>
        役割（営業・業務・現場・工場長）を登録したアカウントでログインし直してください。
      </Message>
    );
  if (phase === "offline")
    return (
      <Message title="データを読めませんでした" onSignOut={signOut}>
        {api.error}
        <br />
        研修用のデータベースが一時停止している場合は、管理者に再開を頼んでください。
      </Message>
    );

  return (
    <Board
      api={api}
      headerExtra={
        <>
          <button type="button" className={headBtn} onClick={() => void reload()} disabled={!api.ready}>
            最新にする
          </button>
          <button type="button" className={headBtn} onClick={() => void signOut()}>
            ログアウト
          </button>
        </>
      }
    />
  );
}
