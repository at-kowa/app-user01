"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/board/fields";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

// 新規登録・パスワード再設定の入口は置かない（アカウントは作成者が管理画面で作る）
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return setErr("メールアドレスとパスワードを入れてください");
    setBusy(true);
    setErr("");
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      setErr(error.status === 400 ? "メールアドレスかパスワードが違います" : "ログインできませんでした。時間をおいてもう一度試してください");
      return;
    }
    window.location.replace("/");
  };

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="bg-ink px-5 py-3.5 text-white">
        <h1 className="text-xl font-bold tracking-wide">
          物件状況ボード<span className="ml-2.5 text-[13px] font-normal text-[#C9D1D6]">架空データの試作</span>
        </h1>
      </header>
      <main className="mx-auto max-w-md px-4 py-10">
        {!hasSupabaseConfig ? (
          <p className="rounded-md border border-line bg-white p-5 text-[15px]">接続先が設定されていません。作成者に連絡してください。</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4 rounded-md border border-line bg-white p-6">
            <h2 className="text-lg font-bold">ログイン</h2>
            <Field label="メールアドレス">
              <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 bg-white text-[15px] md:text-[15px]" />
            </Field>
            <Field label="パスワード">
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 bg-white text-[15px] md:text-[15px]" />
            </Field>
            <div className="min-h-5 text-[13px] text-st-red" role="alert">
              {err}
            </div>
            <Button type="submit" size="touch" disabled={busy}>
              {busy ? "確認しています…" : "ログイン"}
            </Button>
            <p className="text-[13px] text-muted-foreground">アカウントは役割（営業・業務・現場・工場長）ごとに作成者が用意しています。データはすべて架空です。</p>
          </form>
        )}
      </main>
    </div>
  );
}
