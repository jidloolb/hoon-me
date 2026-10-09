import { useState } from "react";
import { Card, Seg } from "./ui";
import { act, live, type State, type Note } from "./store";
import { dateLabel, won } from "./lib";

// 기록 타임라인 + 검색(기록·할일·지출 한 번에)
export function Notes({ s }: { s: State }) {
  const [kind, setKind] = useState<"memo" | "diary">("diary");
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const hit = (str: string) => str.toLowerCase().includes(query);

  const notes = live(s.notes)
    .filter((n) => !query || hit(n.text))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, query ? 200 : 100);
  const todos = query ? live(s.todos).filter((t) => hit(t.text)).slice(0, 30) : [];
  const txns = query ? live(s.txns).filter((x) => hit(x.memo) || hit(x.category)).slice(0, 30) : [];

  const byDay = new Map<string, Note[]>();
  for (const n of notes) byDay.set(n.date, [...(byDay.get(n.date) ?? []), n]);

  function save() {
    if (!text.trim()) return;
    act.addNote(text.trim(), kind);
    setText("");
  }

  return (
    <div className="space-y-3">
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
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={kind === "diary" ? "오늘 어땠어요?" : "기억해둘 것"}
          className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-blue-500"
        />
        <button onClick={save} disabled={!text.trim()} className="mt-2 w-full rounded-xl bg-blue-600 py-2.5 font-semibold text-white disabled:opacity-30">
          저장
        </button>
      </Card>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="검색 — 기록·할일·지출 전부"
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 outline-none focus:border-blue-500"
      />

      {(todos.length > 0 || txns.length > 0) && (
        <Card title="할일·돈에서">
          {todos.map((t) => (
            <p key={t.id} className="py-1 text-sm">
              <span className="mr-1.5 text-xs text-gray-400">할일</span>
              <span className={t.done ? "text-gray-400 line-through" : ""}>{t.text}</span>
              <span className="ml-1.5 text-xs text-gray-400">{t.doneAt?.slice(0, 10) ?? t.date ?? ""}</span>
            </p>
          ))}
          {txns.map((x) => (
            <p key={x.id} className="py-1 text-sm">
              <span className="mr-1.5 text-xs text-gray-400">{x.date}</span>
              {x.memo || x.category} {won(x.amount)}원
            </p>
          ))}
        </Card>
      )}

      {[...byDay.entries()].map(([day, ns]) => (
        <Card
          key={day}
          title={
            <span className="text-gray-500">
              {dateLabel(day)} <span className="text-xs text-gray-300">{day}</span>
            </span>
          }
        >
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
    </div>
  );
}
