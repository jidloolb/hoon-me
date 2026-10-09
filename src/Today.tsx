import { useEffect, useRef, useState } from "react";
import { Card, Check, Chips, Empty, Seg, Sheet, SpaceChips, inputCls, btnCls, ghostBtn } from "./ui";
import { DueCard } from "./Recurs";
import { act, activeSpaces, blocksOn, hasHabit, inbox, live, spaceOf, type Block, type Habit, type State, type Task } from "./store";
import { addDays, dur, hm, kst, longDate, nowMin, parseMoney, shrinkPhoto, won } from "./lib";

const HOUR = 52; // 1시간 높이(px)
const DURS = [15, 30, 60, 90, 120];

export function Today({ s, date, setDate }: { s: State; date: string; setDate: (d: string) => void }) {
  const [newAt, setNewAt] = useState<number | null>(null);
  const [edit, setEdit] = useState<Block | null>(null);
  const [schedule, setSchedule] = useState<Task | null>(null);
  const [closing, setClosing] = useState(false);
  const isToday = date === kst();
  const blocks = blocksOn(s, date);
  const day = s.days[date];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setDate(addDays(date, -1))} className="px-3 py-1 text-xl text-gray-400" aria-label="이전 날">
          ‹
        </button>
        <button onClick={() => setDate(kst())} className="text-center">
          <span className="block font-semibold">{longDate(date)}</span>
          {!isToday && <span className="text-xs text-blue-600">오늘로</span>}
        </button>
        <button onClick={() => setDate(addDays(date, 1))} className="px-3 py-1 text-xl text-gray-400" aria-label="다음 날">
          ›
        </button>
      </div>

      {isToday && <DueCard s={s} />}
      <QuickAdd s={s} />
      <HabitStrip s={s} date={date} />
      <InboxCard s={s} onSchedule={setSchedule} />

      <Card className="!p-0 overflow-hidden">
        <Timeline s={s} date={date} blocks={blocks} onEmpty={setNewAt} onBlock={setEdit} />
      </Card>

      {day ? (
        <button onClick={() => setClosing(true)} className="block w-full text-left">
          <Card title="오늘 마무리 ✓">
            <div className="flex gap-3">
              {day.photo && <img src={day.photo} alt="" className="h-16 w-16 rounded-xl object-cover" />}
              <div className="text-sm text-gray-600">
                {day.condition != null && <p>컨디션 {day.condition}/5</p>}
                <p className="whitespace-pre-wrap">{day.reflection || "회고 없음"}</p>
              </div>
            </div>
          </Card>
        </button>
      ) : (
        <button onClick={() => setClosing(true)} className="w-full rounded-2xl bg-accent py-3.5 font-semibold text-white">
          {isToday ? "오늘 마무리하기" : "이 날 마무리하기"}
        </button>
      )}

      <NewBlockSheet s={s} date={date} at={newAt} onClose={() => setNewAt(null)} />
      <BlockSheet s={s} block={edit} onClose={() => setEdit(null)} />
      <ScheduleSheet s={s} date={date} task={schedule} onClose={() => setSchedule(null)} />
      <DayClose s={s} date={date} open={closing} onClose={() => setClosing(false)} />
    </div>
  );
}

// ---------- 한 줄 입력: 할일(Inbox) · 돈 · 기록 · 배움 ----------
type Mode = "task" | "money" | "note" | "learn";
const PH: Record<Mode, string> = {
  task: "할 일 — Inbox에 모였다가 시간 칸에 놓아요",
  money: "점심 12000 · 커피 4.5천 · +월급 350만",
  note: "떠오른 생각, 오늘 있었던 일",
  learn: "오늘 배운 것 한 줄",
};
function QuickAdd({ s }: { s: State }) {
  const [mode, setMode] = useState<Mode>("task");
  const [space, setSpace] = useState<string | null>(null);
  const [diary, setDiary] = useState(false);
  const [text, setText] = useState("");
  const [toast, setToast] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const money = mode === "money" ? parseMoney(text) : null;

  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(""), 1800);
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    if (mode === "task") {
      act.addTask(t, space);
      flash("Inbox에 넣었어요");
    } else if (mode === "money") {
      if (!money) return flash("금액을 못 찾았어요");
      act.addTxn(money);
      flash(`${money.kind === "income" ? "수입" : "지출"} ${won(money.amount)}원 · ${money.category}`);
    } else if (mode === "note") {
      act.addNote(t, diary ? "diary" : "memo");
      flash(diary ? "일기 저장 · 일기 체크" : "기록 저장");
    } else {
      act.addLearn(t);
      flash("배운 것 저장");
    }
    setText("");
    ref.current?.focus();
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Seg<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { v: "task", label: "할일" },
            { v: "money", label: "돈" },
            { v: "note", label: "기록" },
            { v: "learn", label: "배움" },
          ]}
        />
        {mode === "note" && (
          <Seg<"m" | "d">
            small
            value={diary ? "d" : "m"}
            onChange={(v) => setDiary(v === "d")}
            options={[
              { v: "m", label: "메모" },
              { v: "d", label: "일기" },
            ]}
          />
        )}
      </div>
      <div className="flex gap-2">
        <input ref={ref} value={text} onChange={(e) => setText(e.target.value)} placeholder={PH[mode]} enterKeyHint="done" className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-blue-500" />
        <button disabled={!text.trim()} className="rounded-xl bg-blue-600 px-4 font-semibold text-white disabled:opacity-30">
          추가
        </button>
      </div>
      {mode === "task" && (
        <div className="mt-2 overflow-x-auto">
          <SpaceChips spaces={activeSpaces(s)} value={space} onChange={setSpace} />
        </div>
      )}
      {mode === "money" && text.trim() && (
        <p className="mt-2 text-xs text-gray-500">
          {money ? `${money.kind === "income" ? "수입" : "지출"} ${won(money.amount)}원 · ${money.category}${money.memo ? ` · ${money.memo}` : ""}` : "금액을 숫자로 적어주세요"}
        </p>
      )}
      {toast && <p className="mt-2 text-xs font-medium text-blue-600">{toast}</p>}
    </form>
  );
}

// ---------- 습관 가로 줄 ----------
function HabitStrip({ s, date }: { s: State; date: string }) {
  const [valueFor, setValueFor] = useState<Habit | null>(null);
  const [val, setVal] = useState("");
  const habits = live(s.habits)
    .filter((h) => !h.archived)
    .sort((a, b) => a.sort - b.sort);

  function tap(h: Habit) {
    const done = hasHabit(s, h.id, date);
    if (!done && h.unit) {
      setVal("");
      setValueFor(h);
    } else act.setHabit(h.id, !done, null, date);
  }
  function save() {
    const n = parseFloat(val);
    act.setHabit(valueFor!.id, true, Number.isFinite(n) ? n : null, date);
    setValueFor(null);
  }
  return (
    <>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {habits.map((h) => {
          const done = hasHabit(s, h.id, date);
          const v = s.habitLogs[`${h.id}:${date}`]?.value;
          return (
            <button key={h.id} onClick={() => tap(h)} className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition active:scale-95 ${done ? "bg-blue-600 text-white" : "bg-card text-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"}`}>
              {done ? "✓ " : ""}
              {h.name}
              {done && v != null ? ` ${v}${h.unit ?? ""}` : ""}
            </button>
          );
        })}
      </div>
      <Sheet open={!!valueFor} onClose={() => setValueFor(null)} title={`${valueFor?.name} (${valueFor?.unit})`}>
        <div className="flex gap-2">
          <input autoFocus inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} placeholder={`몇 ${valueFor?.unit}? (비워도 체크)`} className={inputCls} onKeyDown={(e) => e.key === "Enter" && save()} />
          <button onClick={save} className={btnCls}>
            체크
          </button>
        </div>
      </Sheet>
    </>
  );
}

// ---------- Inbox ----------
function InboxCard({ s, onSchedule }: { s: State; onSchedule: (t: Task) => void }) {
  const [open, setOpen] = useState(true);
  const items = inbox(s);
  return (
    <Card
      title={
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5">
          Inbox <span className="text-sm font-normal text-gray-400">{items.length}</span>
          <span className="text-xs text-gray-400">{open ? "▾" : "▸"}</span>
        </button>
      }
      right={open && items.length > 0 && <span className="text-xs text-gray-400">탭해서 시간 정하기</span>}
    >
      {open &&
        (items.length ? (
          <ul>
            {items.map((t) => {
              const sp = spaceOf(s, t.spaceId);
              return (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  <Check done={false} onClick={() => act.toggleTask(t.id)} color={sp?.color} />
                  <button onClick={() => onSchedule(t)} className="flex flex-1 items-center gap-2 text-left text-[15px]">
                    {sp && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sp.color }} />}
                    {t.text}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>비어 있어요. 위 입력창 [할일]로 모아요.</Empty>
        ))}
    </Card>
  );
}

// ---------- 하루 타임라인 ----------
function Timeline({ s, date, blocks, onEmpty, onBlock }: { s: State; date: string; blocks: Block[]; onEmpty: (min: number) => void; onBlock: (b: Block) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const isToday = date === kst();
  const [now, setNow] = useState(nowMin());
  useEffect(() => {
    const t = setInterval(() => setNow(nowMin()), 60_000);
    return () => clearInterval(t);
  }, []);
  // 처음 열 때 지금(또는 아침 7시) 근처로 스크롤
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = isToday ? Math.max(0, now - 90) : blocks[0] ? blocks[0].start - 30 : 7 * 60;
    el.scrollTop = (target / 60) * HOUR;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  function tapEmpty(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const min = Math.floor(((e.clientY - rect.top) / HOUR) * 2) * 30; // 30분 단위
    onEmpty(Math.min(23 * 60 + 30, Math.max(0, min)));
  }

  // 겹치는 블록은 옆으로 나눠 그린다
  const lanes: { b: Block; lane: number; lanes: number }[] = [];
  let group: Block[] = [];
  let groupEnd = -1;
  const flush = () => {
    const ends: number[] = [];
    const placed = group.map((b) => {
      let lane = ends.findIndex((e) => e <= b.start);
      if (lane < 0) lane = ends.length;
      ends[lane] = b.end;
      return { b, lane };
    });
    placed.forEach((p) => lanes.push({ ...p, lanes: ends.length }));
    group = [];
  };
  for (const b of blocks) {
    if (b.start >= groupEnd && group.length) flush();
    group.push(b);
    groupEnd = Math.max(groupEnd, b.end);
  }
  if (group.length) flush();

  return (
    <div ref={ref} className="relative h-[60dvh] overflow-y-auto">
      <div className="relative" style={{ height: HOUR * 24 }}>
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="absolute left-0 right-0 flex" style={{ top: h * HOUR }}>
            <span className="w-12 -translate-y-1/2 pr-2 text-right text-[11px] text-gray-400">{h === 0 ? "" : `${h}시`}</span>
            <div className="flex-1 border-t border-gray-100" />
          </div>
        ))}
        <div className="absolute bottom-0 left-12 right-0 top-0" onClick={tapEmpty} />
        {isToday && (
          <div className="pointer-events-none absolute left-11 right-0 z-10 flex items-center" style={{ top: (now / 60) * HOUR }}>
            <span className="h-2 w-2 -translate-x-1 rounded-full bg-red-500" />
            <div className="h-[2px] flex-1 bg-red-500" />
          </div>
        )}
        {lanes.map(({ b, lane, lanes: n }) => {
          const sp = spaceOf(s, b.spaceId);
          const color = sp?.color ?? "#6f6790";
          const h = Math.max(22, ((b.end - b.start) / 60) * HOUR - 2);
          const short = h < 40;
          return (
            <button
              key={b.id}
              onClick={() => onBlock(b)}
              className={`absolute overflow-hidden rounded-lg px-2 text-left ${b.status === "skipped" ? "opacity-40" : ""}`}
              style={{
                top: (b.start / 60) * HOUR + 1,
                height: h,
                left: `calc(3rem + 4px + (100% - 3rem - 8px) * ${lane / n})`,
                width: `calc((100% - 3rem - 8px) / ${n} - 2px)`,
                background: `${color}38`,
                borderLeft: `3px solid ${color}`,
              }}
            >
              <div className={`flex items-center gap-1 ${short ? "text-xs" : "pt-1 text-[13px]"} font-medium text-gray-900`}>
                {b.status === "done" && <span style={{ color }}>✓</span>}
                <span className={`truncate ${b.status === "skipped" ? "line-through" : ""}`}>{b.title}</span>
              </div>
              {!short && (
                <div className="text-[11px] text-gray-500">
                  {hm(b.start)}–{hm(b.end)}
                  {b.status === "done" && b.actualMin != null && b.actualMin !== b.end - b.start ? ` · 실제 ${dur(b.actualMin)}` : ""}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- 새 블록 ----------
function NewBlockSheet({ s, date, at, onClose }: { s: State; date: string; at: number | null; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [space, setSpace] = useState<string | null>(null);
  const [start, setStart] = useState(0);
  const [len, setLen] = useState(60);
  useEffect(() => {
    if (at != null) {
      setTitle("");
      setStart(at);
      setLen(60);
    }
  }, [at]);
  if (at == null) return null;
  function save() {
    if (!title.trim()) return;
    act.addBlock({ date, start, end: Math.min(1440, start + len), title: title.trim(), spaceId: space });
    onClose();
  }
  return (
    <Sheet open onClose={onClose} title="시간 블록">
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="무엇을 할까요?" className={`${inputCls} mb-3`} onKeyDown={(e) => e.key === "Enter" && save()} />
      <TimeFields start={start} setStart={setStart} len={len} setLen={setLen} />
      <p className="mb-2 mt-4 text-xs text-gray-400">Space</p>
      <SpaceChips spaces={activeSpaces(s)} value={space} onChange={setSpace} />
      <button onClick={save} disabled={!title.trim()} className={`${btnCls} mt-5 w-full`}>
        넣기
      </button>
    </Sheet>
  );
}

function TimeFields({ start, setStart, len, setLen }: { start: number; setStart: (n: number) => void; len: number; setLen: (n: number) => void }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          type="time"
          step={300}
          value={hm(start)}
          onChange={(e) => {
            const [h, m] = e.target.value.split(":").map(Number);
            if (Number.isFinite(h)) setStart(h * 60 + (m || 0));
          }}
          className="rounded-xl border border-gray-200 px-3 py-2"
        />
        <span className="text-sm text-gray-400">부터 · {hm(Math.min(1440, start + len))}까지</span>
      </div>
      <div className="mt-2">
        <Chips<number> value={len} onChange={setLen} options={DURS.map((d) => ({ v: d, label: dur(d) }))} />
      </div>
    </div>
  );
}

// ---------- Inbox 할일 → 시간 정하기 ----------
function ScheduleSheet({ s, date, task, onClose }: { s: State; date: string; task: Task | null; onClose: () => void }) {
  const [start, setStart] = useState(0);
  const [len, setLen] = useState(60);
  const [space, setSpace] = useState<string | null>(null);
  useEffect(() => {
    if (!task) return;
    // 기본값: 지금(또는 9시) 이후 첫 빈 30분 칸
    const blocks = blocksOn(s, date).filter((b) => b.status !== "skipped");
    let t = date === kst() ? Math.ceil(nowMin() / 30) * 30 : 9 * 60;
    for (let i = 0; i < 48; i++) {
      const clash = blocks.some((b) => b.start < t + 60 && b.end > t);
      if (!clash) break;
      t += 30;
    }
    setStart(Math.min(t, 23 * 60));
    setLen(task.estMin ?? 60);
    setSpace(task.spaceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);
  if (!task) return null;
  return (
    <Sheet open onClose={onClose} title={task.text}>
      <p className="mb-2 text-xs text-gray-400">{longDate(date)}</p>
      <TimeFields start={start} setStart={setStart} len={len} setLen={setLen} />
      <p className="mb-2 mt-4 text-xs text-gray-400">Space</p>
      <SpaceChips spaces={activeSpaces(s)} value={space} onChange={setSpace} />
      <button
        onClick={() => {
          act.updateTask(task.id, { spaceId: space });
          act.addBlock({ date, start, end: Math.min(1440, start + len), title: task.text, spaceId: space, taskId: task.id });
          onClose();
        }}
        className={`${btnCls} mt-5 w-full`}
      >
        이 시간에 놓기
      </button>
      <button
        onClick={() => {
          act.deleteTask(task.id);
          onClose();
        }}
        className="mt-3 w-full py-2 text-sm text-red-500"
      >
        할일 삭제
      </button>
    </Sheet>
  );
}

// ---------- 블록 열기: 완료(실제 시간) · 안 함 · 수정 ----------
function BlockSheet({ s, block, onClose }: { s: State; block: Block | null; onClose: () => void }) {
  const [actual, setActual] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(0);
  const [len, setLen] = useState(60);
  const [title, setTitle] = useState("");
  const [space, setSpace] = useState<string | null>(null);
  useEffect(() => {
    if (!block) return;
    setActual(String(block.actualMin ?? block.end - block.start));
    setNote(block.note);
    setEditing(false);
    setStart(block.start);
    setLen(block.end - block.start);
    setTitle(block.title);
    setSpace(block.spaceId);
  }, [block]);
  if (!block) return null;
  const b = s.blocks[block.id] ?? block;
  const planned = b.end - b.start;
  const sp = spaceOf(s, b.spaceId);

  function done() {
    const n = parseInt(actual, 10);
    act.setBlockStatus(b.id, "done", Number.isFinite(n) ? n : planned);
    if (note !== b.note) act.updateBlock(b.id, { note });
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          {sp && <span className="h-2.5 w-2.5 rounded-full" style={{ background: sp.color }} />}
          {b.title}
        </span>
      }
    >
      <p className="mb-4 text-sm text-gray-500">
        {hm(b.start)}–{hm(b.end)} · 계획 {dur(planned)}
        {b.status === "done" && ` · ✓ 실제 ${dur(b.actualMin ?? planned)}`}
        {b.status === "skipped" && " · 안 함"}
      </p>

      {editing ? (
        <>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputCls} mb-3`} />
          <TimeFields start={start} setStart={setStart} len={len} setLen={setLen} />
          <p className="mb-2 mt-4 text-xs text-gray-400">Space</p>
          <SpaceChips spaces={activeSpaces(s)} value={space} onChange={setSpace} />
          <button
            onClick={() => {
              act.updateBlock(b.id, { title: title.trim() || b.title, start, end: Math.min(1440, start + len), spaceId: space });
              onClose();
            }}
            className={`${btnCls} mt-5 w-full`}
          >
            저장
          </button>
        </>
      ) : (
        <>
          <p className="mb-2 text-xs text-gray-400">실제로 한 시간(분)</p>
          <div className="mb-3 flex gap-2">
            <input inputMode="numeric" value={actual} onChange={(e) => setActual(e.target.value.replace(/\D/g, ""))} className={inputCls} />
            <button onClick={done} className={btnCls}>
              완료
            </button>
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="메모·링크" className={`${inputCls} mb-3 resize-none`} />
          <div className="grid grid-cols-3 gap-2">
            {b.status !== "planned" ? (
              <button onClick={() => (act.setBlockStatus(b.id, "planned"), onClose())} className={ghostBtn}>
                되돌리기
              </button>
            ) : (
              <button onClick={() => (act.setBlockStatus(b.id, "skipped"), onClose())} className={ghostBtn}>
                안 함
              </button>
            )}
            <button onClick={() => setEditing(true)} className={ghostBtn}>
              수정
            </button>
            <button
              onClick={() => {
                act.deleteBlock(b.id);
                onClose();
              }}
              className={`${ghostBtn} text-red-500`}
            >
              {b.taskId ? "Inbox로" : "삭제"}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

// ---------- 하루 마무리(Today Zero): 계획 vs 실제 · 남은 블록 정리 · 컨디션 · 회고 · 사진 ----------
function DayClose({ s, date, open, onClose }: { s: State; date: string; open: boolean; onClose: () => void }) {
  const [reflection, setReflection] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [condition, setCondition] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const d = s.days[date];
    setReflection(d?.reflection ?? "");
    setPhoto(d?.photo ?? null);
    setCondition(d?.condition ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date]);
  if (!open) return null;

  const blocks = blocksOn(s, date);
  const left = blocks.filter((b) => b.status === "planned");
  const bySpace = new Map<string, { name: string; color: string; plan: number; real: number }>();
  for (const b of blocks) {
    if (b.status === "skipped") continue;
    const sp = spaceOf(s, b.spaceId);
    const k = sp?.id ?? "none";
    const cur = bySpace.get(k) ?? { name: sp?.name ?? "기타", color: sp?.color ?? "#6f6790", plan: 0, real: 0 };
    cur.plan += b.end - b.start;
    if (b.status === "done") cur.real += b.actualMin ?? b.end - b.start;
    bySpace.set(k, cur);
  }
  const plan = [...bySpace.values()].reduce((a, x) => a + x.plan, 0);
  const real = [...bySpace.values()].reduce((a, x) => a + x.real, 0);

  return (
    <Sheet open onClose={onClose} title={`${longDate(date)} 마무리`}>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-gray-50 py-2">
          <p className="text-xs text-gray-400">계획</p>
          <p className="font-semibold">{dur(plan)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 py-2">
          <p className="text-xs text-gray-400">실제</p>
          <p className="font-semibold">{dur(real)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 py-2">
          <p className="text-xs text-gray-400">실행률</p>
          <p className="font-semibold">{plan ? Math.round((real / plan) * 100) : 0}%</p>
        </div>
      </div>
      {bySpace.size > 0 && (
        <ul className="mb-4 space-y-1.5 text-sm">
          {[...bySpace.values()].map((x) => (
            <li key={x.name} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: x.color }} />
                {x.name}
              </span>
              <span className="tabular-nums text-gray-500">
                {dur(x.real)} / {dur(x.plan)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {left.length > 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 p-3">
          <p className="mb-2 text-sm font-medium text-amber-800">못 끝낸 블록 {left.length}개</p>
          {left.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-2 py-1 text-sm">
              <span className="truncate">{b.title}</span>
              <span className="flex shrink-0 gap-1">
                <button onClick={() => act.setBlockStatus(b.id, "done", b.end - b.start)} className="rounded-lg bg-card px-2 py-1 text-xs">
                  했음
                </button>
                <button onClick={() => act.updateBlock(b.id, { date: addDays(date, 1) })} className="rounded-lg bg-card px-2 py-1 text-xs">
                  내일로
                </button>
                <button onClick={() => act.setBlockStatus(b.id, "skipped")} className="rounded-lg bg-card px-2 py-1 text-xs text-gray-500">
                  안 함
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mb-2 text-xs text-gray-400">오늘 컨디션</p>
      <div className="mb-4 flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setCondition(n)} className={`h-11 flex-1 rounded-xl text-lg ${condition === n ? "bg-accent text-white" : "bg-gray-100"}`}>
            {["😫", "😕", "😐", "🙂", "😄"][n - 1]}
          </button>
        ))}
      </div>
      <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} rows={3} placeholder="한 줄 회고 — 잘한 것, 아쉬운 것" className={`${inputCls} mb-3 resize-none`} />
      <label className="mb-4 flex cursor-pointer items-center gap-3">
        {photo ? <img src={photo} alt="" className="h-20 w-20 rounded-xl object-cover" /> : <span className="flex h-20 w-20 items-center justify-center rounded-xl bg-gray-100 text-2xl">📷</span>}
        <span className="text-sm text-gray-500">{busy ? "줄이는 중…" : photo ? "사진 바꾸기" : "오늘의 사진 한 장"}</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            try {
              setPhoto(await shrinkPhoto(f));
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <button
        onClick={() => {
          act.closeDay(date, reflection.trim(), photo, condition);
          onClose();
        }}
        className={`${btnCls} w-full`}
      >
        마무리
      </button>
    </Sheet>
  );
}
