import { BodyTooLargeError, MAX_BODY_BYTES, readLimitedText } from "./limits";

export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export function fail(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  console.error(e);
  return Response.json(
    { error: "서버에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
    { status: 500 },
  );
}

// 요청이 "내 컴퓨터 주소"로 들어온 것인지 확인합니다. 수상한 사이트가 자기 도메인을 잠시 내 컴퓨터(127.0.0.1)로
// 바꿔치기해서(DNS 리바인딩) 요청을 보내면 Origin과 Host가 서로 같아져서 아래 Origin 검사를 통과하는데,
// 이때 Host가 evil.example 같은 남의 도메인이라서 여기서 걸러집니다. (이 앱은 이 컴퓨터에서만 쓰는 앱이에요)
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
export function assertLocalHost(headers: Headers): void {
  // 인터넷에 배포한 서버(Vercel)는 비밀번호(proxy.ts)로 잠그고 Origin 검사로 지키므로 주소 제한을 두지 않습니다.
  if (process.env.VERCEL) return;
  const host = (headers.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  if (!LOCAL_HOSTS.has(host)) {
    throw new HttpError("이 주소로는 사용할 수 없어요. http://localhost 로 접속해 주세요.", 403);
  }
}

// 다른 웹사이트가 내 브라우저를 이용해 이 앱에 몰래 요청을 보내는 것을 막습니다.
// 0) 요청이 내 컴퓨터 주소(localhost, 127.0.0.1)로 들어온 것이 아니면 거절
// 1) 내용이 JSON 형식이 아니면 거절 (몰래 보내는 "단순 요청"은 JSON을 쓸 수 없어요)
// 2) 다른 사이트에서 온 요청(Origin이 이 앱 주소와 다름)이면 거절
export function assertTrustedRequest(headers: Headers): void {
  assertLocalHost(headers);
  const type = (headers.get("content-type") ?? "").toLowerCase();
  if (!type.startsWith("application/json")) {
    throw new HttpError("요청 형식이 올바르지 않습니다.", 415);
  }
  if (headers.get("sec-fetch-site") === "cross-site") {
    throw new HttpError("허용되지 않은 요청입니다.", 403);
  }
  const origin = headers.get("origin");
  if (origin) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new HttpError("허용되지 않은 요청입니다.", 403);
    }
    if (originHost !== (headers.get("host") ?? "")) {
      throw new HttpError("허용되지 않은 요청입니다.", 403);
    }
  }
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  assertTrustedRequest(request.headers);
  let text: string;
  try {
    text = await readLimitedText(request, MAX_BODY_BYTES);
  } catch (e) {
    if (e instanceof BodyTooLargeError) {
      throw new HttpError("요청이 너무 커요. (한 번에 약 1MB까지만 보낼 수 있어요)", 413);
    }
    throw new HttpError("잘못된 요청입니다.", 400);
  }
  try {
    const body: unknown = JSON.parse(text);
    if (body && typeof body === "object") return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new HttpError("잘못된 요청입니다.", 400);
}
