import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { HttpError } from "./api";
import { markLimitMessage } from "./limits";
import type { MarkRecord, MarkStats, Settings } from "./types";

// 기록은 JSON 파일로 저장합니다.
// - 내 컴퓨터: 프로젝트 안의 data/ 폴더 (.gitignore에 등록됨)
// - Vercel 배포: 서버에는 프로젝트 폴더에 쓸 수 없어서 서버의 임시 폴더를 씁니다. 서버가 한동안 쉬거나 다시 시작하면
//   표시 기록·설정·최근 검색 기사가 초기화될 수 있고, 서버(인스턴스)마다 따로 저장될 수 있어요. (시연용 한계)
const DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "near-miss-data")
  : path.join(process.cwd(), "data");

// 파일이 아직 없을 때만 빈 값을 돌려줍니다. 파일은 있는데 읽지 못하거나 모양이 이상하면
// 빈 값으로 착각해 그 위에 덮어쓰지 않도록, 저장을 멈추고 오류로 알립니다.
async function readJson<T>(
  name: string,
  fallback: T,
  isValid: (v: unknown) => boolean = () => true,
): Promise<T> {
  let raw: string;
  try {
    raw = await fs.readFile(path.join(DIR, name), "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw brokenFile(name);
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValid(parsed)) throw new Error("모양이 맞지 않음");
    return parsed as T;
  } catch {
    throw brokenFile(name);
  }
}

function brokenFile(name: string): HttpError {
  return new HttpError(
    `기록 파일(data/${name})을 읽지 못했어요. 기록을 지키려고 저장을 멈췄어요. data 폴더를 백업한 뒤 이 파일을 확인해 주세요.`,
    500,
  );
}

const isPlainObject = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v);

// 임시 파일에 먼저 쓰고 이름을 바꿔서, 저장 도중 꺼져도 기존 파일이 반쯤 쓰인 채로 남지 않게 합니다.
async function writeJson(name: string, data: unknown): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  const target = path.join(DIR, name);
  const temp = `${target}.tmp`;
  await fs.writeFile(temp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(temp, target);
}

// "읽고 → 고치고 → 쓰기"가 겹치면 먼저 끝난 저장이 덮어써져 사라질 수 있어서, 저장은 한 번에 하나씩 차례로 합니다.
let saveQueue: Promise<unknown> = Promise.resolve();
function inOrder<T>(task: () => Promise<T>): Promise<T> {
  const run = saveQueue.then(task, task);
  saveQueue = run.catch(() => undefined);
  return run;
}

export const DEFAULT_SETTINGS: Settings = {
  criteria: [
    "사고(또는 사고 직전 상황)가 실제로 있었다.",
    "대형재난으로 이어질 만한 가능성이 있다. (누구나 아는 일상적 위험, 늘 나는 사고는 제외)",
    "원인이 정책·제도상 문제(규정 공백)에 있다.",
    "그 정책 문제가 개선으로 해결될 수 있다. (소급 적용 가능한 정책으로 이미 해결되는 건은 제외)",
  ],
  nearMissGuide: "어떤 점이 아차사고였는지 정해진 목록 없이 한두 문장으로 쓴다.",
  causeGuide: "어떤 규정이 공백인지를 적는다.",
  riskBasis: "대형재난이 크게 발생할 가능성",
  history: [],
};

export async function getSettings(): Promise<Settings> {
  const saved = await readJson<Partial<Settings>>("settings.json", {}, isPlainObject);
  // 파일을 직접 고쳐서 값이 비었거나 모양이 이상해도, 기준 목록이 비어 "모든 기사가 아차사고"가 되는 일이 없게
  // 문제 있는 항목만 기본값으로 대신합니다.
  const text = (v: unknown, fallback: string) =>
    typeof v === "string" && v.trim() !== "" && v.length <= 300 ? v : fallback;
  const criteria = Array.isArray(saved.criteria)
    ? saved.criteria.filter((c): c is string => typeof c === "string" && c.trim() !== "" && c.length <= 300)
    : [];
  return {
    criteria:
      criteria.length >= 1 && criteria.length <= 10 ? criteria : DEFAULT_SETTINGS.criteria,
    nearMissGuide: text(saved.nearMissGuide, DEFAULT_SETTINGS.nearMissGuide),
    causeGuide: text(saved.causeGuide, DEFAULT_SETTINGS.causeGuide),
    riskBasis: text(saved.riskBasis, DEFAULT_SETTINGS.riskBasis),
    history: Array.isArray(saved.history)
      ? saved.history.filter(
          (h) => !!h && typeof h.at === "string" && typeof h.summary === "string",
        )
      : [],
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await inOrder(() => writeJson("settings.json", settings));
}

type MarkFile = { items: Record<string, MarkRecord> };

const readMarkFile = () =>
  readJson<MarkFile>(
    "marks.json",
    { items: {} },
    (v) => isPlainObject(v) && isPlainObject((v as { items?: unknown }).items),
  );

export async function getMarks(): Promise<MarkRecord[]> {
  const file = await readMarkFile();
  return Object.values(file.items);
}

export async function setMark(
  input: Pick<MarkRecord, "link" | "title" | "summary" | "mark">,
): Promise<void> {
  return inOrder(async () => {
    const file = await readMarkFile();
    const now = new Date().toISOString();
    const prev = Object.hasOwn(file.items, input.link) ? file.items[input.link] : undefined;
    // 기록은 지우지 않는 것이 규칙이라, 너무 많이 쌓였으면 오래된 것을 지우는 대신 새 저장을 멈추고 알립니다.
    const full = markLimitMessage(Object.keys(file.items).length, !prev, prev?.history.length ?? 0);
    if (full) throw new HttpError(full, 400);
    file.items[input.link] = {
      ...input,
      updatedAt: now,
      history: [...(prev?.history ?? []), { mark: input.mark, at: now }],
    };
    await writeJson("marks.json", file);
  });
}

// 방금 검색해서 화면에 보여준 기사 목록입니다. 표시를 저장할 때 "정말 우리가 보여준 기사인지" 확인하고,
// 제목·요약은 브라우저가 보낸 값이 아니라 여기 적힌 값만 믿습니다. (최근 200건만 유지)
type ArticleFile = { items: Record<string, { title: string; summary: string; at: string }> };
const MAX_ARTICLES = 200;
const isArticleFile = (v: unknown) =>
  isPlainObject(v) && isPlainObject((v as { items?: unknown }).items);

export async function rememberArticles(
  items: { title: string; summary: string; link: string }[],
): Promise<void> {
  return inOrder(async () => {
    // 이 파일은 다시 만들 수 있는 임시 목록이라, 깨졌으면 비우고 새로 시작해도 됩니다.
    let file: ArticleFile = { items: {} };
    try {
      file = await readJson<ArticleFile>("recent.json", { items: {} }, isArticleFile);
    } catch {
      file = { items: {} };
    }
    const at = new Date().toISOString();
    for (const it of items) {
      delete file.items[it.link]; // 지웠다가 다시 넣어서 "가장 최근"으로 옮김
      file.items[it.link] = { title: it.title, summary: it.summary, at };
    }
    const links = Object.keys(file.items);
    for (const link of links.slice(0, Math.max(0, links.length - MAX_ARTICLES))) {
      delete file.items[link];
    }
    await writeJson("recent.json", file);
  });
}

export async function findArticle(
  link: string,
): Promise<{ title: string; summary: string } | null> {
  try {
    const file = await readJson<ArticleFile>("recent.json", { items: {} }, isArticleFile);
    return Object.hasOwn(file.items, link) ? file.items[link] : null;
  } catch {
    return null;
  }
}

export function getStats(marks: MarkRecord[]): MarkStats {
  const fit = marks.filter((m) => m.mark === "적합").length;
  const needMore = marks.filter((m) => m.mark === "추가검색필요").length;
  const total = fit + needMore;
  return {
    fit,
    needMore,
    total,
    fitRatio: total ? Math.round((fit / total) * 100) : null,
  };
}
