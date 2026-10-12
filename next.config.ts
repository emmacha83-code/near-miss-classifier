import type { NextConfig } from "next";

// 다른 사이트가 이 앱을 몰래 겹쳐 띄워 클릭을 속이는 것(클릭재킹) 등을 막는 보안 헤더입니다.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" }, // 다른 사이트가 이 앱을 액자(iframe)로 띄우지 못하게
  { key: "X-Content-Type-Options", value: "nosniff" }, // 브라우저가 파일 종류를 멋대로 추측하지 못하게
  { key: "Referrer-Policy", value: "no-referrer" }, // 기사 링크를 누를 때 이 앱의 주소를 넘기지 않게
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // 배포할 때 "가상 예시 불러오기"가 읽는 파일을 서버 꾸러미에 꼭 넣습니다. (런타임에 읽는 파일은 자동으로 안 들어갈 수 있어요)
  outputFileTracingIncludes: {
    "/api/sample": ["./sample-data/virtual-tunnel-accident.md"],
  },
};

export default nextConfig;
