import { useState } from "react";
import { Card, Chips, Empty, Seg, Sheet, Spark, inputCls, btnCls } from "./ui";
import { act, live, type Book, type Note, type State } from "./store";
import { dateLabel, kst, longDate, won } from "./lib";

type View = "body" | "learn" | "notes" | "days";

// 성장 — 몸 · 학습 · 기록 · 회고(하루 마무리 모음)
export function Grow({ s }: { s: State }) {
  const [view, setView] = useState<View>("body");
  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <Seg<View>
          value={view}
          onChange={setView}
          options={[
            { v: "body", label: "몸" },
            { v: "learn", label: "학습" },
            { v: "notes", label: "기록" },
            { v: "days", label: "회고" },
          ]}
        />
      </div>
      {view === "body" && <Body s={s} />}
      {view === "learn" && <Learn s={s} />}
      {view === "notes" && <Notes s={s} />}
      {view === "days" && <Days s={s} />}
    </div>
  );
}

// ---------- 몸: 몸무게 · 컨디션 · 수면 ----------
function Body({ s }: { s: State }) {
  const [w, setW] = useState("");
  const metrics = live(s.metrics).sort((a, b) => a.date.localeCompare(b.date));
  const weights = metrics.filter((m) => m.key === "weight");
  const conds = metrics.filter((m) => m.key === "condition");
  const sleep = live(s.habitLogs)
    .filter((l) => l.habitId === "h-sleep" && l.value != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const todayW = s.metrics[`weight:${kst()}`];
  const last = weights[weights.length - 1];
  const prev = weights[weights.length - 2];

  function save() {
    const n = parseFloat(w);
    if (!Number.isFinite(n) || n <= 0) return;
    act.setMetric("weight", n);
    setW("");
  }
  return (
    <>
      <Card title="몸무게" right={last && <span className="text-sm tabular-nums text-gray-500">{last.value}kg {prev && <span className={last.value <= prev.value ? "text-blue-600" : "text-red-500"}>{last.value - prev.value > 0 ? "+" : ""}{(last.value - prev.value).toFixed(1)}</span>}</span>}>
        <div className="flex gap-2">
          <input inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} placeholder={todayW ? `오늘 ${todayW.value}kg (다시 적으면 바뀜)` : "오늘 몸무게 kg"} className={inputCls} onKeyDown={(e) => e.key === "Enter" && save()} />
          <button onClick={save} className={btnCls}>
            기록
          </button>
        </div>
        {weights.length > 1 && (
          <div className="mt-3">
            <Spark values={weights.slice(-60).map((m) => m.value)} />
            <p className="mt-1 flex justify-between text-[11px] text-gray-400">
              <span>{dateLabel(weights.slice(-60)[0].date)}</span>
              <span>최근 {Math.min(60, weights.length)}회</span>
            </p>
          </div>
        )}
      </Card>
      <Card title="컨디션" right={<span className="text-xs text-gray-400">하루 마무리 때 기록</span>}>
        {conds.length > 1 ? (
          <>
            <Spark values={conds.slice(-30).map((m) => m.value)} color="#1baf7a" />
            <p className="mt-1 text-xs text-gray-500">최근 {Math.min(30, conds.length)}일 평균 {(conds.slice(-30).reduce((a, m) => a + m.value, 0) / Math.min(30, conds.length)).toFixed(1)} / 5</p>
          </>
        ) : (
          <Empty>하루 마무리에서 컨디션을 고르면 쌓여요</Empty>
        )}
      </Card>
      <Card title="수면" right={<span className="text-xs text-gray-400">습관 '수면'에서</span>}>
        {sleep.length > 1 ? (
          <>
            <Spark values={sleep.slice(-30).map((l) => l.value!)} color="#4a3aa7" />
            <p className="mt-1 text-xs text-gray-500">최근 {Math.min(30, sleep.length)}회 평균 {(sleep.slice(-30).reduce((a, l) => a + l.value!, 0) / Math.min(30, sleep.length)).toFixed(1)}시간</p>
          </>
        ) : (
          <Empty>오늘 탭 습관에서 수면 시간을 적으면 쌓여요</Empty>
        )}
      </Card>
    </>
  );
}

// ---------- 학습: 배운 것 한 줄 · 책·강의 ----------
function Learn({ s }: { s: State }) {
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const [book, setBook] = useState<Book | null>(null);
  const learns = live(s.learns).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const books = live(s.books).sort((a, b) => (a.status === "진행" ? 0 : 1) - (b.status === "진행" ? 0 : 1) || b.createdAt.localeCompare(a.createdAt));
  const progress = (id: string) => live(s.bookLogs).filter((l) => l.bookId === id).reduce((a, l) => a + l.amount, 0);

  return (
    <>
      <Card
        title="책·강의"
        right={
          <button onClick={() => setAdding(true)} className="text-sm font-medium text-blue-600">
            + 추가
          </button>
        }
      >
        {books.length === 0 && <Empty>읽는 책, 듣는 강의를 추가하고 진도를 적어요</Empty>}
        {books.map((b) => {
          const p = progress(b.id);
          return (
            <button key={b.id} onClick={() => setBook(b)} className={`block w-full py-2.5 text-left ${b.status !== "진행" ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between gap-2 text-[15px]">
                <span className="truncate">
                  <span className="mr-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">{b.kind}</span>
                  {b.title}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-gray-500">
                  {b.status === "완료" ? "완료" : `${p}${b.total ? `/${b.total}` : ""}${b.unit}`}
                </span>
              </div>
              {b.total ? (
                <div className="mt-1.5 h-1.5 rounded-full bg-gray-100">
                  <div className="h-1.5 rounded-full bg-[#eb6834]" style={{ width: `${Math.min(100, (p / b.total) * 100)}%` }} />
                </div>
              ) : null}
            </button>
          );
        })}
      </Card>

      <Card title="배운 것" right={<span className="text-xs text-gray-400">{learns.length}개</span>}>
        <div className="mb-3 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="오늘 배운 것 한 줄" className={inputCls} onKeyDown={(e) => e.key === "Enter" && text.trim() && (act.addLearn(text.trim()), setText(""))} />
          <button onClick={() => text.trim() && (act.addLearn(text.trim()), setText(""))} className={btnCls}>
            추가
          </button>
        </div>
        <ul className="space-y-2">
          {learns.slice(0, 50).map((l) => (
            <li key={l.id} className="flex gap-2 text-[15px] leading-snug">
              <span className="w-14 shrink-0 text-xs leading-6 text-gray-400">{dateLabel(l.date)}</span>
              <span className="flex-1">{l.text}</span>
              <button onClick={() => window.confirm("지울까요?") && act.deleteLearn(l.id)} className="px-1 text-xs text-gray-300">
                ×
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <AddBookSheet open={adding} onClose={() => setAdding(false)} />
      <BookSheet s={s} book={book} progress={book ? progress(book.id) : 0} onClose={() => setBook(null)} />
    </>
  );
}

function AddBookSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Book["kind"]>("책");
  const [total, setTotal] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title="책·강의 추가">
      <Chips<Book["kind"]>
        value={kind}
        onChange={setKind}
        options={[
          { v: "책", label: "책" },
          { v: "강의", label: "강의" },
        ]}
      />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" className={`${inputCls} mb-2 mt-3`} />
      <input inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))} placeholder={kind === "책" ? "전체 쪽 수 (선택)" : "전체 강 수 (선택)"} className={`${inputCls} mb-3`} />
      <button
        onClick={() => {
          if (!title.trim()) return;
          act.addBook(title.trim(), kind, total ? Number(total) : null);
          setTitle("");
          setTotal("");
          onClose();
        }}
        className={`${btnCls} w-full`}
      >
        추가
      </button>
    </Sheet>
  );
}

function BookSheet({ s, book, progress, onClose }: { s: State; book: Book | null; progress: number; onClose: () => void }) {
  const [n, setN] = useState("");
  if (!book) return null;
  const b = s.books[book.id] ?? book;
  const logs = live(s.bookLogs)
    .filter((l) => l.bookId === b.id)
    .sort((x, y) => y.date.localeCompare(x.date));
  function save() {
    const v = parseInt(n, 10);
    if (!v) return;
    act.logBook(b.id, v);
    setN("");
  }
  return (
    <Sheet open onClose={onClose} title={b.title}>
      <p className="mb-3 text-sm text-gray-500">
        지금까지 {progress}
        {b.unit}
        {b.total ? ` / ${b.total}${b.unit} (${Math.round((progress / b.total) * 100)}%)` : ""}
      </p>
      <div className="flex gap-2">
        <input autoFocus inputMode="numeric" value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, ""))} placeholder={`오늘 몇 ${b.unit}?`} className={inputCls} onKeyDown={(e) => e.key === "Enter" && save()} />
        <button onClick={save} className={btnCls}>
          +{b.unit}
        </button>
      </div>
      {b.kind === "책" && <p className="mt-1 text-xs text-gray-400">적으면 오늘 '독서' 습관도 같이 체크돼요</p>}
      <div className="mt-4 flex gap-2">
        {(["진행", "완료", "보류"] as const).map((st) => (
          <button key={st} onClick={() => act.setBookStatus(b.id, st)} className={`flex-1 rounded-xl py-2 text-sm ${b.status === st ? "bg-gray-900 text-white" : "bg-gray-100"}`}>
            {st}
          </button>
        ))}
      </div>
      {logs.length > 0 && (
        <ul className="mt-4 max-h-40 overflow-y-auto text-sm text-gray-500">
          {logs.map((l) => (
            <li key={l.id} className="flex justify-between py-1">
              <span>{l.date}</span>
              <span>
                +{l.amount}
                {b.unit}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

// ---------- 기록: 일기·메모 + 전체 검색 ----------
function Notes({ s }: { s: State }) {
  const [kind, setKind] = useState<"memo" | "diary">("diary");
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const hit = (x: string) => x.toLowerCase().includes(query);
  const notes = live(s.notes)
    .filter((n) => !query || hit(n.text))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 150);
  const others = query
    ? [
        ...live(s.tasks).filter((t) => hit(t.text)).map((t) => ({ id: t.id, tag: "할일", text: t.text, date: t.createdAt.slice(0, 10) })),
        ...live(s.blocks).filter((b) => hit(b.title) || hit(b.note)).map((b) => ({ id: b.id, tag: "블록", text: b.title, date: b.date })),
        ...live(s.txns).filter((x) => hit(x.memo) || hit(x.category)).map((x) => ({ id: x.id, tag: "돈", text: `${x.memo || x.category} ${won(x.amount)}원`, date: x.date })),
        ...live(s.learns).filter((l) => hit(l.text)).map((l) => ({ id: l.id, tag: "배움", text: l.text, date: l.date })),
        ...live(s.days).filter((d) => hit(d.reflection)).map((d) => ({ id: d.id, tag: "회고", text: d.reflection, date: d.date })),
      ]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 50)
    : [];
  const byDay = new Map<string, Note[]>();
  for (const n of notes) byDay.set(n.date, [...(byDay.get(n.date) ?? []), n]);

  return (
    <>
      <Card>
        <div className="mb-2">
          <Seg
            small
            value={kind}
            onChange={setKind}
            options={[
              { v: "diary", label: "일기" },
              { v: "memo", label: "메모" },
            ]}
          />
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={kind === "diary" ? "오늘 어땠어요?" : "기억해둘 것"} className={`${inputCls} resize-none`} />
        <button onClick={() => text.trim() && (act.addNote(text.trim(), kind), setText(""))} disabled={!text.trim()} className={`${btnCls} mt-2 w-full`}>
          저장
        </button>
      </Card>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="검색 — 기록·할일·블록·돈·배움·회고 전부" className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 outline-none focus:border-blue-500" />
      {others.length > 0 && (
        <Card title="다른 곳에서">
          {others.map((o) => (
            <p key={o.tag + o.id} className="py-1 text-sm">
              <span className="mr-1.5 text-xs text-gray-400">
                {o.tag} · {o.date}
              </span>
              {o.text}
            </p>
          ))}
        </Card>
      )}
      {[...byDay.entries()].map(([day, ns]) => (
        <Card key={day} title={<span className="text-gray-500">{longDate(day)}</span>}>
          <ul className="space-y-3">
            {ns.map((n) => (
              <li key={n.id} className="text-[15px] leading-relaxed">
                {n.kind === "diary" && <span className="mr-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[11px] text-violet-700">일기</span>}
                <span className="whitespace-pre-wrap">{n.text}</span>
                <span className="ml-2 text-xs text-gray-300">{n.createdAt.slice(11, 16)}</span>
                <button onClick={() => window.confirm("이 기록을 지울까요?") && act.deleteNote(n.id)} className="ml-2 px-1 text-xs text-gray-300">
                  ×
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ))}
      {notes.length === 0 && <p className="py-6 text-center text-sm text-gray-400">{query ? "찾은 기록이 없어요" : "아직 기록이 없어요"}</p>}
    </>
  );
}

// ---------- 회고: 하루 마무리 모음 ----------
function Days({ s }: { s: State }) {
  const days = live(s.days).sort((a, b) => b.date.localeCompare(a.date));
  if (!days.length) return <p className="py-8 text-center text-sm text-gray-400">오늘 탭 맨 아래 [오늘 마무리하기]로 하루를 닫으면 여기 모여요</p>;
  return (
    <div className="space-y-3">
      {days.map((d) => (
        <Card key={d.id}>
          <div className="flex gap-3">
            {d.photo && <img src={d.photo} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />}
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {longDate(d.date)} {d.condition != null && <span className="ml-1">{["😫", "😕", "😐", "🙂", "😄"][d.condition - 1]}</span>}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{d.reflection || "—"}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
