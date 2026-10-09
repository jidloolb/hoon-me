import { useEffect, useRef, useState } from "react";
import { Seg } from "./ui";
import { act } from "./store";
import { kst, parseMoney, won } from "./lib";

type Mode = "todo" | "money" | "note";
type When = "today" | "tomorrow" | "any";

const PH: Record<Mode, string> = {
  todo: "할 일 한 줄",
  money: "점심 12000 · 커피 4.5천 · +월급 350만",
  note: "떠오른 생각, 오늘 있었던 일",
};

// 첫 화면 맨 위 한 줄 입력 — 할일/돈/기록 전부 여기서. 마지막 모드는 기억한다.
export function QuickAdd() {
  const [mode, setMode] = useState<Mode>(() => {
    try {
      return (localStorage.getItem("quickadd-mode") as Mode) || "todo";
    } catch {
      return "todo";
    }
  });
  const [when, setWhen] = useState<When>("today");
  const [diary, setDiary] = useState(false);
  const [text, setText] = useState("");
  const [toast, setToast] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem("quickadd-mode", mode);
    } catch {}
  }, [mode]);

  const money = mode === "money" ? parseMoney(text) : null;

  function flash(s: string) {
    setToast(s);
    setTimeout(() => setToast(""), 1800);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    if (mode === "todo") {
      act.addTodo(t, when === "today" ? kst() : when === "tomorrow" ? kst(1) : null);
      flash("할일 추가");
    } else if (mode === "money") {
      if (!money) return flash("금액을 못 찾았어요");
      act.addTxn(money);
      flash(`${money.kind === "income" ? "수입" : "지출"} ${won(money.amount)}원 · ${money.category}`);
    } else {
      act.addNote(t, diary ? "diary" : "memo");
      flash(diary ? "일기 저장 · 일기 체크" : "기록 저장");
    }
    setText("");
    ref.current?.focus();
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Seg<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { v: "todo", label: "할일" },
            { v: "money", label: "돈" },
            { v: "note", label: "기록" },
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
        <input
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PH[mode]}
          enterKeyHint="done"
          className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-blue-500"
        />
        <button disabled={!text.trim()} className="rounded-xl bg-blue-600 px-4 font-semibold text-white disabled:opacity-30">
          추가
        </button>
      </div>
      {mode === "todo" && (
        <div className="mt-2 flex gap-1.5">
          {(
            [
              ["today", "오늘"],
              ["tomorrow", "내일"],
              ["any", "언제든"],
            ] as [When, string][]
          ).map(([v, l]) => (
            <button
              type="button"
              key={v}
              onClick={() => setWhen(v)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${when === v ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}
            >
              {l}
            </button>
          ))}
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
