// 初期データ（架空の20物件）。日付は「今日から何日前・何日後」で持つ
import type { Prop } from "./types";
import { makeProcs, off } from "./logic";

type MatSeed = [name: string, ordered: number, eta: number, arrived: boolean];
type DefSeed = [process: string, count: number, note: string];
type PropSeed = [
  name: string,
  cust: string,
  qty: number,
  weight: number,
  due: number,
  ship: number | "",
  team: string,
  kubun: "引合" | "受注",
  mats: MatSeed[],
  done: number,
  doing: boolean,
  defects: DefSeed[],
];

const S: PropSeed[] = [
  ["架台フレーム", "A社（架空）", 4, 820, -6, -6, "A班", "受注", [["角パイプ", -30, -20, true], ["ベースプレート", -30, -18, true]], 4, false, []],
  ["処理カゴ", "B社（架空）", 12, 360, -2, -3, "B班", "受注", [["丸棒", -25, -15, true]], 4, false, []],
  ["配管サポート", "C社（架空）", 40, 210, -2, 3, "C班", "受注", [["山形鋼", -20, -10, true], ["Uボルト", -20, -8, true]], 2, true, [["溶接", 3, "溶接割れ。追加製作"]]],
  ["手すりユニット", "D社（架空）", 18, 540, -1, 6, "A班", "受注", [["丸パイプ", -18, -8, true], ["支柱金物", -18, 2, false]], 1, false, []],
  ["ケーブルラック", "E社（架空）", 30, 690, 12, "", "B班", "受注", [["溝形鋼", -6, 3, false], ["子桁", -6, 4, false]], 0, false, []],
  ["階段ステップ", "F社（架空）", 24, 480, 5, "", "C班", "受注", [["縞鋼板", -10, 2, false], ["ボルト一式", -10, -2, true]], 0, false, []],
  ["防護柵", "G社（架空）", 16, 950, 18, "", "A班", "受注", [["平鋼", -4, 6, false]], 0, false, []],
  ["機械カバー", "H社（架空）", 6, 150, 3, 4, "B班", "受注", [["鋼板", -15, -6, true]], 2, true, [["切断", 2, "寸法違い"]]],
  ["ブラケット", "A社（架空）", 120, 300, 20, "", "C班", "受注", [["平鋼", -12, -4, true]], 1, true, []],
  ["点検歩廊", "B社（架空）", 8, 1200, 14, "", "A班", "受注", [["グレーチング", -14, -5, true], ["形鋼", -14, -6, true]], 1, true, [["溶接", 1, "歪みが大きい"]]],
  ["梯子", "C社（架空）", 5, 260, 6, 6, "B班", "受注", [["丸鋼", -16, -7, true]], 2, false, []],
  ["屋外架台", "I社（架空）", 3, 1500, 40, "", "A班", "引合", [], 0, false, []],
  ["看板支柱", "J社（架空）", 10, 400, 35, "", "C班", "引合", [], 0, false, []],
  ["ダクト支持金物", "D社（架空）", 60, 330, 15, "", "B班", "受注", [["山形鋼", -9, -2, true], ["アンカー", -9, -1, true]], 0, false, []],
  ["フェンス", "E社（架空）", 22, 880, 22, "", "C班", "受注", [["メッシュパネル", -3, 9, false]], 0, false, []],
  ["作業台", "F社（架空）", 4, 310, 2, 2, "A班", "受注", [["角パイプ", -14, -7, true]], 3, true, []],
  ["車止め", "G社（架空）", 14, 520, 25, "", "B班", "受注", [["鋼管", -8, -1, true]], 1, false, []],
  ["足場板受け", "H社（架空）", 50, 240, -10, -10, "C班", "受注", [["平鋼", -30, -22, true]], 4, false, []],
  ["排水溝蓋", "I社（架空）", 36, 610, 9, "", "A班", "受注", [["縞鋼板", -7, 1, false]], 0, false, [["切断", 4, "材料に傷"]]],
  ["架線金具", "J社（架空）", 80, 190, 11, "", "B班", "受注", [["鋼板", -11, -3, true]], 2, true, []],
];

export function seedProps(): Prop[] {
  return S.map((s, i) => {
    const id = `P-${101 + i}`;
    return {
      id,
      name: s[0],
      cust: s[1],
      qty: s[2],
      weight: s[3],
      due: off(s[4]),
      ship: s[5] === "" ? "" : off(s[5]),
      team: s[6],
      kubun: s[7],
      mats: s[8].map(([name, o, e, a], j) => ({ id: `${id}-m${j + 1}`, name, ordered: off(o), eta: off(e), arrived: a })),
      procs: makeProcs(s[9], s[10]),
      defects: s[11].map(([process, count, note], j) => ({ id: `${id}-d${j + 1}`, process, count, note, date: off(-1) })),
    };
  });
}
