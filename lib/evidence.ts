// "근거 문장은 원문 그대로"를 지키기 위한 검사입니다. AI가 쓴 근거가 기사 제목·요약에 실제로 있는 글인지 확인합니다.

const MIN_EVIDENCE_CHARS = 10; // 너무 짧은 조각은 근거로 인정하지 않습니다.

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

// 구글 뉴스는 요약 대신 "언론사: OO"만 오고, 제목 끝에도 " - OO"(언론사)가 붙어 있습니다.
// 둘 다 기사 내용이 아니라서 근거 후보에서 뺍니다.
export function pressOf(summary: string): string | null {
  const m = summary.match(/^언론사:\s*(.+)$/);
  return m ? m[1].trim() : null;
}

// 근거로 쓸 수 있는 글(기사 내용)만 모은 것
export function evidenceText(title: string, summary: string): string {
  if (pressOf(summary) !== null) {
    const i = title.lastIndexOf(" - ");
    return i > 0 ? title.slice(0, i) : title;
  }
  return summary ? `${title}\n${summary}` : title;
}

// 글을 문장 단위로 나눕니다. (줄바꿈, 그리고 . ! ? … 뒤의 공백에서 자름. 제목은 보통 한 문장입니다.)
function sentences(text: string): string[] {
  return text
    .split("\n")
    .flatMap((line) => line.split(/(?<=[.!?。…])\s+/))
    .map(squash)
    .filter(Boolean);
}

// 근거가 기사 내용 안의 "문장(또는 이어진 문장들)을 처음부터 끝까지 그대로" 옮긴 것이어야 인정합니다.
// 단어 한두 개, 문장의 중간 조각, 언론사 이름만 있는 경우는 인정하지 않습니다.
export function isValidEvidence(evidence: string, title: string, summary: string): boolean {
  const e = squash(evidence);
  if (!e) return false;
  const text = evidenceText(title, summary);
  if (e.length < Math.min(MIN_EVIDENCE_CHARS, squash(text).length)) return false;
  const parts = sentences(text);
  for (let i = 0; i < parts.length; i++) {
    let joined = "";
    for (let j = i; j < parts.length; j++) {
      joined = joined ? `${joined} ${parts[j]}` : parts[j];
      if (joined === e) return true;
      if (joined.length > e.length) break;
    }
  }
  return false;
}

// 근거가 인정되지 않을 때 대신 보여줄 글: 요약이 있으면 요약, 없으면 제목(언론사 이름 제외)
export function fallbackEvidence(title: string, summary: string): string {
  return summary && pressOf(summary) === null ? summary : evidenceText(title, summary);
}
