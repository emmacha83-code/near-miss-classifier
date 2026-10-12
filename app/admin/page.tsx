import type { Metadata } from "next";
import AdminClient from "./admin-client";

export const metadata: Metadata = { title: "관리 화면 | 아차사고 사례 자동 분류기" };

export default function AdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-6 sm:py-8">
      <AdminClient />
    </main>
  );
}
