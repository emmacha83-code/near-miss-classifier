import { HttpError } from "./api";
import { TimeoutError, fetchWithTimeout } from "./http";

// 서버에서만 실행됩니다. OPENAI_API_KEY는 브라우저로 전달되지 않습니다.
const MODEL = "gpt-4o-mini";
// 센터 양식 보고서처럼 긴 글을 읽고 구조에 맞게 정리하는 일은 mini로는 빠뜨리는 것이 많아 더 큰 모델을 씁니다.
export const REPORT_MODEL = "gpt-4o";
const TIMEOUT_MS = 40_000; // AI가 40초 안에 답하지 않으면 끊습니다.

export async function chatJson<T>(
  system: string,
  user: string,
  temperature = 0.2,
  model = MODEL,
): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new HttpError("서버에 OPENAI_API_KEY가 설정되어 있지 않습니다.", 500);
  }

  const request = () =>
    fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      },
      TIMEOUT_MS,
    );

  // 연결이 끊기거나(네트워크 오류) 서버가 잠시 불안정하면 최대 2번 다시 시도합니다.
  let res: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await request();
      if (res.status < 500 && res.status !== 429) break;
    } catch (e) {
      // 시간이 지나도 답이 없으면 다시 시도해도 같을 가능성이 커서 바로 알립니다.
      if (e instanceof TimeoutError) {
        throw new HttpError(
          `AI 서버가 ${TIMEOUT_MS / 1000}초 안에 답하지 않았어요. 잠시 후 다시 시도해 주세요.`,
          504,
        );
      }
      res = undefined;
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  if (!res) {
    throw new HttpError("AI 서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.", 502);
  }

  if (!res.ok) {
    const message =
      res.status === 401
        ? "OpenAI 키가 올바르지 않습니다. .env의 OPENAI_API_KEY를 확인해 주세요."
        : res.status === 429
          ? "요청이 너무 많거나 사용 한도를 넘었습니다. 잠시 후 다시 시도해 주세요."
          : "AI 답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.";
    throw new HttpError(message, 502);
  }

  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new HttpError("AI 답변을 읽지 못했습니다. 다시 시도해 주세요.", 502);
  }
}
