import { HttpError, fail, readBody } from "@/lib/api";
import { parseCases } from "@/lib/cases";
import { buildDocx } from "@/lib/docx";
import { parseReport } from "@/lib/report";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const cases = parseCases(body.cases);
    const report = parseReport(body.report);
    // 분류 표나 보고서 중 하나는 있어야 합니다. (글을 붙여넣어 만든 보고서는 분류 표 없이 내보냅니다.)
    if (cases.length === 0 && !report) throw new HttpError("내보낼 내용이 없습니다.", 400);
    const buffer = await buildDocx(cases, report);
    const filename = encodeURIComponent("아차사고_보고서.docx");
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
