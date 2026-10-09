import { useState } from "react";
import { Card, CheckRow } from "./ui";
import { DatePickSheet } from "./DatePickSheet";
import { act, live, type State, type Todo } from "./store";
import { dateLabel, kst } from "./lib";

// 전체 할일 — 날짜별 묶음(지난·오늘·내일·이후·언제든) + 최근 완료
export function Todos({ s }: { s: State }) {
  const [dateFor, setDateFor] = useState<Todo | null>(null);
  const t = kst();
  const all = live(s.todos);
  const open = all.filter((x) => !x.done).sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.createdAt.localeCompare(b.createdAt));
  const done = all
    .filter((x) => x.done)
    .sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""))
    .slice(0, 20);

  const groups: [string, Todo[]][] = [];
  for (const x of open) {
    const k = !x.date ? "언제든" : x.date < t ? "지난 것" : dateLabel(x.date, t);
    const g = groups.find(([n]) => n === k);
    g ? g[1].push(x) : groups.push([k, [x]]);
  }

  return (
    <div className="space-y-3">
      {groups.length === 0 && <p className="py-8 text-center text-sm text-gray-400">열린 할일이 없어요</p>}
      {groups.map(([name, items]) => (
        <Card key={name} title={<span className={name === "지난 것" ? "text-red-500" : ""}>{name}</span>}>
          {items.map((x) => (
            <CheckRow
              key={x.id}
              done={false}
              onToggle={() => act.toggleTodo(x.id)}
              meta={name === "지난 것" ? dateLabel(x.date, t) : "📅"}
              metaTone={name === "지난 것" ? "red" : "gray"}
              onMeta={() => setDateFor(x)}
            >
              <span onClick={() => setDateFor(x)}>{x.text}</span>
            </CheckRow>
          ))}
        </Card>
      ))}

      {done.length > 0 && (
        <Card title={<span className="text-gray-400">최근 완료</span>}>
          {done.map((x) => (
            <CheckRow key={x.id} done onToggle={() => act.toggleTodo(x.id)} meta={x.doneAt?.slice(5, 10).replace("-", "/")}>
              {x.text}
            </CheckRow>
          ))}
        </Card>
      )}

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
    </div>
  );
}
