// 物件状況ボードで扱うデータの形（すべて架空データ）

export const PROCS = ["切断", "溶接", "めっき手配", "出荷"] as const;
export const ROLES = ["営業", "業務", "現場", "工場長"] as const;
export const STATES = ["遅れ", "材料待ち", "進行中", "引合", "出荷済み"] as const;
export const TEAMS = ["A班", "B班", "C班"] as const;
export const PROC_STATUSES = ["未着手", "作業中", "完了"] as const;
export const KUBUNS = ["引合", "受注"] as const;

export type Role = (typeof ROLES)[number];
export type Status = (typeof STATES)[number];
export type ProcStatus = (typeof PROC_STATUSES)[number];
export type Kubun = (typeof KUBUNS)[number];

export type Material = {
  id: string;
  name: string;
  ordered: string; // YYYY-MM-DD
  eta: string; // YYYY-MM-DD または ""
  arrived: boolean;
};

export type Proc = {
  name: string;
  status: ProcStatus;
  start: string;
  end: string;
};

export type Defect = {
  id: string;
  process: string;
  count: number;
  note: string;
  date: string;
};

export type Prop = {
  id: string; // 物件番号 例: P-101
  name: string; // 品名
  cust: string; // 客先（架空）
  qty: number | "";
  weight: number | "";
  due: string; // 希望納期
  ship: string; // 出荷予定日
  team: string; // 担当班
  kubun: Kubun; // 受注区分
  mats: Material[];
  procs: Proc[]; // 4工程で固定（PROCSの順）
  defects: Defect[];
};

export type HistoryEntry = {
  at: string; // YYYY-MM-DD HH:MM
  role: Role;
  id: string; // 物件番号
  field: string;
  before: string;
  after: string;
};

// 受注欄で書き換えられる項目
export type PropField = "name" | "cust" | "qty" | "weight" | "due" | "ship" | "team" | "kubun";
export type MaterialField = "name" | "ordered" | "eta" | "arrived";
export type ProcDateField = "start" | "end";

export const LABELS: Record<PropField, string> = {
  name: "品名",
  cust: "客先",
  qty: "数量",
  weight: "重量(kg)",
  due: "希望納期",
  ship: "出荷予定日",
  team: "担当班",
  kubun: "受注区分",
};

export type NewPropInput = {
  name: string;
  cust: string;
  qty: number | "";
  weight: number | "";
  due: string;
  team: string;
};

export type NewDefectInput = {
  process: string;
  count: number;
  note: string;
};

// 画面の部品は、この形の操作だけを呼ぶ。
// 第1段階はブラウザの中に保存する実装、第2段階でデータベース（Supabase）の実装に差し替えた。
export type BoardApi = {
  ready: boolean;
  storageOK: boolean;
  storageNote: string; // 画面の足元に出す保存先の説明
  error: string | null; // 保存できなかったときの理由（画面に出す）
  clearError: () => void;
  resetKey: number; // 保存できなかったとき、入力欄を保存前の値に戻すために増やす
  props: Prop[];
  history: HistoryEntry[];
  role: Role;
  warnDays: number;
  setRole: ((role: Role) => void) | null; // ログイン導入後は null
  setWarnDays: ((n: number) => void) | null; // 7日で固定のときは null
  updateProp: (id: string, key: PropField, value: string | number) => Promise<void>;
  addMaterial: (id: string) => Promise<void>;
  updateMaterial: (id: string, matId: string, key: MaterialField, value: string | boolean) => Promise<void>;
  deleteMaterial: (id: string, matId: string) => Promise<void>;
  setProcStatus: (id: string, index: number, status: ProcStatus) => Promise<void>;
  setProcDate: (id: string, index: number, key: ProcDateField, value: string) => Promise<void>;
  addDefect: (id: string, input: NewDefectInput) => Promise<void>;
  deleteDefect: (id: string, defectId: string) => Promise<void>;
  addProp: (input: NewPropInput) => Promise<string | null>; // 新しい物件番号
  deleteProp: (id: string) => Promise<void>;
  reset: (() => Promise<void>) | null; // 共有データになったら null
};
