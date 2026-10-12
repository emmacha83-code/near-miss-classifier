import Workbench from "./workbench";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-6 sm:py-8">
      <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">
        아차사고 사례 자동 분류기
      </h1>
      <Workbench />
    </main>
  );
}
