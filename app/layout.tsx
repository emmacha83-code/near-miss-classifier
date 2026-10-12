import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "아차사고 사례 자동 분류기",
  description: "키워드로 뉴스를 찾아 아차사고 기준으로 분류하고 보고서 초안을 만드는 앱",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="bg-navy text-white">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-3">
            <Link href="/" className="text-base font-bold sm:text-lg">
              아차사고 사례 자동 분류기
            </Link>
            <nav className="flex gap-2 text-sm">
              <Link href="/" className="rounded-full px-3 py-1.5 hover:bg-white/15">
                분류·보고서
              </Link>
              <Link href="/admin" className="rounded-full px-3 py-1.5 hover:bg-white/15">
                관리 화면
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
