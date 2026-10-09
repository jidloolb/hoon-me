import { useState } from "react";
import { BarRow, Card, Columns, Empty, Seg, Spark } from "./ui";
import { activeSpaces, blockMinutes, fundSummary, hasHabit, live, type State } from "./store";
import { addDays, dur, kst, pearson, range, wonShort } from "./lib";

type Period = "28" | "90" | "365";

// 분석 — 시간 · 습관 · 몸 · 돈 · 학습 · 서로 엮기(상관관계)
export function Insights({ s }: { s: State }) {
  const [period, setPeriod] = useState<Period>("28");
  const today = kst();
  const from = addDays(today, -(Number(period) - 1));
  const days = range(from, today);
  const inP = (d: string) => d >= from && d <= today;

  // ----- 시간 -----
  const blocks = live(s.blocks).filter((b) => inP(b.date));
  const spaces = activeSpaces(s);
  const bySpace = spaces
    .map((sp) => ({ sp, min: blocks.filter((b) => b.spaceId === sp.id).reduce((a, b) => a + blockMinutes(b), 0) }))
    .filter((x) => x.min > 0)
    .sort((a, b) => b.min - a.min);
  const planned = blocks.filter((b) => b.status !== "skipped").reduce((a, b) => a + (b.end - b.start), 0);
  const actual = blocks.reduce((a, b) => a + blockMinutes(b), 0);
  const doneCount = blocks.filter((b) => b.status === "done").length;
  const closedCount = blocks.filter((b) => b.status === "done" || b.status === "skipped" || (b.status === "planned" && b.date < today)).length;

  // ----- 습관 -----
  const habits = live(s.habits).filter((h) => !h.archived).sort((a, b) => a.sort - b.sort);
  // 앱을 쓰기 시작한 날 이전은 분모에서 뺀다(첫 주에 '4%' 같은 왜곡 방지)
  const firstUse = [...live(s.habitLogs).map((l) => l.date), ...live(s.blocks).map((b) => b.date), ...live(s.days).map((d) => d.date)].filter((d) => d <= today).sort()[0];
  const hDays = firstUse && firstUse > from ? range(firstUse, today) : days;
  const habitStats = habits.map((h) => {
    const logs = hDays.filter((d) => hasHabit(s, h.id, d));
    const vals = logs.map((d) => s.habitLogs[`${h.id}:${d}`]?.value).filter((v): v is number => v != null);
    let streak = 0;
    for (let d = hasHabit(s, h.id, today) ? today : addDays(today, -1); hasHabit(s, h.id, d); d = addDays(d, -1)) streak++;
    return { h, rate: logs.length / hDays.length, n: logs.length, avg: vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : null, sum: vals.reduce((a, v) => a + v, 0), streak };
  });

  // ----- 몸 -----
  const weights = live(s.metrics).filter((m) => m.key === "weight" && inP(m.date)).sort((a, b) => a.date.localeCompare(b.date));
  const conds = live(s.metrics).filter((m) => m.key === "condition" && inP(m.date));

  // ----- 돈: 최근 6개월 지출·저축 -----
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(`${today.slice(0, 7)}-15T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - (5 - i));
    return d.toISOString().slice(0, 7);
  });
  const txns = live(s.txns);
  const fe = live(s.fundEntries);
  const expByMonth = months.map((m) => ({ label: `${Number(m.slice(5))}월`, value: txns.filter((x) => x.kind === "expense" && x.date.startsWith(m)).reduce((a, x) => a + x.amount, 0) }));
  const saveByMonth = months.map((m) => ({ label: `${Number(m.slice(5))}월`, value: Math.max(0, fe.filter((e) => e.date.startsWith(m)).reduce((a, e) => a + (e.kind === "deposit" ? e.amount : e.kind === "withdraw" ? -e.amount : 0), 0)) }));
  const fundTotal = live(s.funds).filter((f) => !f.archived).reduce((a, f) => a + fundSummary(s, f.id).value, 0);

  // ----- 학습 -----
  const learnMin = blocks.filter((b) => b.spaceId === "s-learn").reduce((a, b) => a + blockMinutes(b), 0);
  const learnedCount = live(s.learns).filter((l) => inP(l.date)).length;
  const pages = live(s.bookLogs).filter((l) => inP(l.date) && s.books[l.bookId]?.kind === "책").reduce((a, l) => a + l.amount, 0);

  // ----- 서로 엮기: 날마다 값을 모아 두 값이 다 있는 날끼리 상관계수 -----
  // '앱을 쓴 날'(뭐라도 기록한 날)만 0을 채운다 — 안 쓴 날을 0으로 치면 왜곡된다
  const active = new Set<string>([
    ...live(s.habitLogs).map((l) => l.date),
    ...live(s.blocks).map((b) => b.date),
    ...live(s.metrics).map((m) => m.date),
    ...txns.map((x) => x.date),
  ]);
  const aDays = days.filter((d) => active.has(d));
  const series: Record<string, (d: string) => number | null> = {
    수면: (d) => s.habitLogs[`h-sleep:${d}`]?.value ?? null,
    컨디션: (d) => s.metrics[`condition:${d}`]?.value ?? null,
    실행률: (d) => {
      const bs = live(s.blocks).filter((b) => b.date === d && b.status !== "skipped");
      const p = bs.reduce((a, b) => a + (b.end - b.start), 0);
      return p ? bs.reduce((a, b) => a + blockMinutes(b), 0) / p : null;
    },
    학습시간: (d) => live(s.blocks).filter((b) => b.date === d && b.spaceId === "s-learn").reduce((a, b) => a + blockMinutes(b), 0),
    러닝: (d) => (hasHabit(s, "h-run", d) ? s.habitLogs[`h-run:${d}`]?.value ?? 1 : 0),
    명상: (d) => (hasHabit(s, "h-meditate", d) ? 1 : 0),
    지출: (d) => txns.filter((x) => x.kind === "expense" && x.date === d).reduce((a, x) => a + x.amount, 0),
  };
  const PAIRS: [string, string, string, string][] = [
    ["수면", "컨디션", "많이 잔 날", "컨디션"],
    ["수면", "실행률", "많이 잔 날", "계획 실행률"],
    ["수면", "학습시간", "많이 잔 날", "학습 시간"],
    ["러닝", "컨디션", "달린 날", "컨디션"],
    ["명상", "컨디션", "명상한 날", "컨디션"],
    ["컨디션", "지출", "컨디션 좋은 날", "지출"],
  ];
  const corr = PAIRS.map(([a, b, aLabel, bLabel]) => {
    const pairs = aDays.map((d) => [series[a](d), series[b](d)] as const).filter((p): p is readonly [number, number] => p[0] != null && p[1] != null) as [number, number][];
    return { a, b, aLabel, bLabel, n: pairs.length, r: pairs.length >= 7 ? pearson(pairs) : null };
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <Seg<Period>
          value={period}
          onChange={setPeriod}
          options={[
            { v: "28", label: "4주" },
            { v: "90", label: "3개월" },
            { v: "365", label: "1년" },
          ]}
        />
      </div>

      <Card title="시간">
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <Mini label="실제로 한 시간" value={dur(actual)} />
          <Mini label="계획 대비" value={planned ? `${Math.round((actual / planned) * 100)}%` : "—"} />
          <Mini label="블록 완료율" value={closedCount ? `${Math.round((doneCount / closedCount) * 100)}%` : "—"} />
        </div>
        {bySpace.length ? (
          <ul className="space-y-2.5">
            {bySpace.map(({ sp, min }) => (
              <BarRow key={sp.id} label={sp.name} value={min} max={bySpace[0].min} color={sp.color} text={dur(min)} />
            ))}
          </ul>
        ) : (
          <Empty>타임라인 블록을 완료하면 Space별 시간이 쌓여요</Empty>
        )}
      </Card>

      <Card title="습관" right={<span className="text-xs text-gray-400">{hDays.length}일 중</span>}>
        <ul className="space-y-2.5">
          {habitStats.map(({ h, rate, n, avg, sum, streak }) => (
            <BarRow
              key={h.id}
              label={
                <>
                  {h.name}
                  <span className="ml-1.5 text-xs text-gray-400">
                    {n}일{streak > 1 ? ` · ${streak}일 연속` : ""}
                    {avg != null && h.unit ? ` · 평균 ${avg.toFixed(1)}${h.unit}` : ""}
                    {h.unit === "km" && sum ? ` · 총 ${sum.toFixed(1)}km` : ""}
                  </span>
                </>
              }
              value={rate}
              max={1}
              text={`${Math.round(rate * 100)}%`}
            />
          ))}
        </ul>
      </Card>

      <Card title="몸">
        {weights.length > 1 ? (
          <>
            <p className="text-sm text-gray-600">
              몸무게 {weights[0].value} → <b>{weights[weights.length - 1].value}kg</b>{" "}
              <span className="text-gray-400">({(weights[weights.length - 1].value - weights[0].value > 0 ? "+" : "") + (weights[weights.length - 1].value - weights[0].value).toFixed(1)})</span>
            </p>
            <Spark values={weights.map((w) => w.value)} />
          </>
        ) : (
          <Empty>성장 › 몸에서 몸무게를 2번 이상 적으면 추이가 보여요</Empty>
        )}
        {conds.length > 0 && <p className="mt-2 text-sm text-gray-600">컨디션 평균 {(conds.reduce((a, m) => a + m.value, 0) / conds.length).toFixed(1)} / 5 ({conds.length}일)</p>}
      </Card>

      <Card title="돈 · 최근 6개월">
        <p className="mb-1 text-xs text-gray-400">지출</p>
        <Columns items={expByMonth} fmt={wonShort} />
        <p className="mb-1 mt-4 text-xs text-gray-400">모으기에 넣은 돈</p>
        <Columns items={saveByMonth} color="#199e70" fmt={wonShort} />
        <p className="mt-3 text-sm text-gray-600">
          지금 모은 돈 <b>{wonShort(fundTotal)}원</b>
        </p>
      </Card>

      <Card title="학습">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Mini label="학습 Space" value={dur(learnMin)} />
          <Mini label="배운 것" value={`${learnedCount}개`} />
          <Mini label="읽은 쪽" value={`${pages}쪽`} />
        </div>
      </Card>

      <Card title="서로 엮어 보기">
        <ul className="space-y-3">
          {corr.map((c) => (
            <li key={c.a + c.b} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700">
                  {c.a} × {c.b}
                </span>
                <span className="text-xs tabular-nums text-gray-400">{c.r != null ? `r = ${c.r.toFixed(2)} · ${c.n}일` : `${c.n}일`}</span>
              </div>
              <p className="mt-0.5 text-gray-500">{sentence(c)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[11px] leading-relaxed text-gray-400">두 값이 다 있는 날이 7일 이상이면 계산해요. 같이 움직인다는 뜻이지 원인이라는 뜻은 아니에요.</p>
      </Card>
    </div>
  );
}

function sentence(c: { r: number | null; n: number; aLabel: string; bLabel: string }) {
  if (c.r == null) return `데이터가 더 필요해요 (${7 - Math.min(7, c.n)}일 더)`;
  const a = Math.abs(c.r);
  const strength = a >= 0.6 ? "뚜렷하게" : a >= 0.3 ? "" : null;
  if (strength == null) return "뚜렷한 관계가 안 보여요";
  return `${c.aLabel}에 ${c.bLabel}이(가) ${strength ? strength + " " : ""}${c.r > 0 ? "높은" : "낮은"} 편이에요`;
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 py-2">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
