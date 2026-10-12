"use client";

import { useEffect, useState } from "react";
import type { Settings } from "@/lib/types";

const CONNECT_ERROR = "앱 서버에 연결하지 못했어요. 앱(npm run dev)이 켜져 있는지 확인해 주세요.";

export default function AdminClient() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        // 오류 응답이거나 모양이 이상하면 화면이 깨지지 않게 안내만 보여줍니다.
        if (!r.ok) throw new Error(d?.error ?? "설정을 불러오지 못했어요.");
        if (!Array.isArray(d?.criteria) || !Array.isArray(d?.history)) {
          throw new Error("설정을 읽었지만 모양이 이상해요. data/settings.json을 확인해 주세요.");
        }
        setSettings(d as Settings);
      })
      .catch((e) =>
        setError(
          e instanceof TypeError ? CONNECT_ERROR : e instanceof Error ? e.message : "설정을 불러오지 못했어요.",
        ),
      );
  }, []);

  if (!settings) {
    return <p className="text-sm text-ink">{error || "불러오는 중…"}</p>;
  }

  const update = (patch: Partial<Settings>) => {
    setSettings({ ...settings, ...patch });
    setMessage("");
  };
  const setCriterion = (i: number, v: string) =>
    update({ criteria: settings.criteria.map((c, idx) => (idx === i ? v : c)) });

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "저장하지 못했어요.");
      if (!Array.isArray(data?.criteria) || !Array.isArray(data?.history)) {
        throw new Error("저장은 됐지만 응답이 이상해요. 화면을 새로 고쳐서 확인해 주세요.");
      }
      setSettings(data as Settings);
      setMessage("저장했어요. 이 내용은 지금부터 하는 검색·분류에 적용돼요. 이미 만든 결과는 바뀌지 않아요.");
    } catch (e) {
      // 서버에 닿지 못하면 브라우저의 영어 문구 대신 한국어 안내를 보여줍니다.
      setError(
        e instanceof TypeError ? CONNECT_ERROR : e instanceof Error ? e.message : "저장하지 못했어요.",
      );
    } finally {
      setSaving(false);
    }
  }

  const field =
    "mt-1 w-full rounded-2xl border-2 border-brand-soft bg-white px-4 py-2.5 text-base outline-none focus:border-brand";

  return (
    <>
      <section className="rounded-3xl bg-navy px-6 py-7 text-white shadow-lg">
        <h1 className="text-xl font-bold sm:text-2xl">관리 화면</h1>
        <p className="mt-2 text-sm leading-7 text-white/85 sm:text-base">
          분류 체계와 선정 기준을 고칠 수 있어요. 고친 내용은 그 뒤의 검색·분류부터 적용돼요.
        </p>
      </section>

      {error && (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-2xl bg-brand/10 px-4 py-3 text-sm text-navy">
          {message}
        </p>
      )}

      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-navy">선정 기준</h2>
        <p className="mt-1 text-sm text-ink">아래를 모두 만족할 때만 아차사고로 분류해요. (최대 10개)</p>
        <ol className="mt-3 flex flex-col gap-3">
          {settings.criteria.map((c, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-3 w-5 shrink-0 text-sm font-semibold text-navy">{i + 1}.</span>
              <textarea
                value={c}
                onChange={(e) => setCriterion(i, e.target.value)}
                rows={2}
                maxLength={300}
                aria-label={`선정 기준 ${i + 1}`}
                className={field + " mt-0 flex-1"}
              />
              <button
                type="button"
                onClick={() => update({ criteria: settings.criteria.filter((_, idx) => idx !== i) })}
                disabled={settings.criteria.length <= 1}
                className="mt-2 shrink-0 cursor-pointer rounded-full px-3 py-1 text-sm text-ink hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`선정 기준 ${i + 1} 지우기`}
              >
                지우기
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => update({ criteria: [...settings.criteria, ""] })}
          disabled={settings.criteria.length >= 10}
          className="mt-3 cursor-pointer rounded-full border-2 border-brand px-4 py-1.5 text-sm font-semibold text-brand hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          + 기준 추가
        </button>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-navy">분류 체계</h2>
        <label className="mt-3 block text-sm font-semibold text-navy">
          아차한 점 작성 방법
          <textarea
            value={settings.nearMissGuide}
            onChange={(e) => update({ nearMissGuide: e.target.value })}
            rows={2}
            maxLength={300}
            className={field}
          />
        </label>
        <label className="mt-3 block text-sm font-semibold text-navy">
          원인(규정 공백) 작성 방법
          <textarea
            value={settings.causeGuide}
            onChange={(e) => update({ causeGuide: e.target.value })}
            rows={2}
            maxLength={300}
            className={field}
          />
        </label>
        <label className="mt-3 block text-sm font-semibold text-navy">
          위험도 기준 (위험도는 항상 상 / 중 / 하 3단계예요)
          <textarea
            value={settings.riskBasis}
            onChange={(e) => update({ riskBasis: e.target.value })}
            rows={2}
            maxLength={300}
            className={field}
          />
        </label>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-5 h-12 cursor-pointer rounded-full bg-navy px-8 text-base font-semibold text-white transition-colors hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "저장하는 중…" : "저장하기"}
        </button>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-navy">변경 이력</h2>
        {settings.history.length === 0 ? (
          <p className="mt-2 text-sm text-ink">아직 바꾼 내용이 없어요.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {settings.history.map((h) => (
              <li key={h.at} className="rounded-xl border border-brand-soft/60 px-4 py-2.5 text-sm">
                <span className="text-ink">{new Date(h.at).toLocaleString("sv-SE").slice(0, 16)}</span> · 담당자 · {h.summary}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
