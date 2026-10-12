import {
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { CaseRow, ReportData } from "./types";

const FONT = { ascii: "맑은 고딕", eastAsia: "맑은 고딕", hAnsi: "맑은 고딕", cs: "맑은 고딕" };

// ── 센터 보고서 양식(붙임 형식) ──
// □ 큰 제목 / ○ 항목 / ※ 보충 설명 / - 소항목 / ◇ 유사사례 / · 유사사례 세부
const sectionTitle = (text: string) =>
  new Paragraph({
    spacing: { before: 280, after: 100 },
    children: [new TextRun({ text: `□ ${text}`, bold: true, size: 26, color: "003860" })],
  });

const line = (
  mark: string,
  label: string,
  text: string,
  opts: { indent?: number; bold?: boolean } = {},
) =>
  new Paragraph({
    spacing: { after: 60 },
    indent: { left: opts.indent ?? 0, hanging: 0 },
    children: [
      new TextRun({ text: `${mark} `, bold: opts.bold }),
      ...(label ? [new TextRun({ text: `(${label}) `, bold: true })] : []),
      new TextRun({ text, bold: opts.bold }),
    ],
  });

const noteLines = (notes: string[], indent = 240) =>
  notes.map(
    (n) =>
      new Paragraph({
        spacing: { after: 40 },
        indent: { left: indent },
        children: [new TextRun({ text: `※ ${n}`, color: "484848", size: 20 })],
      }),
  );

function reportChildren(r: ReportData): Paragraph[] {
  const o = r.overview;
  const out: Paragraph[] = [
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: `붙임  ${r.title}`, bold: true, size: 32, color: "003860" })],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "※ AI가 작성한 초안입니다. 담당자가 확인하고 다듬어 주세요.",
          size: 18,
          color: "666666",
        }),
      ],
    }),

    sectionTitle("사고개요"),
    line("○", "사례", o.case),
    line("○", "일시", o.when),
    ...noteLines(o.whenNotes),
    line("○", "장소", o.where),
    ...noteLines(o.whereNotes),
    line("○", "피해", o.damage),
    ...noteLines(o.damageNotes),
    line("○", "원인", o.cause),
    ...noteLines(o.causeNotes),

    sectionTitle("사고발생 경위"),
    ...(r.timeline.length
      ? r.timeline.flatMap((t) => [line("○", t.time, t.text), ...noteLines(t.notes)])
      : [line("○", "", "확인 불가")]),

    sectionTitle("아차 사고 지점 및 대형 사고 발생 가능성"),
    line("○", "", r.nearMiss),
    ...r.turningPoints.flatMap((t, i) => [
      new Paragraph({
        spacing: { after: 40 },
        indent: { left: 120 },
        children: [new TextRun({ text: `- Turning point #${i + 1}: ${t.title}` })],
      }),
      ...noteLines(t.notes, 360),
    ]),
  ];

  if (r.similar.length) {
    out.push(
      new Paragraph({
        spacing: { before: 160, after: 60 },
        children: [new TextRun({ text: "< 국내외 유사사례 >", bold: true })],
      }),
    );
    for (const s of r.similar) {
      out.push(
        new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `◇ ${s.title}`, bold: true })] }),
        ...[
          ["일시", s.when],
          ["장소", s.where],
          ["피해", s.damage],
          ["경위", s.story],
        ].map(
          ([k, v]) =>
            new Paragraph({
              spacing: { after: 30 },
              indent: { left: 240 },
              children: [new TextRun({ text: `· (${k}) ${v}` })],
            }),
        ),
        ...noteLines(s.notes, 360),
      );
    }
  }

  out.push(
    new Paragraph({ spacing: { before: 120, after: 60 }, children: [] }),
    line("○", "가능성", r.possibility),
  );

  if (r.checks.length) {
    out.push(
      new Paragraph({
        spacing: { before: 240, after: 60 },
        children: [new TextRun({ text: "[참고] 선정 기준 점검 (AI 판단)", bold: true, color: "484848" })],
      }),
      ...r.checks.map(
        (c, i) =>
          new Paragraph({
            spacing: { after: 30 },
            indent: { left: 240 },
            children: [
              new TextRun({ text: `${i + 1}. ${c.criterion} → ${c.ok ? "충족" : "미충족"}: ${c.why}`, size: 20, color: "484848" }),
            ],
          }),
      ),
    );
  }

  if (r.links.length) {
    out.push(
      new Paragraph({
        spacing: { before: 240, after: 60 },
        children: [new TextRun({ text: "[참고] 참고한 기사 링크", bold: true, color: "484848" })],
      }),
      ...r.links.map(
        (l, i) =>
          new Paragraph({
            spacing: { after: 30 },
            indent: { left: 240 },
            children: [new TextRun({ text: `${i + 1}. ${l.title} — ${l.link}`, size: 20 })],
          }),
      ),
    );
  }
  return out;
}

// ── 분류 결과 표 ──
const COLS: { head: string; width: number; get: (c: CaseRow) => string }[] = [
  { head: "번호", width: 600, get: (c) => String(c.no) },
  { head: "기사 링크", width: 2400, get: (c) => `${c.title}\n${c.link}` },
  {
    head: "핵심 문장",
    width: 2000,
    // "해당 없음" 건은 왜 제외했는지 사유를 함께 적는다. (화면 표와 같게)
    get: (c) =>
      c.failed
        ? `${c.coreSentence}\n분류 실패 — ${c.excludedReason ?? ""}`.trim()
        : c.judgement === "해당 없음"
          ? `${c.coreSentence}\n해당 없음 — ${c.excludedReason ?? ""}`.trim()
          : c.coreSentence,
  },
  { head: "아차한 점", width: 1800, get: (c) => c.nearMiss },
  { head: "원인(규정 공백)", width: 1800, get: (c) => c.cause },
  { head: "대책", width: 1800, get: (c) => c.measure },
  { head: "위험도", width: 700, get: (c) => c.risk },
  { head: "근거 문장", width: 2858, get: (c) => c.evidence },
];

function cell(text: string, width: number, header = false) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: header ? { type: ShadingType.CLEAR, fill: "DCE8FA", color: "auto" } : undefined,
    children: text.split("\n").map(
      (line) =>
        new Paragraph({ children: [new TextRun({ text: line, bold: header, size: 18 })] }),
    ),
  });
}

function caseTable(cases: CaseRow[]) {
  return new Table({
    width: { size: COLS.reduce((n, c) => n + c.width, 0), type: WidthType.DXA },
    columnWidths: COLS.map((c) => c.width),
    rows: [
      new TableRow({ tableHeader: true, children: COLS.map((c) => cell(c.head, c.width, true)) }),
      ...cases.map(
        (row) => new TableRow({ children: COLS.map((c) => cell(c.get(row), c.width)) }),
      ),
    ],
  });
}

export async function buildDocx(cases: CaseRow[], report?: ReportData): Promise<Buffer> {
  const sections = [];

  if (report) sections.push({ properties: {}, children: reportChildren(report) });

  // 글을 붙여넣어 만든 보고서에는 분류 표가 없습니다.
  if (cases.length > 0) {
    sections.push({
      properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } },
      children: [
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: "아차사고 분류 결과 표", bold: true, size: 28, color: "003860" })],
        }),
        caseTable(cases),
      ],
    });
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    sections,
  });
  return Packer.toBuffer(doc);
}
