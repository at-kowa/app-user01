import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "物件状況ボード（架空データの試作）",
  description: "物件ごとの受注・材料・工程・不良を同じ1枚で見るための試作。データはすべて架空",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
