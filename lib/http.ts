// 외부 서버가 답을 주지 않을 때 화면이 끝없이 멈추지 않도록, 정해진 시간이 지나면 요청을 끊습니다.
export class TimeoutError extends Error {}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms: number,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new TimeoutError(`${ms}ms 안에 답이 없음`);
    }
    throw e;
  }
}
