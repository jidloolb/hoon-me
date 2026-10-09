import { useState } from "react";
import { Card, CheckRow, Sheet, inputCls, btnCls } from "./ui";
import { QuickAdd } from "./QuickAdd";
import { DatePickSheet } from "./DatePickSheet";
import { act, live, type State, type Habit, type Todo } from "./store";
import { dateLabel, kst, won, wonShort } from "./lib";

// 습관별 오늘 상태·연속일·최근 7일
function habitView(s: State, h: Habit, t: string) {
  const has = (d: string) => {
    const l = s.habitLogs[`${h.id}:${d}`];
    return !!l && !l.deleted;
  };
  let streak = 0;
  let i = has(t) ? 0 : -1; // 오늘 아직 안 했으면 어제부터 센다
  while (has(kst(i))) {
    streak++;
    i--;
  }
  const log = s.habitLogs[`${h.id}:${t}`];
  return { done: has(t), value: log && !log.deleted ? log.value : null, week: Array.from({ length: 7 }, (_, k) => has(kst(k - 6))), streak };
}

export function openTodos(s: State) {
  const t = kst();
  return live(s.todos)
    .filter((x) => !x.done || x.doneAt?.slice(0, 10) === t)
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.createdAt.localeCompare(b.createdAt));
}

export function Today({ s, goMoney, goSync }: { s: State; goMoney: () => void; goSync: () => void }) {
  const [valueFor, setValueFor] = useState<Habit | null>(null);
  const [val, setVal] = useState("");
  const [editHabits, setEditHabits] = useState(false);
  const [dateFor, setDateFor] = useState<Todo | null>(null);
  const t = kst();
  const month = t.slice(0, 7);

  const habits = live(s.habits)
    .filter((h) => !h.archived)
    .sort((a, b) => a.sort - b.sort);
  const todos = openTodos(s);
  const visible = todos.filter((x) => !x.date || x.date <= t);
  const later = todos.filter((x) => x.date && x.date > t && !x.done).length;

  const txns = live(s.txns);
  const todayExp = txns.filter((x) => x.kind === "expense" && x.date === t).reduce((a, x) => a + x.amount, 0);
  const monthExp = txns.filter((x) => x.kind === "expense" && x.date.startsWith(month)).reduce((a, x) => a + x.amount, 0);
  const monthInc = txns.filter((x) => x.kind === "income" && x.date.startsWith(month)).reduce((a, x) => a + x.amount, 0);
  const notes = live(s.notes)
    .filter((n) => n.date === t)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // 백업 안 한 지 7일 넘으면 알려준다(데이터가 폰에만 있으니까)
  const hasData = live(s.todos).length + txns.length + live(s.notes).length + Object.keys(s.habitLogs).length > 0;
  const daysSince = s.meta.lastExportAt ? Math.floor((Date.now() - s.meta.lastExportAt) / 86400000) : null;
  const nudge = hasData && (daysSince === null || daysSince >= 7);

  function tapHabit(h: Habit, done: boolean) {
    if (!done && h.unit) {
      setVal("");
      setValueFor(h);
    } else act.setHabit(h.id, !done);
  }
  function saveValue() {
    if (!valueFor) return;
    const n = parseFloat(val);
    act.setHabit(valueFor.id, true, Number.isFinite(n) ? n : null);
    setValueFor(null);
  }

  return (
    <div className="space-y-3">
      {nudge && (
        <button onClick={goSync} className="w-full rounded-2xl bg-amber-50 px-4 py-3 text-left text-sm text-amber-800">
          {daysSince === null ? "아직 백업한 적이 없어요." : `백업한 지 ${daysSince}일 지났어요.`} 기록은 이 폰에만 있어요 — 탭해서 맥으로 보내기
        </button>
      )}

      <QuickAdd />

      <Card
        title="습관"
        right={
          <button onClick={() => setEditHabits(true)} className="text-xs text-gray-400">
            편집
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-2">
          {habits.map((h) => {
            const v = habitView(s, h, t);
            return (
              <button
                key={h.id}
                onClick={() => tapHabit(h, v.done)}
                className={`rounded-2xl p-3 text-left transition active:scale-[0.98] ${v.done ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-900"}`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{h.name}</span>
                  {v.streak > 0 && <span className={`text-xs ${v.done ? "text-blue-100" : "text-gray-400"}`}>{v.streak}일째</span>}
                </div>
                <div className={`mt-0.5 h-4 text-xs ${v.done ? "text-blue-100" : "text-gray-400"}`}>
                  {v.done ? (v.value != null ? `${v.value}${h.unit ?? ""}` : "완료") : h.unit ? `${h.unit} 입력` : "탭해서 체크"}
                </div>
                <div className="mt-2 flex gap-1">
                  {v.week.map((on, i) => (
                    <span key={i} className={`h-1.5 flex-1 rounded-full ${on ? (v.done ? "bg-white" : "bg-blue-500") : v.done ? "bg-blue-400" : "bg-gray-200"}`} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="할일" right={later > 0 && <span className="text-xs text-gray-400">예정 {later}</span>}>
        {visible.length ? (
          visible.map((x) => (
            <CheckRow
              key={x.id}
              done={x.done}
              onToggle={() => act.toggleTodo(x.id)}
              meta={x.date === t ? undefined : dateLabel(x.date, t)}
              metaTone={x.date && x.date < t ? "red" : "gray"}
              onMeta={() => setDateFor(x)}
            >
              <span onClick={() => setDateFor(x)}>{x.text}</span>
            </CheckRow>
          ))
        ) : (
          <p className="py-2 text-sm text-gray-400">비어 있어요</p>
        )}
      </Card>

      <button onClick={goMoney} className="block w-full text-left">
        <Card title="돈">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-gray-400">오늘 지출</p>
              <p className="mt-0.5 font-semibold">{won(todayExp)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">이번 달 지출</p>
              <p className="mt-0.5 font-semibold">{wonShort(monthExp)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">이번 달 수입</p>
              <p className="mt-0.5 font-semibold text-blue-600">{wonShort(monthInc)}</p>
            </div>
          </div>
        </Card>
      </button>

      {notes.length > 0 && (
        <Card title="오늘 기록">
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="text-[15px] leading-relaxed text-gray-800">
                {n.kind === "diary" && <span className="mr-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[11px] text-violet-700">일기</span>}
                <span className="whitespace-pre-wrap">{n.text}</span>
                <span className="ml-2 text-xs text-gray-300">{n.createdAt.slice(11, 16)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Sheet open={!!valueFor} onClose={() => setValueFor(null)} title={`${valueFor?.name} (${valueFor?.unit})`}>
        <div className="flex gap-2">
          <input
            autoFocus
            inputMode="decimal"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={`몇 ${valueFor?.unit}? (비워도 체크됨)`}
            className={inputCls}
            onKeyDown={(e) => e.key === "Enter" && saveValue()}
          />
          <button onClick={saveValue} className={btnCls}>
            체크
          </button>
        </div>
      </Sheet>

      <DatePickSheet
        open={!!dateFor}
        onClose={() => setDateFor(null)}
        onPick={(d) => {
          act.moveTodo(dateFor!.id, d);
          setDateFor(null);
        }}
        onDelete={() => {
          act.deleteTodo(dateFor!.id);
          setDateFor(null);
        }}
      />

      <HabitEditor open={editHabits} onClose={() => setEditHabits(false)} habits={habits} />
    </div>
  );
}

function HabitEditor({ open, onClose, habits }: { open: boolean; onClose: () => void; habits: Habit[] }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  function add() {
    if (!name.trim()) return;
    act.addHabit(name.trim(), unit.trim() || null);
    setName("");
    setUnit("");
  }
  return (
    <Sheet open={open} onClose={onClose} title="습관 편집">
      <ul className="mb-4 divide-y divide-gray-100">
        {habits.map((h) => (
          <li key={h.id} className="flex items-center justify-between py-2.5">
            <span>
              {h.name} {h.unit && <span className="text-xs text-gray-400">({h.unit})</span>}
            </span>
            <button onClick={() => act.archiveHabit(h.id)} className="text-xs text-red-500">
              빼기
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="새 습관" className={inputCls} />
        <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="단위" className={`${inputCls} !w-24`} />
        <button onClick={add} className={btnCls}>
          추가
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-400">단위를 넣으면 체크할 때 값도 적어요 (예: 수면 7.5시간)</p>
    </Sheet>
  );
}
