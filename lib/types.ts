export type NewsItem = {
  title: string;
  summary: string;
  link: string;
};

export type Risk = "상" | "중" | "하" | "해당 없음" | "확인 불가";
export type Judgement = "아차사고" | "해당 없음";
export type MarkValue = "적합" | "추가검색필요";

export type CaseRow = NewsItem & {
  no: number;
  judgement: Judgement;
  coreSentence: string;
  nearMiss: string;
  cause: string;
  measure: string;
  risk: Risk;
  evidence: string;
  excludedReason?: string;
  // AI 오류로 이 기사만 분류하지 못했을 때 true (다시 검색하면 분류될 수 있음)
  failed?: boolean;
};

export type Settings = {
  criteria: string[];
  nearMissGuide: string;
  causeGuide: string;
  riskBasis: string;
  history: { at: string; summary: string }[];
};

export type MarkRecord = {
  link: string;
  title: string;
  summary: string;
  mark: MarkValue;
  updatedAt: string;
  history: { mark: MarkValue; at: string }[];
};

export type MarkStats = {
  fit: number;
  needMore: number;
  total: number;
  fitRatio: number | null;
};

// 센터 보고서 양식(붙임 형식): 사고개요 → 사고발생 경위 → 아차 사고 지점 및 대형 사고 발생 가능성
export type ReportOverview = {
  case: string; // (사례) 한 줄 요약
  when: string; // (일시)
  whenNotes: string[]; // ※ 전조 등
  where: string; // (장소)
  whereNotes: string[];
  damage: string; // (피해)
  damageNotes: string[];
  cause: string; // (원인)
  causeNotes: string[];
};

export type ReportSimilarCase = {
  title: string; // 유사사례 이름
  when: string;
  where: string;
  damage: string;
  story: string; // (경위)
  notes: string[]; // ※ 비교 설명
};

export type ReportData = {
  source: "news" | "text"; // 뉴스 검색 결과로 만들었는지, 붙여넣은 글로 만들었는지
  title: string; // 붙임 제목(사고 이름)
  overview: ReportOverview;
  timeline: { time: string; text: string; notes: string[] }[]; // 사고발생 경위(시간순)
  nearMiss: string; // 아차 사고 지점과 대형 사고 발생 가능성을 밝히는 핵심 문장
  turningPoints: { title: string; notes: string[] }[];
  similar: ReportSimilarCase[];
  possibility: string; // (가능성)
  checks: { criterion: string; ok: boolean; why: string }[]; // 선정 기준 점검(참고용)
  links: { title: string; link: string }[]; // 참고한 기사 링크(뉴스로 만든 경우)
};