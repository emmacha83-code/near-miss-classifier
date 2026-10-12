"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_KEYWORDS } from "@/lib/limits";
import { MAX_FOCUS_CHARS, MAX_TEXT_CHARS } from "@/lib/report";
import ReportView from "./report-view";
import type { CaseRow, MarkStats, MarkValue, ReportData } from "@/lib/types";

// 서버(앱)에 닿지 못했을 때 브라우저의 영어 문구("Failed to fetch") 대신 보여줄 안내
const CONNECT_ERROR = "앱 서버에 연결하지 못했어요. 앱(npm run dev)이 켜져 있는지 확인해 주세요.";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error(CONNECT_ERROR);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "요청에 실패했어요.");
  return data as T;
}

const post = (url: string, body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});


const RISK_STYLE: Record<string, string> = {
  상: "bg-red-100 text-red-700",
  중: "bg-amber-100 text-amber-800",
  하: "bg-green-100 text-green-700",
};

// 오래 걸리는 작업(분류, 보고서) 동안 "멈춘 게 아니라 일하는 중"임을 보여주는 안내입니다.
function LoadingNotice({ title, hint }: { title: string; hint: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-4 flex items-start gap-3 rounded-2xl bg-brand/10 px-4 py-3 text-sm leading-6 text-navy"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent"
      />
      <span>
        <b>{title}</b>
        <br />
        <span className="text-ink">{hint}</span>
      </span>
    </div>
  );
}

export default function Workbench() {
  const [keyword, setKeyword] = useState("");
  // 화면에 보이는 검색어 칩(처음 입력한 키워드 + 연관검색어)과, 그 칩을 만들 때의 키워드입니다.
  // 입력창을 고쳐도 칩과 고른 검색어가 서로 어긋나지 않게, 칩은 입력창과 따로 기억합니다.
  const [chips, setChips] = useState<string[]>([]);
  const [chipsFor, setChipsFor] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  const [cases, setCases] = useState<CaseRow[]>([]);
  const [source, setSource] = useState<"naver" | "google">("google");
  const [failedCount, setFailedCount] = useState(0);
  const [skipped, setSkipped] = useState<string[]>([]); // 검색에 실패해 건너뛴 검색어
  const [analyzing, setAnalyzing] = useState(false);
  const [searched, setSearched] = useState(false);

  const [marks, setMarks] = useState<Record<string, MarkValue>>({});
  const [stats, setStats] = useState<MarkStats | null>(null);

  const [mainNo, setMainNo] = useState<number | null>(null);
  const mainNoRef = useRef<number | null>(null); // 지금 고른 사고 번호 (늦게 도착한 보고서를 걸러내는 데 씀)
  const [report, setReport] = useState<ReportData | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportingText, setReportingText] = useState(false); // 글을 붙여넣어 보고서를 만드는 중인지
  const [exporting, setExporting] = useState(false);

  // 글 붙여넣기로 보고서 만들기
  const [pasted, setPasted] = useState("");
  const [focus, setFocus] = useState("");
  const [loadingSample, setLoadingSample] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    api<{ marks: { link: string; mark: MarkValue }[]; stats: MarkStats }>("/api/marks")
      .then((d) => {
        setMarks(Object.fromEntries(d.marks.map((m) => [m.link, m.mark])));
        setStats(d.stats);
      })
      .catch((e) => {
        // 이전 표시와 적합 비율이 안 보이는 이유를 알려 줍니다. (조용히 넘어가면 기록이 사라진 줄 알 수 있어요)
        setError(
          `이전 표시 기록을 불러오지 못했어요. ${e instanceof Error ? e.message : ""}`.trim(),
        );
      });
  }, []);

  async function findRelated() {
    const k = keyword.trim();
    if (!k) return;
    setError("");
    setLoadingRelated(true);
    try {
      const d = await api<{ related: string[] }>("/api/related", post("/api/related", { keyword: k }));
      setChips([...new Set([k, ...d.related])]);
      setChipsFor(k);
      setPicked([k]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "연관검색어를 가져오지 못했어요.");
    } finally {
      setLoadingRelated(false);
    }
  }

  function toggle(word: string) {
    if (!picked.includes(word) && picked.length >= MAX_KEYWORDS) {
      setError(`검색어는 최대 ${MAX_KEYWORDS}개까지 고를 수 있어요. 하나를 먼저 빼 주세요.`);
      return;
    }
    setError("");
    setPicked((p) => (p.includes(word) ? p.filter((w) => w !== word) : [...p, word]));
  }

  async function analyze() {
    setError("");
    setAnalyzing(true);
    setReport(null);
    setMainNo(null);
    try {
      const d = await api<{
        cases: CaseRow[];
        source: "naver" | "google";
        failedCount?: number;
        skippedKeywords?: string[];
      }>("/api/analyze", post("/api/analyze", { keywords: picked }));
      setCases(d.cases);
      setSource(d.source);
      setFailedCount(d.failedCount ?? 0);
      setSkipped(d.skippedKeywords ?? []);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "검색·분류에 실패했어요.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function mark(c: CaseRow, value: MarkValue) {
    setError("");
    try {
      const d = await api<{ stats: MarkStats }>(
        "/api/marks",
        post("/api/marks", { link: c.link, title: c.title, summary: c.summary, mark: value }),
      );
      setMarks((m) => ({ ...m, [c.link]: value }));
      setStats(d.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "표시를 저장하지 못했어요.");
    }
  }

  async function makeReport() {
    if (mainNo === null) return;
    const requested = mainNo;
    setError("");
    setReporting(true);
    try {
      const d = await api<{ report: ReportData }>("/api/report", post("/api/report", { cases, mainNo: requested }));
      // 보고서를 쓰는 사이에 고른 사고가 바뀌었다면(원래는 선택을 막아 두지만 만일을 대비) 어긋난 보고서는 버립니다.
      if (mainNoRef.current === requested) setReport(d.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "보고서 초안을 만들지 못했어요.");
    } finally {
      setReporting(false);
    }
  }

  // 붙여넣은 글로 센터 양식 보고서 초안 만들기 (뉴스 검색 없이)
  async function makeTextReport() {
    if (!pasted.trim()) return;
    setError("");
    setReporting(true);
    setReportingText(true);
    setMainNo(null);
    try {
      const d = await api<{ report: ReportData }>(
        "/api/report",
        post("/api/report", { text: pasted, focus }),
      );
      setReport(d.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "보고서 초안을 만들지 못했어요.");
    } finally {
      setReporting(false);
      setReportingText(false);
    }
  }

  // 시험용 가상 사례를 글 칸에 넣기
  async function loadSample() {
    setError("");
    setLoadingSample(true);
    try {
      const d = await api<{ text: string }>("/api/sample");
      setPasted(d.text);
      setFocus("위험 상황이 시민과 인접 시설에 늦게 알려졌다는 점");
    } catch (e) {
      setError(e instanceof Error ? e.message : "가상 예시를 불러오지 못했어요.");
    } finally {
      setLoadingSample(false);
    }
  }

  async function exportDocx() {
    setError("");
    setExporting(true);
    try {
      let res: Response;
      try {
        // 글로 만든 보고서에는 뉴스 분류 표를 붙이지 않습니다.
        res = await fetch(
          "/api/export",
          post("/api/export", { cases: report?.source === "text" ? [] : cases, report }),
        );
      } catch {
        throw new Error(CONNECT_ERROR);
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error ?? "워드 파일을 만들지 못했어요.");
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "아차사고_보고서.docx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "워드 파일을 만들지 못했어요.");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    mainNoRef.current = mainNo;
  }, [mainNo]);

  const busy = analyzing || reporting;

  return (
    <>
      <section className="rounded-3xl bg-navy px-6 py-7 text-white shadow-lg">
        <h2 className="text-xl font-bold sm:text-2xl">아차사고 사례 찾기</h2>
        <p className="mt-2 text-sm leading-7 text-white/85 sm:text-base">
          키워드를 넣고 연관검색어를 고르면, 뉴스를 찾아 아차사고 기준으로 분류해 드려요.
        </p>
      </section>

      {error && (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* 1. 키워드 */}
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-navy">1. 키워드 입력</h2>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            findRelated();
          }}
        >
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            maxLength={50}
            placeholder="예: 교량 붕괴"
            className="h-12 min-w-0 flex-1 rounded-full border-2 border-brand-soft bg-white px-5 text-base outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={!keyword.trim() || loadingRelated}
            className="h-12 shrink-0 cursor-pointer rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-navy disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingRelated ? "찾는 중…" : "연관검색어 보기"}
          </button>
        </form>

        {chips.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-ink">
              검색에 쓸 검색어를 고르세요. (고른 것만 검색해요 · 최대 {MAX_KEYWORDS}개)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {chips.map((w) => {
                const on = picked.includes(w);
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => toggle(w)}
                    aria-pressed={on}
                    className={`cursor-pointer rounded-full border-2 px-4 py-1.5 text-sm font-medium transition-colors ${
                      on
                        ? "border-brand bg-brand text-white"
                        : "border-brand-soft bg-white text-navy hover:bg-brand/10"
                    }`}
                  >
                    {on ? "✓ " : ""}
                    {w}
                  </button>
                );
              })}
            </div>
            {keyword.trim() !== chipsFor && (
              <p className="mt-2 text-sm text-amber-800">
                키워드를 바꾸셨어요. 위 검색어는 &ldquo;{chipsFor}&rdquo; 기준이에요. 새 키워드로 찾으려면 &ldquo;연관검색어 보기&rdquo;를 다시
                눌러 주세요.
              </p>
            )}
            <button
              type="button"
              onClick={analyze}
              disabled={picked.length === 0 || busy}
              className="mt-4 h-12 cursor-pointer rounded-full bg-navy px-7 text-base font-semibold text-white transition-colors hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50"
            >
              {analyzing ? "뉴스를 찾고 분류하는 중…" : "뉴스 검색·분류하기"}
            </button>
            {analyzing && (
              <LoadingNotice
                title="뉴스를 찾아서 기사를 하나씩 판단하고 있어요."
                hint="기사 20건 기준으로 보통 20~40초 걸려요. 이 화면을 닫거나 새로 고치지 마세요."
              />
            )}
          </div>
        )}
      </section>

      {/* 1-2. 글 붙여넣기 */}
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-navy">또는 글을 붙여넣어 바로 보고서 만들기</h2>
        <p className="mt-1 text-sm leading-7 text-ink">
          기사 본문, 현장 보고, 대화 내용을 붙여넣으면 <b>센터 보고서 양식</b>(사고개요 → 사고발생 경위 → 아차 사고 지점 및
          대형 사고 발생 가능성)으로 초안을 만들어 드려요. 글에 없는 내용은 &ldquo;확인 불가&rdquo;로 써요.
          사람 이름이나 연락처는 지우고 붙여넣는 것을 권해요. (AI 서비스로 전달돼요)
        </p>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value.slice(0, MAX_TEXT_CHARS))}
          rows={8}
          placeholder="여기에 글을 붙여넣으세요"
          aria-label="보고서로 만들 글"
          className="mt-3 w-full rounded-2xl border-2 border-brand-soft bg-white px-4 py-3 text-base leading-7 outline-none focus:border-brand"
        />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-ink">
          <span>
            {pasted.length.toLocaleString("ko-KR")} / {MAX_TEXT_CHARS.toLocaleString("ko-KR")}자
          </span>
          <button
            type="button"
            onClick={loadSample}
            disabled={loadingSample || busy}
            className="cursor-pointer rounded-full px-3 py-1 font-semibold text-brand hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingSample ? "불러오는 중…" : "가상 예시 불러오기 (시험용)"}
          </button>
        </div>
        <label className="mt-3 block text-sm font-semibold text-navy">
          문제 삼으려는 지점 (선택)
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value.slice(0, MAX_FOCUS_CHARS))}
            placeholder="예: 위험 상황이 시민과 인접 시설에 늦게 알려졌다는 점"
            className="mt-1 h-11 w-full rounded-full border-2 border-brand-soft bg-white px-4 text-base font-normal outline-none focus:border-brand"
          />
        </label>
        <button
          type="button"
          onClick={makeTextReport}
          disabled={!pasted.trim() || busy}
          className="mt-4 h-12 cursor-pointer rounded-full bg-navy px-7 text-base font-semibold text-white transition-colors hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50"
        >
          {reportingText ? "보고서 초안을 쓰는 중…" : "이 글로 보고서 초안 만들기"}
        </button>
        {reportingText && (
          <LoadingNotice
            title="붙여넣은 글로 센터 양식 보고서 초안을 쓰고 있어요."
            hint="글 길이에 따라 보통 20~40초 걸려요. 다 쓰면 아래에 보고서가 나타나요."
          />
        )}
      </section>

      {/* 2. 분류 결과 */}
      {searched && (
        <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-navy">2. 분류 결과 ({cases.length}건)</h2>
            {stats && (
              <p className="rounded-full bg-brand/10 px-4 py-1.5 text-sm font-semibold text-navy">
                적합 비율{" "}
                {stats.fitRatio === null ? "기록 없음" : `${stats.fitRatio}%`} (적합 {stats.fit} / 확인{" "}
                {stats.total}건 · 목표 70% 이상)
              </p>
            )}
          </div>

          {skipped.length > 0 && (
            <p role="alert" className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              검색어 {skipped.map((k) => `“${k}”`).join(", ")}은(는) 검색에 실패해서 <b>건너뛰었어요.</b> 나머지 검색어의
              결과만 보여드려요. 다시 검색하면 이 검색어도 찾을 수 있어요.
            </p>
          )}

          {failedCount > 0 && (
            <p role="alert" className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              기사 {failedCount}건은 AI 오류로 <b>분류하지 못했어요</b>(표에 ⚠ 표시). 나머지는 정상으로 분류됐어요.
              같은 검색을 다시 하면 그 기사도 분류될 수 있어요.
            </p>
          )}

          {source === "google" && (
            <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              <b>구글 뉴스 검색</b> 결과예요. 기사 요약이 거의 없어서 <b>제목 위주로</b> 분류했어요. 링크를 누르면 구글을
              거쳐 원문으로 이동해요. 분류가 맞는지 꼭 원문으로 확인해 주세요.
            </p>
          )}

          {cases.length === 0 ? (
            <p className="mt-4 text-sm text-ink">검색된 기사가 없어요. 다른 검색어를 골라 보세요.</p>
          ) : (
            <>
              <p className="mt-3 text-sm text-ink">
                결과마다 <b>적합 / 추가검색필요</b>를 눌러 표시하세요. 보고서로 쓸 사고를 <b>하나</b> 고르세요.
              </p>
              <div className="mt-3 overflow-x-auto rounded-2xl border border-brand-soft/60">
                <table className="w-full min-w-[1150px] border-collapse text-left text-sm">
                  <thead className="bg-brand/10 text-navy">
                    <tr>
                      {["번호", "기사 링크", "핵심 문장", "아차한 점", "원인(규정 공백)", "대책", "위험도", "근거 문장", "확인", "보고서"].map(
                        (h) => (
                          <th key={h} className="whitespace-nowrap px-3 py-3 font-semibold">
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((c) => {
                      const isNearMiss = c.judgement === "아차사고";
                      return (
                        <tr
                          key={c.no}
                          className={`border-t border-brand-soft/60 align-top ${isNearMiss ? "" : "bg-background/70 text-ink"}`}
                        >
                          <td className="px-3 py-3">{c.no}</td>
                          <td className="px-3 py-3">
                            <a
                              href={c.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-brand underline underline-offset-2"
                            >
                              {c.title}
                            </a>
                          </td>
                          <td className="px-3 py-3 leading-6">
                            {c.coreSentence}
                            {c.failed ? (
                              <span className="mt-1 block text-xs font-semibold text-amber-800">
                                ⚠ 분류 실패 — {c.excludedReason}
                              </span>
                            ) : (
                              !isNearMiss && (
                                <span className="mt-1 block text-xs text-ink">
                                  해당 없음 — {c.excludedReason}
                                </span>
                              )
                            )}
                          </td>
                          <td className="px-3 py-3 leading-6">{c.nearMiss}</td>
                          <td className="px-3 py-3 leading-6">{c.cause}</td>
                          <td className="px-3 py-3 leading-6">{c.measure}</td>
                          <td className="px-3 py-3">
                            <span
                              className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${RISK_STYLE[c.risk] ?? "bg-gray-100 text-ink"}`}
                            >
                              {c.risk}
                            </span>
                          </td>
                          <td className="px-3 py-3 leading-6">{c.evidence}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-1.5">
                              {(["적합", "추가검색필요"] as const).map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => mark(c, v)}
                                  aria-pressed={marks[c.link] === v}
                                  className={`cursor-pointer whitespace-nowrap rounded-full border-2 px-3 py-1 text-xs font-semibold transition-colors ${
                                    marks[c.link] === v
                                      ? "border-brand bg-brand text-white"
                                      : "border-brand-soft bg-white text-navy hover:bg-brand/10"
                                  }`}
                                >
                                  {v}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {isNearMiss ? (
                              <label
                                className={`flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-navy ${
                                  reporting ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="main"
                                  disabled={reporting}
                                  checked={mainNo === c.no}
                                  onChange={() => {
                                    setMainNo(c.no);
                                    setReport(null);
                                  }}
                                />
                                이 사고
                              </label>
                            ) : (
                              <span className="text-xs text-ink">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={makeReport}
                  disabled={mainNo === null || busy}
                  className="h-12 cursor-pointer rounded-full bg-navy px-7 text-base font-semibold text-white transition-colors hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reporting ? "보고서 초안을 쓰는 중…" : "선택한 사고로 보고서 초안 만들기"}
                </button>
                <button
                  type="button"
                  onClick={exportDocx}
                  disabled={exporting || reporting}
                  className="h-12 cursor-pointer rounded-full border-2 border-brand bg-white px-7 text-base font-semibold text-brand transition-colors hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exporting
                    ? "만드는 중…"
                    : report?.source === "news"
                      ? "보고서·분류 표 워드로 내보내기"
                      : "분류 표 워드로 내보내기"}
                </button>
              </div>
              {reporting && !reportingText && (
                <LoadingNotice
                  title="선택한 사고로 보고서 초안을 쓰고 있어요."
                  hint="잠시만 기다려 주세요. 다 쓰면 아래에 보고서가 나타나요."
                />
              )}
            </>
          )}
        </section>
      )}

      {/* 3. 보고서 초안 (센터 양식) */}
      {report && (
        <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-navy">3. 보고서 초안 (센터 양식)</h2>
            <button
              type="button"
              onClick={exportDocx}
              disabled={exporting || reporting}
              className="h-11 cursor-pointer rounded-full border-2 border-brand bg-white px-6 text-sm font-semibold text-brand transition-colors hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? "만드는 중…" : "워드로 내보내기"}
            </button>
          </div>
          <p className="mt-1 text-sm text-ink">AI가 쓴 초안이에요. 확인하고 다듬어 쓰세요.</p>
          <ReportView report={report} />
        </section>
      )}
    </>
  );
}
