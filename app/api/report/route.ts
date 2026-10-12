import { HttpError, fail, readBody } from "@/lib/api";
import { isEligibleSimilar, parseCases, str } from "@/lib/cases";
import { REPORT_MODEL, chatJson } from "@/lib/openai";
import { MAX_FOCUS_CHARS, MAX_TEXT_CHARS, REPORT_RULES, buildReport, plain } from "@/lib/report";
import { getSettings } from "@/lib/store";
import type { CaseRow } from "@/lib/types";

const system = (criteria: string[], mode: "news" | "text") =>
  `당신은 재난안전 연구센터의 보고서 초안을 쓰는 보조자입니다. 사고 1건에 대해서만 보고서를 씁니다. 다른 사고의 내용을 섞지 마세요.

${
  mode === "news"
    ? `[자료] 사용자 메시지의 <중심사고>가 보고서로 쓸 사고이고, <유사사고후보>는 비교할 다른 기사입니다. similar(유사사례)에는 후보의 번호를 no에 쓰고, 후보에 있는 내용만 쓰세요. 기사 제목·요약만 있어서 경위나 일시가 부족하면 "확인 불가"로 쓰세요.`
    : `[자료] 사용자 메시지의 <글>은 담당자가 붙여넣은 기사·보고·대화 내용이고, <중점>이 있으면 담당자가 문제 삼으려는 지점입니다. <중점>이 있으면 아차 사고 지점(nearMiss, turningPoints)을 그 지점 중심으로 밝히세요. similar(유사사례)는 <글>에 나온 것만 쓰고(no는 0), 없으면 빈 배열로 두세요.`
}

[선정 기준]
${criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

${REPORT_RULES}`;

const describe = (c: CaseRow) =>
  `제목: ${plain(c.title, 300)}\n요약: ${plain(c.summary, 600)}\n아차한 점: ${plain(c.nearMiss, 400)}\n원인(규정 공백): ${plain(c.cause, 400)}\n대책: ${plain(c.measure, 400)}\n위험도: ${c.risk}`;

// 배포 서버에서 이 요청이 끊기지 않고 끝까지 돌 수 있는 시간(초). 분류는 보통 20~40초 걸립니다. 요금제별 한도는 배포 때 확인이 필요해요.
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const settings = await getSettings();
    const pasted = typeof body.text === "string" ? body.text.trim() : "";

    // ── 붙여넣은 글로 만들기 ──
    if (pasted) {
      if (pasted.length > MAX_TEXT_CHARS) {
        throw new HttpError(`글이 너무 길어요. ${MAX_TEXT_CHARS.toLocaleString("ko-KR")}자 이내로 줄여 주세요.`, 400);
      }
      const focus = str(body.focus, MAX_FOCUS_CHARS).trim();
      const prompt = `${focus ? `<중점>\n${plain(focus, MAX_FOCUS_CHARS)}\n</중점>\n\n` : ""}<글>\n${plain(pasted, MAX_TEXT_CHARS)}\n</글>`;
      const ai = await chatJson<unknown>(system(settings.criteria, "text"), prompt, 0, REPORT_MODEL);
      const report = buildReport(ai, {
        source: "text",
        criteria: settings.criteria,
        mainLink: null,
        allowedSimilar: null,
      });
      return Response.json({ report });
    }

    // ── 뉴스 검색 결과에서 고른 사고로 만들기 ──
    const cases = parseCases(body.cases);
    const mainNo = typeof body.mainNo === "number" ? body.mainNo : -1;
    const main = cases.find((c) => c.no === mainNo);
    if (!main) throw new HttpError("보고서로 쓸 사고를 하나 고르거나, 글을 붙여넣어 주세요.", 400);
    if (main.judgement !== "아차사고") {
      throw new HttpError("'해당 없음'으로 분류된 건은 보고서로 쓸 수 없습니다.", 400);
    }

    const candidates = cases.filter((c) => c.no !== main.no && isEligibleSimilar(c));
    const prompt = `<중심사고>\n(번호 ${main.no})\n${describe(main)}\n</중심사고>\n\n<유사사고후보>\n${
      candidates.length
        ? candidates.map((c) => `(번호 ${c.no})\n${describe(c)}`).join("\n\n")
        : "(후보 없음)"
    }\n</유사사고후보>`;
    const ai = await chatJson<unknown>(system(settings.criteria, "news"), prompt, 0, REPORT_MODEL);
    const report = buildReport(ai, {
      source: "news",
      criteria: settings.criteria,
      mainLink: { title: main.title, link: main.link },
      allowedSimilar: new Map(candidates.map((c) => [c.no, { title: c.title, link: c.link }])),
    });
    return Response.json({ report, mainNo: main.no });
  } catch (e) {
    return fail(e);
  }
}
