// 여러 건을 몇 개씩 묶어 동시에 처리하되, 한 건이 실패해도 멈추지 않고 나머지를 계속 처리합니다.
export type Outcome<R> = { ok: true; value: R } | { ok: false; error: unknown };

export async function runInBatches<T, R>(
  items: T[],
  size: number,
  work: (item: T, index: number) => Promise<R>,
): Promise<Outcome<R>[]> {
  const outcomes: Outcome<R>[] = [];
  for (let start = 0; start < items.length; start += size) {
    const batch = items.slice(start, start + size);
    const part = await Promise.all(
      batch.map(async (item, j): Promise<Outcome<R>> => {
        try {
          return { ok: true, value: await work(item, start + j) };
        } catch (error) {
          return { ok: false, error };
        }
      }),
    );
    outcomes.push(...part);
  }
  return outcomes;
}
