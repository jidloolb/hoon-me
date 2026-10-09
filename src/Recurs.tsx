import { useEffect, useState } from "react";
import { Card, Chips, Check, Seg, Sheet, inputCls, btnCls } from "./ui";
import { act, activeRecurs, live, recurDate, recurPaid, type Recur, type State } from "./store";
import { addDays, dateLabel, kst, parseAmount, won, EXPENSE_CATS } from "./lib";

const dayLabel = (d: number) => (d >= 31 ? "말일" : `${d}일`);

// 돈 › 가계부: 그 달 고정 지출 목록 · 냈음 체크 · 남은 합계
export function RecurCard({ s, month }: { s: State; month: string }) {
  const [edit, setEdit] = useState<Recur | "new" | null>(null);
  const items = activeRecurs(s);
  const t = kst();
  const left = items.filter((r) => !recurPaid(s, r.id, month)).reduce((a, r) => a + r.amount, 0);
  const total = items.reduce((a, r) => a + r.amount, 0);
  return (
    <Card
      title="고정 지출"
      right={
        <button onClick={() => setEdit("new")} className="text-sm font-medium text-blue-600">
          + 추가
        </button>
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">월세·통신비·구독·적금 이체처럼 매달 나가는 돈을 등록하면, 그 날 알려주고 탭 한 번으로 기록돼요.</p>
      ) : (
        <>
          <ul>
            {items.map((r) => {
              const paid = recurPaid(s, r.id, month);
              const date = recurDate(r, month);
              const late = !paid && date < t;
              return (
                <li key={r.id} className="flex items-center gap-3 py-2">
                  <Check done={paid} onClick={() => (paid ? act.unpayRecur(r.id, month) : act.payRecur(r.id, month))} />
                  <button onClick={() => setEdit(r)} className="flex flex-1 items-center justify-between gap-2 text-left">
                    <span className={`text-[15px] ${paid ? "text-gray-400" : ""}`}>
                      <span className={`mr-1.5 inline-block w-9 text-xs ${late ? "font-semibold text-red-500" : "text-gray-400"}`}>{dayLabel(r.day)}</span>
                      {r.name}
                      {r.fundId && <span className="ml-1 text-xs text-gray-400">→ {s.funds[r.fundId]?.name}</span>}
                    </span>
                    <span className={`tabular-nums ${paid ? "text-gray-400 line-through" : ""}`}>{won(r.amount)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 flex justify-between border-t border-gray-100 pt-2 text-sm">
            <span className="text-gray-500">이번 달 남은 고정 지출</span>
            <span className="font-semibold tabular-nums">
              {won(left)} <span className="text-xs font-normal text-gray-400">/ {won(total)}</span>
            </span>
          </p>
        </>
      )}
      <RecurSheet s={s} edit={edit} onClose={() => setEdit(null)} />
    </Card>
  );
}

// 오늘 탭: 사흘 안에 나갈 돈 + 이번 달 밀린 것
export function DueCard({ s }: { s: State }) {
  const t = kst();
  const month = t.slice(0, 7);
  const soon = addDays(t, 3);
  const due = activeRecurs(s)
    .map((r) => ({ r, date: recurDate(r, month) }))
    .filter(({ r, date }) => !recurPaid(s, r.id, month) && date <= soon);
  if (!due.length) return null;
  return (
    <Card title="곧 나갈 돈 💸">
      {due.map(({ r, date }) => (
        <div key={r.id} className="flex items-center justify-between gap-2 py-1.5">
          <span className="text-[15px]">
            <span className={`mr-1.5 text-xs ${date < t ? "font-semibold text-red-500" : date === t ? "font-semibold text-blue-600" : "text-gray-400"}`}>{date < t ? "지남" : dateLabel(date, t)}</span>
            {r.name} <span className="tabular-nums text-gray-500">{won(r.amount)}</span>
          </span>
          <button onClick={() => act.payRecur(r.id, month)} className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">
            냈음
          </button>
        </div>
      ))}
    </Card>
  );
}

// 달력용: 그 날 나가는 고정 지출 이름들
export function recursOn(s: State, date: string) {
  return activeRecurs(s).filter((r) => recurDate(r, date.slice(0, 7)) === date);
}

function RecurSheet({ s, edit, onClose }: { s: State; edit: Recur | "new" | null; onClose: () => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("25");
  const [kind, setKind] = useState<"expense" | "fund">("expense");
  const [category, setCategory] = useState("생활");
  const [fundId, setFundId] = useState<string | null>(null);
  const funds = live(s.funds).filter((f) => !f.archived).sort((a, b) => a.sort - b.sort);

  useEffect(() => {
    if (!edit) return;
    const r = edit === "new" ? null : edit;
    setName(r?.name ?? "");
    setAmount(r ? String(r.amount) : "");
    setDay(r ? String(r.day) : "25");
    setKind(r?.fundId ? "fund" : "expense");
    setCategory(r?.category ?? "생활");
    setFundId(r?.fundId ?? funds[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit]);
  if (!edit) return null;

  const n = parseAmount(amount);
  const d = Math.min(31, Math.max(1, parseInt(day, 10) || 1));
  const ok = name.trim() && n > 0 && (kind === "expense" || fundId);
  function save() {
    if (!ok) return;
    const data = { name: name.trim(), amount: n, day: d, category: kind === "fund" ? "저축" : category, fundId: kind === "fund" ? fundId : null };
    if (edit === "new") act.addRecur(data);
    else act.updateRecur(edit!.id, data);
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={edit === "new" ? "고정 지출 추가" : "고정 지출 수정"}>
      <input autoFocus={edit === "new"} value={name} onChange={(e) => setName(e.target.value)} placeholder="이름 (예: 월세, 통신비, 넷플릭스)" className={`${inputCls} mb-2`} />
      <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="금액 (예: 55000, 50만)" className={inputCls} />
      {n > 0 && <p className="mt-1 text-xs text-gray-400">{won(n)}원</p>}

      <p className="mb-2 mt-4 text-xs text-gray-400">매달 며칠</p>
      <div className="flex items-center gap-2">
        <input inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))} className={`${inputCls} !w-20 text-center`} />
        <span className="text-sm text-gray-500">일</span>
        <button type="button" onClick={() => setDay("31")} className={`rounded-full px-3 py-1 text-sm ${d >= 31 ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
          말일
        </button>
      </div>

      <div className="mb-2 mt-4">
        <Seg
          small
          value={kind}
          onChange={setKind}
          options={[
            { v: "expense", label: "지출" },
            { v: "fund", label: "모으기로 이체" },
          ]}
        />
      </div>
      {kind === "expense" ? (
        <Chips<string> value={category} onChange={setCategory} options={EXPENSE_CATS.map((c) => ({ v: c, label: c }))} />
      ) : (
        <Chips<string | null> value={fundId} onChange={setFundId} options={funds.map((f) => ({ v: f.id as string | null, label: f.name }))} />
      )}

      <button onClick={save} disabled={!ok} className={`${btnCls} mt-5 w-full`}>
        저장
      </button>
      {edit !== "new" && (
        <button
          onClick={() => {
            if (window.confirm(`'${edit.name}' 고정 지출을 지울까요? 이미 기록한 지출은 남아요`)) {
              act.archiveRecur(edit.id);
              onClose();
            }
          }}
          className="mt-3 w-full py-2 text-sm text-red-500"
        >
          삭제
        </button>
      )}
    </Sheet>
  );
}
