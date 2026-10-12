import { HttpError, assertLocalHost, fail, readBody } from "@/lib/api";
import { findArticle, getMarks, getStats, setMark } from "@/lib/store";
import { str } from "@/lib/cases";

export async function GET(request: Request) {
  try {
    assertLocalHost(request.headers);
    const marks = await getMarks();
    return Response.json({
      marks: marks.map((m) => ({ link: m.link, mark: m.mark })),
      stats: getStats(marks),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const link = str(body.link, 1000);
    const mark = body.mark;
    if (!link.startsWith("http")) throw new HttpError("기사 링크가 올바르지 않습니다.", 400);
    if (mark !== "적합" && mark !== "추가검색필요") {
      throw new HttpError("표시는 '적합' 또는 '추가검색필요'만 가능합니다.", 400);
    }
    // 방금 우리가 검색해서 보여준 기사만 표시할 수 있습니다. 제목·요약도 브라우저가 보낸 값이 아니라
    // 서버가 기억해 둔 값을 씁니다. (가짜 제목이 다음 분류의 AI 지시문에 들어가는 것을 막기 위해서)
    const article = await findArticle(link);
    if (!article) {
      throw new HttpError(
        "이 기사는 최근 검색 결과에 없어서 표시를 저장할 수 없어요. 다시 검색한 뒤 눌러 주세요.",
        400,
      );
    }
    await setMark({ link, title: article.title.slice(0, 300), summary: article.summary.slice(0, 1000), mark });
    return Response.json({ stats: getStats(await getMarks()) });
  } catch (e) {
    return fail(e);
  }
}
