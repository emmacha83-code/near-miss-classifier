import type { ReportData } from "@/lib/types";

const Notes = ({ notes }: { notes: string[] }) => (
  <>
    {notes.map((n, i) => (
      <p key={i} className="ml-6 text-sm leading-7 text-ink">
        ※ {n}
      </p>
    ))}
  </>
);

const Row = ({ label, text, notes }: { label: string; text: string; notes?: string[] }) => (
  <div>
    <p>
      <span aria-hidden="true">○ </span>
      {label && <b>({label}) </b>}
      {text}
    </p>
    {notes && <Notes notes={notes} />}
  </div>
);

// 센터 보고서 양식(붙임 형식)으로 보고서 초안을 보여줍니다.
export default function ReportView({ report }: { report: ReportData }) {
  const o = report.overview;
  return (
    <article className="mt-4 flex flex-col gap-6 text-base leading-8">
      <h3 className="text-xl font-bold text-navy">붙임 {report.title}</h3>

      <section>
        <h4 className="font-bold text-navy">□ 사고개요</h4>
        <div className="mt-1 flex flex-col">
          <Row label="사례" text={o.case} />
          <Row label="일시" text={o.when} notes={o.whenNotes} />
          <Row label="장소" text={o.where} notes={o.whereNotes} />
          <Row label="피해" text={o.damage} notes={o.damageNotes} />
          <Row label="원인" text={o.cause} notes={o.causeNotes} />
        </div>
      </section>

      <section>
        <h4 className="font-bold text-navy">□ 사고발생 경위</h4>
        <div className="mt-1 flex flex-col">
          {report.timeline.length ? (
            report.timeline.map((t, i) => <Row key={i} label={t.time} text={t.text} notes={t.notes} />)
          ) : (
            <Row label="" text="확인 불가" />
          )}
        </div>
      </section>

      <section>
        <h4 className="font-bold text-navy">□ 아차 사고 지점 및 대형 사고 발생 가능성</h4>
        <div className="mt-1 flex flex-col">
          <Row label="" text={report.nearMiss} />
          {report.turningPoints.map((t, i) => (
            <div key={i} className="ml-3">
              <p>- Turning point #{i + 1}: {t.title}</p>
              <Notes notes={t.notes} />
            </div>
          ))}
        </div>

        {report.similar.length > 0 && (
          <div className="mt-3">
            <p className="font-semibold">&lt; 국내외 유사사례 &gt;</p>
            {report.similar.map((s, i) => (
              <div key={i} className="mt-2">
                <p className="font-semibold">◇ {s.title}</p>
                <p className="ml-4 text-sm leading-7">· (일시) {s.when}</p>
                <p className="ml-4 text-sm leading-7">· (장소) {s.where}</p>
                <p className="ml-4 text-sm leading-7">· (피해) {s.damage}</p>
                <p className="ml-4 text-sm leading-7">· (경위) {s.story}</p>
                <Notes notes={s.notes} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-3">
          <Row label="가능성" text={report.possibility} />
        </div>
      </section>

      {report.checks.length > 0 && (
        <section className="rounded-2xl bg-background px-4 py-3 text-sm leading-7">
          <h4 className="font-bold text-navy">[참고] 선정 기준 점검 (AI 판단)</h4>
          <ol className="mt-1 list-decimal pl-5">
            {report.checks.map((c, i) => (
              <li key={i}>
                {c.criterion} →{" "}
                <b className={c.ok ? "text-green-700" : "text-red-700"}>{c.ok ? "충족" : "미충족"}</b>: {c.why}
              </li>
            ))}
          </ol>
        </section>
      )}

      {report.links.length > 0 && (
        <section>
          <h4 className="font-bold text-navy">[참고] 참고한 기사 링크</h4>
          <ol className="mt-1 list-decimal pl-6">
            {report.links.map((l) => (
              <li key={l.link} className="break-all">
                <a href={l.link} target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-2">
                  {l.title}
                </a>
                <span className="block text-sm text-ink">{l.link}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}
