// 요청 크기와 저장 개수의 상한입니다. 너무 큰 요청이나 끝없이 쌓이는 기록으로 앱이 느려지거나 멈추는 것을 막습니다.

export const MAX_BODY_BYTES = 1_000_000; // 요청 한 번의 크기 상한 (약 1MB). 정상 요청은 수백 KB 안쪽입니다.
export const MAX_KEYWORDS = 10; // 한 번에 고를 수 있는 검색어 수 (화면과 서버가 같은 값을 씁니다)
export const MAX_MARK_LINKS = 2000; // 표시 기록에 저장할 수 있는 기사 수
export const MAX_MARK_HISTORY = 100; // 한 기사에 남기는 표시 이력 수

// 워드·보고서로 보내는 목록의 상한
export const MAX_REPORT_ITEMS = 10; // 유사사고, 개선 문제점, 제도 문제점
export const MAX_REPORT_LINKS = 25; // 참고한 기사 링크

export class BodyTooLargeError extends Error {}

// 요청 내용을 읽되, 상한을 넘으면 더 읽지 않고 멈춥니다. (크기를 속여서 보내거나 끝없이 보내도 메모리를 다 쓰지 않게)
export async function readLimitedText(request: Request, maxBytes: number): Promise<string> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLargeError();
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

// 표시를 저장해도 되는지 확인합니다. 저장할 수 없으면 담당자에게 보여줄 안내 문구를 돌려줍니다.
// (기록은 지우지 않는다는 규칙이라, 가득 차면 오래된 것을 지우지 않고 새 저장을 멈춥니다.)
export function markLimitMessage(
  totalLinks: number,
  isNewLink: boolean,
  historyLength: number,
): string | null {
  if (isNewLink && totalLinks >= MAX_MARK_LINKS) {
    return `표시 기록이 가득 찼어요(${MAX_MARK_LINKS}건). 기록을 지우지 않으려고 새 표시를 멈췄어요. data 폴더를 백업한 뒤 정리해 주세요.`;
  }
  if (!isNewLink && historyLength >= MAX_MARK_HISTORY) {
    return `이 기사의 표시 이력이 ${MAX_MARK_HISTORY}번에 닿았어요. 더 이상 바꿀 수 없어요.`;
  }
  return null;
}
