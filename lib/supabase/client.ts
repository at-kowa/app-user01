import { createBrowserClient } from "@supabase/ssr";

// 接続先は環境変数から読む（PC＝.env.local／公開版＝Vercelの環境変数）。値はコードに書かない
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey);

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}
