-- 物件状況ボード：ログイン用アカウントに役割を付ける
-- 先に Supabase の管理画面（Authentication）でアカウントを作っておく。
-- （　）の所に、作ったアカウントのメールアドレスを入れてから実行する。
-- メールアドレスを入れたこのファイルは保存しない・コミットしない（リポジトリには空欄のまま置く）。
-- 確認用の「役割なし」のアカウントは、ここには入れない（役割が無いと何も見えないことを確かめるため）。

insert into public.app_user01_roles (user_id, role)
select u.id, v.role
from (values
  ('（営業のアカウントのメールアドレス）', '営業'),
  ('（業務のアカウントのメールアドレス）', '業務'),
  ('（現場のアカウントのメールアドレス）', '現場'),
  ('（工場長のアカウントのメールアドレス）', '工場長')
) as v (email, role)
join auth.users u on lower(u.email) = lower(v.email)
on conflict (user_id) do update set role = excluded.role;

-- 確認：4行（営業・業務・現場・工場長）が出ればよい
select u.email, r.role
from public.app_user01_roles r
join auth.users u on u.id = r.user_id
order by r.role;
