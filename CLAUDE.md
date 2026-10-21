@AGENTS.md

# このリポジトリで Claude Code が守ること

- 物件状況ボード（架空データの学習用の試作）。要件は docs/requirements.md（第2版）。変更前に読む
- 公開リポジトリ：実在の会社名・工場名・客先名・個人名・社内資料名・実データを書かない
- 鍵・パスワードをコード・コミット・チャットに書かない。`.env*` は読まない（.claude/settings.json で拒否）
- Git：作業ブランチで commit・push まで。main への直接 push・強制 push・履歴の書き換え・マージはしない（PRとマージは人）
- データベース（Supabase）：表やデータを変える SQL は supabase/ に書くだけで実行しない。実行は人が SQL Editor で行う
- 画面の部品は lib/board/types.ts の BoardApi だけを通してデータを扱う（保存先の差し替えをここに閉じ込めるため）
- 報告は「確かめたこと」と「確かめていないこと」を分けて書く
