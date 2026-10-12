import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 인터넷에 배포했을 때 앱 전체(화면과 API)를 비밀번호로 잠급니다. (Next.js 16에서 middleware 대신 쓰는 proxy 파일)
// - APP_PASSWORD가 있으면: 그 비밀번호를 아는 사람만 들어올 수 있어요. (브라우저가 비밀번호 창을 띄웁니다)
// - APP_PASSWORD가 없을 때: 내 컴퓨터에서 개발할 때는 그냥 열어 두고, 인터넷 배포 환경(VERCEL)에서는 모두 막습니다.
//   (비밀번호를 깜빡해도 앱이 활짝 열리는 일이 없게 하려는 거예요)

const plain = { "Content-Type": "text/plain; charset=utf-8" };

// 글자 수가 달라도 같은 시간이 걸리도록 비교합니다. (비밀번호를 한 글자씩 맞혀 보는 공격을 어렵게)
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;

  if (!password) {
    if (process.env.VERCEL) {
      return new NextResponse("앱 비밀번호(APP_PASSWORD)가 설정되지 않아 접속을 막아 두었어요.", {
        status: 503,
        headers: plain,
      });
    }
    return NextResponse.next();
  }

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6)); // "아이디:비밀번호"
      const given = decoded.slice(decoded.indexOf(":") + 1); // 아이디는 아무거나, 비밀번호만 확인
      if (safeEqual(given, password)) return NextResponse.next();
    } catch {
      // 형식이 이상하면 아래에서 비밀번호를 다시 요구합니다.
    }
  }

  return new NextResponse("비밀번호가 필요해요.", {
    status: 401,
    headers: { ...plain, "WWW-Authenticate": 'Basic realm="near-miss-analyzer", charset="UTF-8"' },
  });
}

export const config = {
  // 화면과 API 모두 잠급니다. (글꼴·이미지 같은 빌드 파일만 제외)
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
