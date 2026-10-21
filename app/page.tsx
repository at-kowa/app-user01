"use client";

import { useSyncExternalStore } from "react";
import { Board } from "@/components/board/board";
import { useLocalBoard } from "@/lib/board/use-local-board";

// 保存先がブラウザの中なので、画面はブラウザで組み立てる（サーバーでは空のまま）
const subscribe = () => () => {};
const useIsClient = () => useSyncExternalStore(subscribe, () => true, () => false);

function LocalBoard() {
  const api = useLocalBoard();
  return <Board api={api} />;
}

export default function Home() {
  return useIsClient() ? <LocalBoard /> : null;
}
