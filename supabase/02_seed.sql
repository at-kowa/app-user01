-- 物件状況ボード：架空の初期データ（P-101〜P-120）
-- 実行は人が SQL Editor で行う。01_schema.sql の後に流す。
-- 【注意】app_user01_ の物件・材料・工程・不良・変更履歴を一度すべて消してから入れ直す（他の表には触れない）。
-- 日付は「流した日（日本時間）」を基準にした相対日。件数の確認は流した日と同じ日に行う。

begin;

-- 1. いったん空にする（材料・工程・不良は物件と一緒に消える）
delete from public.app_user01_properties;

-- 2. 物件（id, 品名, 客先, 数量, 重量, 希望納期の日数, 出荷予定日の日数, 担当班, 受注区分, 完了した工程の数, 次の工程が作業中か）
create temporary table app_user01_seed (
  id text, name text, cust text, qty int, weight numeric, due int, ship int, team text, kubun text, done int, doing boolean
) on commit drop;

insert into app_user01_seed values
  ('P-101', '架台フレーム',   'A社（架空）',   4,  820,  -6,   -6, 'A班', '受注', 4, false),
  ('P-102', '処理カゴ',       'B社（架空）',  12,  360,  -2,   -3, 'B班', '受注', 4, false),
  ('P-103', '配管サポート',   'C社（架空）',  40,  210,  -2,    3, 'C班', '受注', 2, true),
  ('P-104', '手すりユニット', 'D社（架空）',  18,  540,  -1,    6, 'A班', '受注', 1, false),
  ('P-105', 'ケーブルラック', 'E社（架空）',  30,  690,  12, null, 'B班', '受注', 0, false),
  ('P-106', '階段ステップ',   'F社（架空）',  24,  480,   5, null, 'C班', '受注', 0, false),
  ('P-107', '防護柵',         'G社（架空）',  16,  950,  18, null, 'A班', '受注', 0, false),
  ('P-108', '機械カバー',     'H社（架空）',   6,  150,   3,    4, 'B班', '受注', 2, true),
  ('P-109', 'ブラケット',     'A社（架空）', 120,  300,  20, null, 'C班', '受注', 1, true),
  ('P-110', '点検歩廊',       'B社（架空）',   8, 1200,  14, null, 'A班', '受注', 1, true),
  ('P-111', '梯子',           'C社（架空）',   5,  260,   6,    6, 'B班', '受注', 2, false),
  ('P-112', '屋外架台',       'I社（架空）',   3, 1500,  40, null, 'A班', '引合', 0, false),
  ('P-113', '看板支柱',       'J社（架空）',  10,  400,  35, null, 'C班', '引合', 0, false),
  ('P-114', 'ダクト支持金物', 'D社（架空）',  60,  330,  15, null, 'B班', '受注', 0, false),
  ('P-115', 'フェンス',       'E社（架空）',  22,  880,  22, null, 'C班', '受注', 0, false),
  ('P-116', '作業台',         'F社（架空）',   4,  310,   2,    2, 'A班', '受注', 3, true),
  ('P-117', '車止め',         'G社（架空）',  14,  520,  25, null, 'B班', '受注', 1, false),
  ('P-118', '足場板受け',     'H社（架空）',  50,  240, -10,  -10, 'C班', '受注', 4, false),
  ('P-119', '排水溝蓋',       'I社（架空）',  36,  610,   9, null, 'A班', '受注', 0, false),
  ('P-120', '架線金具',       'J社（架空）',  80,  190,  11, null, 'B班', '受注', 2, true);

-- 物件を入れると、トリガーが工程を4行ずつ作る
insert into public.app_user01_properties (id, name, cust, qty, weight, due, ship, team, kubun)
select s.id, s.name, s.cust, s.qty, s.weight,
       t.d + s.due, case when s.ship is null then null else t.d + s.ship end, s.team, s.kubun
from app_user01_seed s
cross join (select (now() at time zone 'Asia/Tokyo')::date as d) t
order by s.id;

-- 3. 工程の進み具合（完了した工程は2日ずつ前にずらす。次の工程が作業中なら昨日から開始）
update public.app_user01_processes p
set status = '完了',
    start_date = t.d + (-(s.done - (p.seq - 1)) * 2 - 2),
    end_date = t.d + (-(s.done - (p.seq - 1)) * 2)
from app_user01_seed s
cross join (select (now() at time zone 'Asia/Tokyo')::date as d) t
where p.property_id = s.id and p.seq <= s.done;

update public.app_user01_processes p
set status = '作業中', start_date = t.d - 1
from app_user01_seed s
cross join (select (now() at time zone 'Asia/Tokyo')::date as d) t
where p.property_id = s.id and s.doing and p.seq = s.done + 1;

-- 4. 材料（物件, 部材名, 発注日の日数, 入荷予定日の日数, 入荷済み）
insert into public.app_user01_materials (property_id, name, ordered, eta, arrived)
select m.pid, m.name, t.d + m.o, t.d + m.e, m.a
from (values
  ('P-101', '角パイプ',       -30, -20, true),
  ('P-101', 'ベースプレート', -30, -18, true),
  ('P-102', '丸棒',           -25, -15, true),
  ('P-103', '山形鋼',         -20, -10, true),
  ('P-103', 'Uボルト',        -20,  -8, true),
  ('P-104', '丸パイプ',       -18,  -8, true),
  ('P-104', '支柱金物',       -18,   2, false),
  ('P-105', '溝形鋼',          -6,   3, false),
  ('P-105', '子桁',            -6,   4, false),
  ('P-106', '縞鋼板',         -10,   2, false),
  ('P-106', 'ボルト一式',     -10,  -2, true),
  ('P-107', '平鋼',            -4,   6, false),
  ('P-108', '鋼板',           -15,  -6, true),
  ('P-109', '平鋼',           -12,  -4, true),
  ('P-110', 'グレーチング',   -14,  -5, true),
  ('P-110', '形鋼',           -14,  -6, true),
  ('P-111', '丸鋼',           -16,  -7, true),
  ('P-114', '山形鋼',          -9,  -2, true),
  ('P-114', 'アンカー',        -9,  -1, true),
  ('P-115', 'メッシュパネル',  -3,   9, false),
  ('P-116', '角パイプ',       -14,  -7, true),
  ('P-117', '鋼管',            -8,  -1, true),
  ('P-118', '平鋼',           -30, -22, true),
  ('P-119', '縞鋼板',          -7,   1, false),
  ('P-120', '鋼板',           -11,  -3, true)
) as m (pid, name, o, e, a)
cross join (select (now() at time zone 'Asia/Tokyo')::date as d) t
order by m.pid;

-- 5. 不良（登録日は昨日）
insert into public.app_user01_defects (property_id, process, count, note, date)
select v.pid, v.process, v.cnt, v.note, t.d - 1
from (values
  ('P-103', '溶接', 3, '溶接割れ。追加製作'),
  ('P-108', '切断', 2, '寸法違い'),
  ('P-110', '溶接', 1, '歪みが大きい'),
  ('P-119', '切断', 4, '材料に傷')
) as v (pid, process, cnt, note)
cross join (select (now() at time zone 'Asia/Tokyo')::date as d) t;

-- 6. 入れる途中で書かれた履歴を消し、物件番号の続きを P-121 からにする
truncate table public.app_user01_history restart identity;
select setval('public.app_user01_property_no', 120, true);

commit;

-- 確認：物件20・材料25・工程80・不良4・履歴0
select
  (select count(*) from public.app_user01_properties) as properties,
  (select count(*) from public.app_user01_materials) as materials,
  (select count(*) from public.app_user01_processes) as processes,
  (select count(*) from public.app_user01_defects) as defects,
  (select count(*) from public.app_user01_history) as history;
