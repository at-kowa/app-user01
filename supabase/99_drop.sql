-- 物件状況ボード：片付け用（app_user01_ の表・関数・連番をすべて消す）
-- 【注意】元に戻せない。研修が終わって不要になったとき、または 01_schema.sql からやり直すときだけ人が実行する。
-- ログイン用アカウント（Authentication）は消えないので、不要なら管理画面で別に消す。

drop table if exists public.app_user01_history;
drop table if exists public.app_user01_defects;
drop table if exists public.app_user01_processes;
drop table if exists public.app_user01_materials;
drop table if exists public.app_user01_properties;
drop table if exists public.app_user01_roles;
drop sequence if exists public.app_user01_property_no;

drop function if exists public.app_user01_properties_before_insert();
drop function if exists public.app_user01_properties_before_update();
drop function if exists public.app_user01_properties_after_insert();
drop function if exists public.app_user01_properties_log();
drop function if exists public.app_user01_materials_log();
drop function if exists public.app_user01_processes_log();
drop function if exists public.app_user01_defects_log();
drop function if exists public.app_user01_log(text, text, text, text);
drop function if exists public.app_user01_my_role();

-- 確認：0行なら片付け済み
select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname like 'app\_user01\_%';
