import type { CaseRow } from "./types";

const isUnknown = (v: string) => v.trim().startsWith("확인 불가");

// 보고서의 "유사사고"로 쓸 수 있는 건: 아차사고이면서 "확인 불가" 항목이 없는 건
export function isEligibleSimilar(c: CaseRow): boolean {
  return (
    c.judgement === "아차사고" &&
    !isUnknown(c.nearMiss) &&
    !isUnknown(c.cause) &&
    !isUnknown(c.measure) &&
    (c.risk === "상" || c.risk === "중" || c.risk === "하")
  );
}

// 눈에 보이지 않는 제어문자가 섞이면 워드 파일이 열리지 않을 수 있어서 지웁니다. (줄바꿈·탭은 남김)
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function str(v: unknown, max = 2000): string {
  return typeof v === "string" ? v.replace(CONTROL_CHARS, "").slice(0, max) : "";
}

// 링크는 http:// 또는 https:// 로 시작하는 것만 인정합니다. (javascript: 같은 위험한 주소는 비움)
export function safeLink(v: unknown): string {
  const link = str(v, 1000).trim();
  return /^https?:\/\//i.test(link) ? link : "";
}

export function parseCases(input: unknown): CaseRow[] {
  if (!Array.isArray(input)) return [];
  const out: CaseRow[] = [];
  for (const raw of input.slice(0, 20)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const risk = r.risk;
    out.push({
      no: typeof r.no === "number" ? r.no : out.length + 1,
      title: str(r.title, 300),
      summary: str(r.summary, 1000),
      link: safeLink(r.link),
      judgement: r.judgement === "아차사고" ? "아차사고" : "해당 없음",
      coreSentence: str(r.coreSentence),
      nearMiss: str(r.nearMiss),
      cause: str(r.cause),
      measure: str(r.measure),
      risk:
        risk === "상" || risk === "중" || risk === "하" || risk === "확인 불가"
          ? risk
          : "해당 없음",
      evidence: str(r.evidence),
      excludedReason: str(r.excludedReason, 500) || undefined,
      failed: r.failed === true ? true : undefined,
    });
  }
  return out;
}
