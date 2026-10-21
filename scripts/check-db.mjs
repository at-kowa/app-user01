// 物件状況ボード：データベース側の権限の確認（要件定義書 §8 #11〜15）
//
//   npm run check:db            … 全部（ログインして書き込みも試す）。人が実行する
//   npm run check:db -- --anon  … ログインせずに読むだけ。AIが実行してよい
//
// .env.local から接続先と確認用アカウントを読む。値（アドレス・パスワード・キー）は画面に出さない。
// 書き込みの確認には「【確認用】」で始まる物件を作り、最後に消す（変更履歴には残る）。
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  console.error(".env.local が見つかりません。C:\\work\\app-user01 で実行してください");
  process.exit(2);
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!URL || !KEY) {
  console.error(".env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY を入れてください");
  process.exit(2);
}
const anonOnly = process.argv.includes("--anon");

const TABLES = ["roles", "properties", "materials", "processes", "defects", "history"].map((t) => `app_user01_${t}`);
const P = "app_user01_properties";
const TEMP = "【確認用】削除してよい";
const ACCOUNTS = { 営業: "EIGYO", 業務: "GYOMU", 現場: "GENBA", 工場長: "KOJOCHO", 役割なし: "NOROLE" };

let pass = 0;
let fail = 0;
const check = (name, ok, note = "") => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${note ? `  -- ${note}` : ""}`);
};
const newClient = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
// 断られた＝エラー、または対象0行（RLSで見えない・書けない）
const denied = (r) => Boolean(r.error) || (Array.isArray(r.data) && r.data.length === 0);
const why = (r) => (r.error ? `${r.error.code ?? ""} ${r.error.message ?? ""}`.trim() : Array.isArray(r.data) ? `${r.data.length}行` : "");
const day = (n) => {
  const t = new Date(Date.now() + 9 * 3600e3 + n * 864e5); // 日本時間
  return t.toISOString().slice(0, 10);
};

async function login(role) {
  const k = ACCOUNTS[role];
  const email = process.env[`CHECK_${k}_EMAIL`];
  const password = process.env[`CHECK_${k}_PASSWORD`];
  if (!email || !password) {
    check(`${role}：.env.local に CHECK_${k}_EMAIL と CHECK_${k}_PASSWORD がある`, false);
    return null;
  }
  const c = newClient();
  const { error } = await c.auth.signInWithPassword({ email, password });
  check(`${role}：ログインできる`, !error, error ? error.message : "");
  return error ? null : c;
}

async function main() {
  // ---- #11 ログインしていない（公開用キーだけ）
  const anon = newClient();
  for (const t of TABLES) {
    const r = await anon.from(t).select("*").limit(5);
    check(`#11 未ログイン：${t} は読めない`, denied(r), why(r));
  }
  if (anonOnly) return;

  const r1 = await anon.from(P).insert({ name: TEMP, due: day(10), team: "A班", kubun: "受注" }).select("id");
  check("#11 未ログイン：物件を追加できない", denied(r1), why(r1));

  // ---- ログイン
  const c = {};
  for (const role of Object.keys(ACCOUNTS)) c[role] = await login(role);
  if (Object.values(c).some((x) => !x)) return;

  // ---- #12 役割の無いアカウント
  for (const t of TABLES) {
    const r = await c.役割なし.from(t).select("*").limit(5);
    check(`#12 役割なし：${t} は1件も読めない`, denied(r), why(r));
  }
  const r2 = await c.役割なし.from("app_user01_roles").insert({ user_id: "00000000-0000-0000-0000-000000000000", role: "業務" }).select("role");
  check("#12 役割なし：自分で役割を登録できない", denied(r2), why(r2));

  // ---- 役割ありは読める
  for (const role of ["営業", "業務", "現場", "工場長"]) {
    const r = await c[role].from("app_user01_roles").select("role").maybeSingle();
    check(`${role}：役割の表で自分の役割が「${role}」`, r.data?.role === role, why(r));
    const p = await c[role].from(P).select("id");
    check(`${role}：物件を読める`, !p.error && p.data.length > 0, why(p));
  }
  const up = await c.業務.from("app_user01_roles").update({ role: "業務" }).eq("role", "業務").select("role");
  check("役割あり：自分の役割を書き換えられない", denied(up), why(up));

  // ---- 確認用の物件を業務が作る（受注区分は営業に送っても業務の値に決まる）
  const ins = await c.業務.from(P).insert({ name: TEMP, due: day(10), team: "A班", kubun: "引合" }).select("id,kubun");
  const id = ins.data?.[0]?.id;
  check("業務：物件を追加できる（受注区分はDBが「受注」に決める）", !ins.error && ins.data?.[0]?.kubun === "受注", why(ins));
  if (!id) return;
  const pr = await c.業務.from("app_user01_processes").select("seq,name").eq("property_id", id);
  check("物件を追加すると工程が4行できる", pr.data?.length === 4, why(pr));
  const mat = await c.業務.from("app_user01_materials").insert({ property_id: id, name: "確認用の部材", ordered: day(0) }).select("id");
  check("業務：材料を追加できる", !mat.error && mat.data?.length === 1, why(mat));
  const matId = mat.data?.[0]?.id;
  const ship = await c.業務.from(P).update({ ship: day(12) }).eq("id", id).select("ship");
  check("業務：出荷予定日を書ける", !ship.error && ship.data?.[0]?.ship === day(12), why(ship));

  // ---- #13 現場
  let r = await c.現場.from("app_user01_materials").update({ arrived: true }).eq("id", matId).select("id");
  check("#13 現場：材料を変えられない", denied(r), why(r));
  r = await c.現場.from(P).update({ name: "現場が書いた" }).eq("id", id).select("id");
  check("#13 現場：受注欄（品名）を変えられない", denied(r), why(r));
  r = await c.現場.from(P).insert({ name: TEMP, due: day(10), team: "A班", kubun: "受注" }).select("id");
  check("#13 現場：物件を追加できない", denied(r), why(r));
  r = await c.現場.from(P).delete().eq("id", id).select("id");
  check("#13 現場：物件を削除できない", denied(r), why(r));
  r = await c.現場.from("app_user01_processes").update({ name: "出荷" }).eq("property_id", id).eq("seq", 1).select("seq");
  check("#13 現場：工程名は変えられない", denied(r), why(r));
  r = await c.現場.from("app_user01_processes").update({ status: "作業中", start_date: day(0) }).eq("property_id", id).eq("seq", 1).select("status");
  check("現場：工程の状態を変えられる", !r.error && r.data?.[0]?.status === "作業中", why(r));
  r = await c.現場.from("app_user01_defects").insert({ property_id: id, process: "切断", count: 1, note: "確認用" }).select("id");
  check("現場：不良を登録できる", !r.error && r.data?.length === 1, why(r));
  const defId = r.data?.[0]?.id;

  // ---- #14 営業
  r = await c.営業.from("app_user01_processes").update({ status: "完了" }).eq("property_id", id).eq("seq", 1).select("seq");
  check("#14 営業：工程を変えられない", denied(r), why(r));
  r = await c.営業.from("app_user01_defects").insert({ property_id: id, process: "切断", count: 1 }).select("id");
  check("#14 営業：不良を登録できない", denied(r), why(r));
  r = await c.営業.from("app_user01_defects").delete().eq("id", defId).select("id");
  check("#14 営業：不良を削除できない", denied(r), why(r));
  r = await c.営業.from(P).update({ kubun: "引合" }).eq("id", id).select("id");
  check("#14 営業：受注区分を変えられない", denied(r), why(r));
  r = await c.営業.from(P).update({ ship: day(20) }).eq("id", id).select("id");
  check("#14 営業：出荷予定日を変えられない", denied(r), why(r));
  r = await c.営業.from(P).update({ cust: "確認用の客先" }).eq("id", id).select("cust");
  check("営業：受注欄（客先）は書ける", !r.error && r.data?.[0]?.cust === "確認用の客先", why(r));
  r = await c.営業.from(P).insert({ name: TEMP, due: day(30), team: "B班", kubun: "受注", ship: day(31) }).select("id,kubun,ship");
  check("#14 営業：「受注」で送っても「引合」で登録され、出荷予定日は入らない", !r.error && r.data?.[0]?.kubun === "引合" && r.data?.[0]?.ship === null, why(r));
  if (r.data?.[0]?.id) {
    const d = await c.営業.from(P).delete().eq("id", r.data[0].id).select("id");
    check("営業：物件を削除できる", !d.error && d.data?.length === 1, why(d));
  }
  r = await c.営業.from(P).insert({ id: "P-999", name: TEMP, due: day(30), team: "B班", kubun: "引合" }).select("id");
  check("営業：物件番号を自分で決めて追加できない", denied(r), why(r));

  // ---- #15 工場長
  r = await c.工場長.from(P).insert({ name: TEMP, due: day(10), team: "A班", kubun: "受注" }).select("id");
  check("#15 工場長：物件を追加できない", denied(r), why(r));
  r = await c.工場長.from(P).update({ name: "工場長が書いた" }).eq("id", id).select("id");
  check("#15 工場長：物件を変えられない", denied(r), why(r));
  r = await c.工場長.from(P).delete().eq("id", id).select("id");
  check("#15 工場長：物件を削除できない", denied(r), why(r));
  r = await c.工場長.from("app_user01_materials").insert({ property_id: id, name: "工場長" }).select("id");
  check("#15 工場長：材料を追加できない", denied(r), why(r));
  r = await c.工場長.from("app_user01_materials").update({ arrived: true }).eq("id", matId).select("id");
  check("#15 工場長：材料を変えられない", denied(r), why(r));
  r = await c.工場長.from("app_user01_processes").update({ status: "完了" }).eq("property_id", id).eq("seq", 2).select("seq");
  check("#15 工場長：工程を変えられない", denied(r), why(r));
  r = await c.工場長.from("app_user01_defects").insert({ property_id: id, process: "切断", count: 1 }).select("id");
  check("#15 工場長：不良を登録できない", denied(r), why(r));

  // ---- #15 変更履歴はどの役割でも直接書けない・消せない
  for (const role of ["営業", "業務", "現場", "工場長"]) {
    r = await c[role].from("app_user01_history").insert({ role, property_id: id, field: "偽の履歴" }).select("id");
    check(`#15 ${role}：変更履歴に直接書けない`, denied(r), why(r));
    r = await c[role].from("app_user01_history").delete().eq("property_id", id).select("id");
    check(`#15 ${role}：変更履歴を消せない`, denied(r), why(r));
  }

  // ---- 断られた操作で値が変わっていないこと
  const after = await c.業務.from(P).select("name,kubun,ship").eq("id", id).single();
  check("断られた操作で物件の値が変わっていない", after.data?.name === TEMP && after.data?.kubun === "受注" && after.data?.ship === day(12), why(after));
  const m2 = await c.業務.from("app_user01_materials").select("arrived").eq("id", matId).single();
  check("断られた操作で材料の値が変わっていない", m2.data?.arrived === false, why(m2));

  // ---- 変更履歴がDBで書かれている（役割名で）
  const h = await c.工場長.from("app_user01_history").select("role,field").eq("property_id", id);
  const roles = new Set((h.data ?? []).map((x) => x.role));
  check("変更履歴が役割名（業務・現場・営業）で残る", roles.has("業務") && roles.has("現場") && roles.has("営業"), [...roles].join("・"));
  check("偽の履歴は残っていない", !(h.data ?? []).some((x) => x.field === "偽の履歴"));

  // ---- 後片付け（現場が不良を消す → 業務が物件を消す）
  if (defId) {
    r = await c.現場.from("app_user01_defects").delete().eq("id", defId).select("id");
    check("現場：不良を削除できる", !r.error && r.data?.length === 1, why(r));
  }
}

try {
  await main();
} finally {
  if (!anonOnly) {
    // 確認用の物件を消す（業務のアカウントで）
    const k = ACCOUNTS.業務;
    const c = newClient();
    const { error } = await c.auth.signInWithPassword({ email: process.env[`CHECK_${k}_EMAIL`] ?? "", password: process.env[`CHECK_${k}_PASSWORD`] ?? "" });
    if (!error) {
      const d = await c.from(P).delete().eq("name", TEMP).select("id");
      console.log(`後片付け：確認用の物件 ${d.data?.length ?? 0} 件を削除しました`);
    }
  }
  console.log(`\n${pass} / ${pass + fail} PASS`);
  process.exitCode = fail ? 1 : 0;
}
