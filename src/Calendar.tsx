import { useState } from "react";
import { Card, Seg } from "./ui";
import { activeSpaces, blockMinutes, blocksOn, hasHabit, live, spaceOf, type State } from "./store";
import { recursOn } from "./Recurs";
import { addDays, dur, hm, kst, weekday, weekdayIdx } from "./lib";

// 주간·월간 달력 — 날짜를 누르면 그 날 타임라인으로
export function Calendar({ s, date, onPick }: { s: State; date: string; onPick: (d: string) => void }) {
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(date);
  const habits = live(s.habits).filter((h) => !h.archived);
  const habitRate = (d: string) => (habits.length ? habits.filter((h) => hasHabit(s, h.id, d)).length / habits.length : 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setAnchor(view === "week" ? addDays(anchor, -7) : shiftMonth(anchor, -1))} className="px-3 py-1 text-xl text-gray-400">
          ‹
        </button>
        <Seg
          value={view}
          onChange={setView}
          options={[
            { v: "week", label: "주간" },
            { v: "month", label: "월간" },
          ]}
        />
        <button onClick={() => setAnchor(view === "week" ? addDays(anchor, 7) : shiftMonth(anchor, 1))} className="px-3 py-1 text-xl text-gray-400">
          ›
        </button>
      </div>
      {view === "week" ? <Week s={s} anchor={anchor} onPick={onPick} habitRate={habitRate} /> : <Month s={s} anchor={anchor} onPick={onPick} habitRate={habitRate} />}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-gray-500">
        {activeSpaces(s).map((sp) => (
          <span key={sp.id} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: sp.color }} />
            {sp.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function shiftMonth(d: string, n: number) {
  const [y, m] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}

function Week({ s, anchor, onPick, habitRate }: { s: State; anchor: string; onPick: (d: string) => void; habitRate: (d: string) => number }) {
  const mon = addDays(anchor, -((weekdayIdx(anchor) + 6) % 7)); // 월요일 시작
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const t = kst();
  return (
    <div className="space-y-2">
      <p className="px-1 text-sm font-semibold">
        {Number(mon.slice(5, 7))}/{Number(mon.slice(8))} – {Number(days[6].slice(5, 7))}/{Number(days[6].slice(8))}
      </p>
      {days.map((d) => {
        const blocks = blocksOn(s, d).filter((b) => b.status !== "skipped");
        const doneMin = blocks.reduce((a, b) => a + blockMinutes(b), 0);
        const rate = habitRate(d);
        return (
          <button key={d} onClick={() => onPick(d)} className="block w-full text-left">
            <Card className={`!py-3 ${d === t ? "ring-2 ring-blue-500" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="w-10 shrink-0 text-center">
                  <p className={`text-xs ${weekdayIdx(d) === 0 ? "text-red-500" : weekdayIdx(d) === 6 ? "text-blue-500" : "text-gray-400"}`}>{weekday(d)}</p>
                  <p className="text-lg font-semibold leading-tight">{Number(d.slice(8))}</p>
                </div>
                <div className="min-w-0 flex-1">
                  {blocks.length ? (
                    <ul className="space-y-0.5">
                      {blocks.slice(0, 4).map((b) => {
                        const sp = spaceOf(s, b.spaceId);
                        return (
                          <li key={b.id} className="flex items-center gap-1.5 text-[13px]">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sp?.color ?? "#8a8a86" }} />
                            <span className="w-11 shrink-0 tabular-nums text-gray-400">{hm(b.start)}</span>
                            <span className={`truncate ${b.status === "done" ? "text-gray-400 line-through" : ""}`}>{b.title}</span>
                          </li>
                        );
                      })}
                      {blocks.length > 4 && <li className="text-xs text-gray-400">+{blocks.length - 4}개</li>}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-gray-300">일정 없음</p>
                  )}
                </div>
                <div className="shrink-0 text-right text-[11px] text-gray-400">
                  {doneMin > 0 && <p>{dur(doneMin)}</p>}
                  {rate > 0 && <p>습관 {Math.round(rate * 100)}%</p>}
                  {s.days[d] && <p>✓ 마무리</p>}
                  {recursOn(s, d).map((r) => (
                    <p key={r.id}>💸 {r.name}</p>
                  ))}
                </div>
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}

function Month({ s, anchor, onPick, habitRate }: { s: State; anchor: string; onPick: (d: string) => void; habitRate: (d: string) => number }) {
  const first = `${anchor.slice(0, 7)}-01`;
  const start = addDays(first, -((weekdayIdx(first) + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const month = anchor.slice(0, 7);
  const t = kst();
  return (
    <Card>
      <p className="mb-3 text-center font-semibold">
        {month.slice(0, 4)}년 {Number(month.slice(5))}월
      </p>
      <div className="grid grid-cols-7 text-center text-xs text-gray-400">
        {["월", "화", "수", "목", "금", "토", "일"].map((w) => (
          <span key={w} className="pb-2">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d) => {
          const inMonth = d.startsWith(month);
          const blocks = blocksOn(s, d).filter((b) => b.status !== "skipped");
          // 그 날 쓴 Space 색 점(최대 4)
          const colors = [...new Set(blocks.map((b) => spaceOf(s, b.spaceId)?.color ?? "#8a8a86"))].slice(0, 4);
          const rate = habitRate(d);
          return (
            <button key={d} onClick={() => onPick(d)} className={`flex h-14 flex-col items-center rounded-xl pt-1 ${inMonth ? "" : "opacity-30"} ${d === t ? "bg-blue-50" : ""}`}>
              <span className={`text-sm ${d === t ? "font-bold text-blue-600" : ""}`}>{Number(d.slice(8))}</span>
              <span className="mt-0.5 flex gap-0.5">
                {colors.map((c) => (
                  <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                ))}
              </span>
              {recursOn(s, d).length > 0 && <span className="text-[9px] leading-none">💸</span>}
              {rate > 0 && (
                <span className="mt-1 h-1 w-6 rounded-full bg-gray-100">
                  <span className="block h-1 rounded-full bg-blue-500" style={{ width: `${rate * 100}%` }} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[11px] text-gray-400">점 = 그 날 쓴 Space · 막대 = 습관 달성률 · 💸 = 고정 지출</p>
    </Card>
  );
}
