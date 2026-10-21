-- 物件状況ボード（架空データの試作）：表・権限・RLS・トリガー
-- 研修用の共有プロジェクトで使うため、名前はすべて app_user01_ で始める。
-- 実行は人が SQL Editor で行う（1回だけ。やり直すときは 99_drop.sql を先に流す）。
-- この中に「削除の文」は無い。既存の他の表には触れない。

-- ============================================================
-- 1. 表
-- ============================================================

-- ログイン用アカウントと役割の対応（登録は人が SQL Editor で行う。03_roles.sql）
create table public.app_user01_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('営業', '業務', '現場', '工場長'))
);

-- 物件番号の連番（P-101 から。消した番号は使い回さない）
create sequence public.app_user01_property_no start 101;

create table public.app_user01_properties (
  id text primary key default ('P-' || nextval('public.app_user01_property_no')),
  name text not null check (char_length(name) between 1 and 50),
  cust text not null default '' check (char_length(cust) <= 30),
  qty integer check (qty >= 0),
  weight numeric(10, 1) check (weight >= 0),
  due date not null,
  ship date,
  team text not null check (team in ('A班', 'B班', 'C班')),
  kubun text not null check (kubun in ('引合', '受注')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_user01_materials (
  id bigint generated always as identity primary key,
  property_id text not null references public.app_user01_properties (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  ordered date,
  eta date,
  arrived boolean not null default false
);
create index on public.app_user01_materials (property_id);

-- 工程は1物件に4行（物件を追加するとトリガーが作る）
create table public.app_user01_processes (
  property_id text not null references public.app_user01_properties (id) on delete cascade,
  seq smallint not null check (seq between 1 and 4),
  name text not null check (name in ('切断', '溶接', 'めっき手配', '出荷')),
  status text not null default '未着手' check (status in ('未着手', '作業中', '完了')),
  start_date date,
  end_date date,
  primary key (property_id, seq)
);

create table public.app_user01_defects (
  id bigint generated always as identity primary key,
  property_id text not null references public.app_user01_properties (id) on delete cascade,
  process text not null check (process in ('切断', '溶接', 'めっき手配', '出荷')),
  count integer not null check (count >= 1),
  note text not null default '' check (char_length(note) <= 100),
  date date not null default ((now() at time zone 'Asia/Tokyo')::date)
);
create index on public.app_user01_defects (property_id);

-- 変更履歴（トリガーだけが書く。物件を消しても残す。個人は記録せず役割名だけ）
create table public.app_user01_history (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  role text not null,
  property_id text not null,
  field text not null,
  before text not null default '',
  after text not null default ''
);
create index on public.app_user01_history (property_id);

-- ============================================================
-- 2. ログイン中のアカウントの役割（役割の表に無ければ null）
-- ============================================================
create function public.app_user01_my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.app_user01_roles where user_id = (select auth.uid())
$$;

-- ============================================================
-- 3. トリガー：書ける列の制限・自動で決める値
-- ============================================================

-- 物件の追加：受注区分は役割で決める（営業＝引合、業務＝受注）。出荷予定日は業務だけ
create function public.app_user01_properties_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r text := public.app_user01_my_role();
begin
  if r = '営業' then
    new.kubun := '引合';
    new.ship := null;
  elsif r = '業務' then
    new.kubun := '受注';
  end if;
  return new;
end;
$$;

-- 物件の変更：受注区分と出荷予定日は業務だけ（役割の無い管理の操作は止めない）
create function public.app_user01_properties_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r text := public.app_user01_my_role();
begin
  if r is not null and r <> '業務' then
    if new.kubun is distinct from old.kubun then
      raise exception '受注区分は業務だけが書けます';
    end if;
    if new.ship is distinct from old.ship then
      raise exception '出荷予定日は業務だけが書けます';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- 物件を追加したら工程を4行作る
create function public.app_user01_properties_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_user01_processes (property_id, seq, name)
  values (new.id, 1, '切断'), (new.id, 2, '溶接'), (new.id, 3, 'めっき手配'), (new.id, 4, '出荷');
  return null;
end;
$$;

-- ============================================================
-- 4. トリガー：変更履歴
-- ============================================================

-- 履歴に1行書く（役割の無い操作は「管理」）
create function public.app_user01_log(p_property_id text, p_field text, p_before text, p_after text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.app_user01_history (role, property_id, field, before, after)
  values (coalesce(public.app_user01_my_role(), '管理'), p_property_id, p_field, coalesce(p_before, ''), coalesce(p_after, ''));
$$;

create function public.app_user01_properties_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  o jsonb;
  n jsonb;
  k text;
  lbl text;
begin
  if tg_op = 'INSERT' then
    perform public.app_user01_log(new.id, '物件の追加', '', new.name || '（' || new.kubun || '）');
  elsif tg_op = 'DELETE' then
    perform public.app_user01_log(old.id, '物件の削除', old.name, '');
  else
    o := to_jsonb(old);
    n := to_jsonb(new);
    for k, lbl in
      select * from (values ('name', '品名'), ('cust', '客先'), ('qty', '数量'), ('weight', '重量(kg)'),
                            ('due', '希望納期'), ('ship', '出荷予定日'), ('team', '担当班'), ('kubun', '受注区分')) as v (k, l)
    loop
      if o -> k is distinct from n -> k then
        perform public.app_user01_log(new.id, lbl, o ->> k, n ->> k);
      end if;
    end loop;
  end if;
  return null;
end;
$$;

create function public.app_user01_materials_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.app_user01_log(new.property_id, '材料の追加', '', new.name);
  elsif tg_op = 'DELETE' then
    -- 物件ごと消えたとき（一緒に消える材料）は書かない
    if exists (select 1 from public.app_user01_properties where id = old.property_id) then
      perform public.app_user01_log(old.property_id, '材料の削除', old.name, '');
    end if;
  else
    if new.name is distinct from old.name then
      perform public.app_user01_log(new.property_id, '材料「' || old.name || '」部材名', old.name, new.name);
    end if;
    if new.ordered is distinct from old.ordered then
      perform public.app_user01_log(new.property_id, '材料「' || new.name || '」発注日', old.ordered::text, new.ordered::text);
    end if;
    if new.eta is distinct from old.eta then
      perform public.app_user01_log(new.property_id, '材料「' || new.name || '」入荷予定日', old.eta::text, new.eta::text);
    end if;
    if new.arrived is distinct from old.arrived then
      perform public.app_user01_log(new.property_id, '材料「' || new.name || '」入荷',
        case when old.arrived then '入荷済み' else '未' end, case when new.arrived then '入荷済み' else '未' end);
    end if;
  end if;
  return null;
end;
$$;

-- 工程：状態を変えたときは状態だけを書く（自動で入る日付は書かない）。日付だけを直したときは日付を書く
create function public.app_user01_processes_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    perform public.app_user01_log(new.property_id, '工程「' || new.name || '」', old.status, new.status);
  else
    if new.start_date is distinct from old.start_date then
      perform public.app_user01_log(new.property_id, '工程「' || new.name || '」開始日', old.start_date::text, new.start_date::text);
    end if;
    if new.end_date is distinct from old.end_date then
      perform public.app_user01_log(new.property_id, '工程「' || new.name || '」完了日', old.end_date::text, new.end_date::text);
    end if;
  end if;
  return null;
end;
$$;

create function public.app_user01_defects_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.app_user01_log(new.property_id, '不良の登録', '', trim(new.process || ' ' || new.count || '個 ' || new.note));
  elsif exists (select 1 from public.app_user01_properties where id = old.property_id) then
    perform public.app_user01_log(old.property_id, '不良の削除', old.process || ' ' || old.count || '個', '');
  end if;
  return null;
end;
$$;

create trigger app_user01_properties_before_insert before insert on public.app_user01_properties
  for each row execute function public.app_user01_properties_before_insert();
create trigger app_user01_properties_before_update before update on public.app_user01_properties
  for each row execute function public.app_user01_properties_before_update();
create trigger app_user01_properties_after_insert after insert on public.app_user01_properties
  for each row execute function public.app_user01_properties_after_insert();
create trigger app_user01_properties_log after insert or update or delete on public.app_user01_properties
  for each row execute function public.app_user01_properties_log();
create trigger app_user01_materials_log after insert or update or delete on public.app_user01_materials
  for each row execute function public.app_user01_materials_log();
create trigger app_user01_processes_log after update on public.app_user01_processes
  for each row execute function public.app_user01_processes_log();
create trigger app_user01_defects_log after insert or delete on public.app_user01_defects
  for each row execute function public.app_user01_defects_log();

-- ============================================================
-- 5. RLS（すべての表で有効。読めるのは役割の表に登録されたアカウントだけ）
-- ============================================================
alter table public.app_user01_roles enable row level security;
alter table public.app_user01_properties enable row level security;
alter table public.app_user01_materials enable row level security;
alter table public.app_user01_processes enable row level security;
alter table public.app_user01_defects enable row level security;
alter table public.app_user01_history enable row level security;

-- 役割：自分の行だけ読める（書くのは人が SQL Editor で）
create policy app_user01_roles_select on public.app_user01_roles
  for select to authenticated using (user_id = (select auth.uid()));

-- 物件：読む＝役割あり全員／追加・変更・削除＝営業・業務
create policy app_user01_properties_select on public.app_user01_properties
  for select to authenticated using ((select public.app_user01_my_role()) is not null);
create policy app_user01_properties_insert on public.app_user01_properties
  for insert to authenticated with check ((select public.app_user01_my_role()) in ('営業', '業務'));
create policy app_user01_properties_update on public.app_user01_properties
  for update to authenticated
  using ((select public.app_user01_my_role()) in ('営業', '業務'))
  with check ((select public.app_user01_my_role()) in ('営業', '業務'));
create policy app_user01_properties_delete on public.app_user01_properties
  for delete to authenticated using ((select public.app_user01_my_role()) in ('営業', '業務'));

-- 材料：読む＝役割あり全員／追加・変更・削除＝業務
create policy app_user01_materials_select on public.app_user01_materials
  for select to authenticated using ((select public.app_user01_my_role()) is not null);
create policy app_user01_materials_insert on public.app_user01_materials
  for insert to authenticated with check ((select public.app_user01_my_role()) = '業務');
create policy app_user01_materials_update on public.app_user01_materials
  for update to authenticated
  using ((select public.app_user01_my_role()) = '業務')
  with check ((select public.app_user01_my_role()) = '業務');
create policy app_user01_materials_delete on public.app_user01_materials
  for delete to authenticated using ((select public.app_user01_my_role()) = '業務');

-- 工程：読む＝役割あり全員／変更＝現場（追加・削除はトリガーと物件の削除だけ）
create policy app_user01_processes_select on public.app_user01_processes
  for select to authenticated using ((select public.app_user01_my_role()) is not null);
create policy app_user01_processes_update on public.app_user01_processes
  for update to authenticated
  using ((select public.app_user01_my_role()) = '現場')
  with check ((select public.app_user01_my_role()) = '現場');

-- 不良：読む＝役割あり全員／登録・削除＝現場
create policy app_user01_defects_select on public.app_user01_defects
  for select to authenticated using ((select public.app_user01_my_role()) is not null);
create policy app_user01_defects_insert on public.app_user01_defects
  for insert to authenticated with check ((select public.app_user01_my_role()) = '現場');
create policy app_user01_defects_delete on public.app_user01_defects
  for delete to authenticated using ((select public.app_user01_my_role()) = '現場');

-- 変更履歴：読む＝役割あり全員（書くのはトリガーだけ）
create policy app_user01_history_select on public.app_user01_history
  for select to authenticated using ((select public.app_user01_my_role()) is not null);

-- ============================================================
-- 6. 権限（anon には何も付けない。authenticated には必要な操作と列だけ）
-- ============================================================
revoke all on table public.app_user01_roles, public.app_user01_properties, public.app_user01_materials,
  public.app_user01_processes, public.app_user01_defects, public.app_user01_history from anon, authenticated;
revoke all on sequence public.app_user01_property_no from anon, authenticated;

grant select on table public.app_user01_roles to authenticated;
grant select, delete on table public.app_user01_properties to authenticated;
grant insert (name, cust, qty, weight, due, ship, team, kubun) on table public.app_user01_properties to authenticated;
grant update (name, cust, qty, weight, due, ship, team, kubun) on table public.app_user01_properties to authenticated;
grant usage on sequence public.app_user01_property_no to authenticated;
grant select, delete on table public.app_user01_materials to authenticated;
grant insert (property_id, name, ordered, eta, arrived) on table public.app_user01_materials to authenticated;
grant update (name, ordered, eta, arrived) on table public.app_user01_materials to authenticated;
grant select on table public.app_user01_processes to authenticated;
grant update (status, start_date, end_date) on table public.app_user01_processes to authenticated;
grant select, delete on table public.app_user01_defects to authenticated;
grant insert (property_id, process, count, note) on table public.app_user01_defects to authenticated;
grant select on table public.app_user01_history to authenticated;

-- 関数：アプリから呼べるのは役割を調べる関数だけ（ほかはトリガー専用）
revoke all on function public.app_user01_my_role() from public, anon;
grant execute on function public.app_user01_my_role() to authenticated;
revoke all on function public.app_user01_log(text, text, text, text) from public, anon, authenticated;
revoke all on function public.app_user01_properties_before_insert() from public, anon, authenticated;
revoke all on function public.app_user01_properties_before_update() from public, anon, authenticated;
revoke all on function public.app_user01_properties_after_insert() from public, anon, authenticated;
revoke all on function public.app_user01_properties_log() from public, anon, authenticated;
revoke all on function public.app_user01_materials_log() from public, anon, authenticated;
revoke all on function public.app_user01_processes_log() from public, anon, authenticated;
revoke all on function public.app_user01_defects_log() from public, anon, authenticated;

-- 確認：作った表と RLS の状態（6行・すべて rls = true）
select c.relname as table_name, c.relrowsecurity as rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname like 'app\_user01\_%' and c.relkind = 'r'
order by 1;
