import { HttpError, assertLocalHost, fail, readBody } from "@/lib/api";
import { getSettings, saveSettings } from "@/lib/store";
import type { Settings } from "@/lib/types";

export async function GET(request: Request) {
  try {
    assertLocalHost(request.headers);
    return Response.json(await getSettings());
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await readBody(request);
    const prev = await getSettings();

    const criteria = Array.isArray(body.criteria)
      ? body.criteria
          .filter((c): c is string => typeof c === "string")
          .map((c) => c.trim())
          .filter(Boolean)
      : [];
    if (criteria.length === 0 || criteria.length > 10) {
      throw new HttpError("선정 기준은 1개 이상 10개 이하로 입력해 주세요.", 400);
    }
    if (criteria.some((c) => c.length > 300)) {
      throw new HttpError("선정 기준 한 줄은 300자 이내로 써 주세요.", 400);
    }
    const text = (v: unknown, name: string) => {
      const t = typeof v === "string" ? v.trim() : "";
      if (!t || t.length > 300) {
        throw new HttpError(`${name}을(를) 300자 이내로 입력해 주세요.`, 400);
      }
      return t;
    };
    const nearMissGuide = text(body.nearMissGuide, "아차한 점 작성 방법");
    const causeGuide = text(body.causeGuide, "원인 작성 방법");
    const riskBasis = text(body.riskBasis, "위험도 기준");

    const changed: string[] = [];
    if (JSON.stringify(criteria) !== JSON.stringify(prev.criteria)) changed.push("선정 기준");
    if (nearMissGuide !== prev.nearMissGuide) changed.push("아차한 점 작성 방법");
    if (causeGuide !== prev.causeGuide) changed.push("원인 작성 방법");
    if (riskBasis !== prev.riskBasis) changed.push("위험도 기준");

    const next: Settings = {
      criteria,
      nearMissGuide,
      causeGuide,
      riskBasis,
      history: changed.length
        ? [
            { at: new Date().toISOString(), summary: `${changed.join(", ")} 수정` },
            ...prev.history,
          ].slice(0, 100)
        : prev.history,
    };
    await saveSettings(next);
    return Response.json(next);
  } catch (e) {
    return fail(e);
  }
}
