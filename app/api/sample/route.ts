import { promises as fs } from "fs";
import path from "path";
import { assertLocalHost, fail } from "@/lib/api";

// 시험용 가상 사례(sample-data/virtual-tunnel-accident.md)를 글 붙여넣는 칸에 넣어 주는 주소입니다.
// 이 파일의 사고와 기관·날짜는 모두 지어낸 것입니다.
export async function GET(request: Request) {
  try {
    assertLocalHost(request.headers);
    const file = path.join(process.cwd(), "sample-data", "virtual-tunnel-accident.md");
    const text = await fs.readFile(file, "utf8");
    return Response.json({ text });
  } catch (e) {
    return fail(e);
  }
}
