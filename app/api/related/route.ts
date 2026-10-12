import { HttpError, fail, readBody } from "@/lib/api";
import { chatJson } from "@/lib/openai";

const SYSTEM = `당신은 뉴스에서 아차사고(대형사고로 이어질 뻔한 사례) 기사를 찾는 연구원을 돕는 검색 도우미입니다.
담당자가 입력한 키워드와 관련된 한국어 뉴스 검색어를 8개 제안하세요.
- 짧고 실제 뉴스 검색에 쓸 만한 말로 쓰세요. (2~15자 안팎)
- 입력한 키워드와 똑같은 검색어는 넣지 마세요.
- 사람 이름은 넣지 마세요.
반드시 {"related": ["검색어1", "검색어2", ...]} 형태의 JSON으로만 답하세요.`;

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
    if (!keyword) throw new HttpError("키워드를 입력해 주세요.", 400);
    if (keyword.length > 50) throw new HttpError("키워드가 너무 깁니다. (50자 이내)", 400);

    const data = await chatJson<{ related?: unknown }>(SYSTEM, `키워드: ${keyword}`);
    const list = Array.isArray(data.related) ? data.related : [];
    const related = [
      ...new Set(
        list
          .filter((v): v is string => typeof v === "string")
          .map((v) => v.trim())
          .filter((v) => v && v !== keyword && v.length <= 30),
      ),
    ].slice(0, 8);
    return Response.json({ related });
  } catch (e) {
    return fail(e);
  }
}
