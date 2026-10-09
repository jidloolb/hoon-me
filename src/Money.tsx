import { useState } from "react";
import { BarRow, Card, Seg, Sheet, inputCls, btnCls } from "./ui";
import { RecurCard } from "./Recurs";
import { act, fundSummary, live, type Fund, type FundEntry, type State, type Txn } from "./store";
import { dateLabel, kst, parseAmount, won, wonShort, EXPENSE_CATS, INCOME_CATS } from "./lib";

function shiftMonth(m: string, d: number) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1 + d, 1)).toISOString().slice(0, 7);
}

export function Money({ s }: { s: State }) {
  const [view, setView] = useState<"book" | "funds">("book");
  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <Seg
          value={view}
          onChange={setView}
          options={[
            { v: "book", label: "가계부" },
            { v: "funds", label: "모으기" },
          ]}
        />
      </div>
      {view === "book" ? <Book s={s} /> : <Funds s={s} />}
    </div>
  );
}

// ---------- 가계부 ----------
function Book({ s }: { s: State }) {
  const [month, setMonth] = useState(kst().slice(0, 7));
  const [txnFor, setTxnFor] = useState<Txn | null>(null);
  const txns = live(s.txns)
    .filter((x) => x.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const cat = new Map<string, { total: number; n: number }>();
  for (const x of txns.filter((x) => x.kind === "expense")) {
    const c = cat.get(x.category) ?? { total: 0, n: 0 };
    cat.set(x.category, { total: c.total + x.amount, n: c.n + 1 });
  }
  const exp = [...cat.entries()].sort((a, b) => b[1].total - a[1].total);
  const expTotal = exp.reduce((a, [, c]) => a + c.total, 0);
  const incTotal = txns.filter((x) => x.kind === "income").reduce((a, x) => a + x.amount, 0);
  // 이번 달 모으기에 넣은 돈(저축)
  const saved = live(s.fundEntries)
    .filter((e) => e.date.startsWith(month))
    .reduce((a, e) => a + (e.kind === "deposit" ? e.amount : e.kind === "withdraw" ? -e.amount : 0), 0);
  const byDay = new Map<string, Txn[]>();
  for (const x of txns) byDay.set(x.date, [...(byDay.get(x.date) ?? []), x]);

  return (
    <>
      <div className="flex items-center justify-between px-1">
        <button onClick={() => setMonth(shiftMonth(month, -1))} className="px-3 py-1 text-lg text-gray-400">
          ‹
        </button>
        <span className="font-semibold">
          {month.slice(0, 4)}년 {Number(month.slice(5))}월
        </span>
        <button onClick={() => setMonth(shiftMonth(month, 1))} className="px-3 py-1 text-lg text-gray-400">
          ›
        </button>
      </div>
      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="지출" value={won(expTotal)} />
          <Stat label="수입" value={won(incTotal)} tone="blue" />
          <Stat label="모으기에 넣음" value={won(saved)} />
          <Stat label="저축률" value={incTotal ? `${Math.round((saved / incTotal) * 100)}%` : "—"} />
        </div>
      </Card>
      <RecurCard s={s} month={month} />
      {exp.length > 0 && (
        <Card title="어디에 썼나">
          <ul className="space-y-2.5">
            {exp.map(([name, c]) => (
              <BarRow key={name} label={`${name} · ${c.n}건`} value={c.total} max={exp[0][1].total} text={won(c.total)} />
            ))}
          </ul>
        </Card>
      )}
      <Card title="내역">
        {txns.length === 0 && <p className="text-sm text-gray-400">이 달 기록이 없어요. 오늘 탭 입력창 [돈]으로 적어요.</p>}
        {[...byDay.entries()].map(([day, xs]) => (
          <div key={day} className="mb-3 last:mb-0">
            <p className="mb-1 text-xs text-gray-400">{dateLabel(day)}</p>
            {xs.map((x) => (
              <button key={x.id} onClick={() => setTxnFor(x)} className="flex w-full items-center justify-between py-1.5 text-left">
                <span className="text-[15px]">
                  {x.memo || x.category} <span className="text-xs text-gray-400">{x.memo ? x.category : ""}</span>
                </span>
                <span className={`tabular-nums ${x.kind === "income" ? "text-blue-600" : ""}`}>
                  {x.kind === "income" ? "+" : "−"}
                  {won(x.amount)}
                </span>
              </button>
            ))}
          </div>
        ))}
      </Card>
      <TxnSheet txn={txnFor} onClose={() => setTxnFor(null)} />
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "blue" }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`mt-0.5 font-semibold tabular-nums ${tone === "blue" ? "text-blue-600" : ""}`}>{value}</p>
    </div>
  );
}

function TxnSheet({ txn, onClose }: { txn: Txn | null; onClose: () => void }) {
  if (!txn) return null;
  const cats = txn.kind === "income" ? INCOME_CATS : EXPENSE_CATS;
  return (
    <Sheet open onClose={onClose} title={`${txn.memo || txn.category} ${won(txn.amount)}원`}>
      <p className="mb-2 text-xs text-gray-400">카테고리 바꾸기</p>
      <div className="flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button key={c} onClick={() => (act.recatTxn(txn.id, c), onClose())} className={`rounded-full px-3 py-1 text-sm ${txn.category === c ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
            {c}
          </button>
        ))}
      </div>
      <button onClick={() => (act.deleteTxn(txn.id), onClose())} className="mt-5 w-full py-2 text-sm text-red-500">
        삭제
      </button>
    </Sheet>
  );
}

// ---------- 모으기(저금·CMA·ISA·청약…) — 넣은 돈(원금)과 평가액을 따로 쌓는다 ----------
function Funds({ s }: { s: State }) {
  const [open, setOpen] = useState<Fund | null>(null);
  const [adding, setAdding] = useState(false);
  const funds = live(s.funds)
    .filter((f) => !f.archived)
    .sort((a, b) => a.sort - b.sort)
    .map((f) => ({ f, ...fundSummary(s, f.id) }));
  const total = funds.reduce((a, x) => a + x.value, 0);
  const principal = funds.reduce((a, x) => a + x.principal, 0);
  const gain = total - principal;

  return (
    <>
      <Card>
        <p className="text-xs text-gray-400">모은 돈 (평가액)</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{won(total)}원</p>
        <p className="mt-1 text-sm text-gray-500">
          넣은 돈 {wonShort(principal)}
          {gain !== 0 && (
            <span className={gain > 0 ? "text-blue-600" : "text-red-500"}>
              {" "}
              · {gain > 0 ? "+" : ""}
              {wonShort(gain)} ({principal ? `${((gain / principal) * 100).toFixed(1)}%` : "—"})
            </span>
          )}
        </p>
      </Card>
      <Card
        title="통장·계좌"
        right={
          <button onClick={() => setAdding(true)} className="text-sm font-medium text-blue-600">
            + 추가
          </button>
        }
      >
        {funds.map(({ f, value, principal: p, gain: g }) => (
          <button key={f.id} onClick={() => setOpen(f)} className="flex w-full items-center justify-between border-b border-gray-50 py-3 text-left last:border-0">
            <span>
              <span className="block font-medium">{f.name}</span>
              {f.note && <span className="block text-xs text-gray-400">{f.note}</span>}
            </span>
            <span className="text-right">
              <span className="block tabular-nums">{won(value)}</span>
              <span className="block text-[11px] text-gray-400">
                원금 {wonShort(p)}
                {g !== 0 && <span className={g > 0 ? "text-blue-600" : "text-red-500"}> {p ? `${g > 0 ? "+" : ""}${((g / p) * 100).toFixed(1)}%` : ""}</span>}
              </span>
            </span>
          </button>
        ))}
        <p className="mt-2 text-xs leading-relaxed text-gray-400">넣을 때마다 [넣기], 가끔 증권 앱 보고 [평가액]만 적으면 수익률이 계산돼요.</p>
      </Card>
      <FundSheet s={s} fund={open} onClose={() => setOpen(null)} />
      <AddFundSheet open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function FundSheet({ s, fund, onClose }: { s: State; fund: Fund | null; onClose: () => void }) {
  const [kind, setKind] = useState<FundEntry["kind"]>("deposit");
  const [v, setV] = useState("");
  if (!fund) return null;
  const sum = fundSummary(s, fund.id);
  const n = parseAmount(v);
  const label = { deposit: "넣기", withdraw: "빼기", value: "평가액" } as const;
  function save() {
    if (!Number.isFinite(n) || n <= 0) return;
    act.addFundEntry(fund!.id, kind, n);
    setV("");
  }
  return (
    <Sheet open onClose={onClose} title={fund.name}>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-gray-50 py-2">
          <p className="text-xs text-gray-400">평가액</p>
          <p className="text-sm font-semibold tabular-nums">{wonShort(sum.value)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 py-2">
          <p className="text-xs text-gray-400">넣은 돈</p>
          <p className="text-sm font-semibold tabular-nums">{wonShort(sum.principal)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 py-2">
          <p className="text-xs text-gray-400">수익</p>
          <p className={`text-sm font-semibold tabular-nums ${sum.gain > 0 ? "text-blue-600" : sum.gain < 0 ? "text-red-500" : ""}`}>{wonShort(sum.gain)}</p>
        </div>
      </div>
      <Seg<FundEntry["kind"]>
        value={kind}
        onChange={setKind}
        options={[
          { v: "deposit", label: "넣기" },
          { v: "withdraw", label: "빼기" },
          { v: "value", label: "평가액" },
        ]}
      />
      <div className="mt-2 flex gap-2">
        <input autoFocus inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} placeholder={kind === "value" ? "지금 평가액 (예: 523만)" : "금액 (예: 50만)"} className={inputCls} onKeyDown={(e) => e.key === "Enter" && save()} />
        <button onClick={save} disabled={!(n > 0)} className={btnCls}>
          {label[kind]}
        </button>
      </div>
      {n > 0 && <p className="mt-1 text-xs text-gray-400">{won(n)}원</p>}
      {sum.valuedAt && <p className="mt-2 text-xs text-gray-400">마지막 평가 {dateLabel(sum.valuedAt)}</p>}
      {sum.entries.length > 0 && (
        <ul className="mt-4 max-h-56 overflow-y-auto text-sm">
          {[...sum.entries].reverse().map((e) => (
            <li key={e.id} className="flex items-center justify-between py-1.5">
              <span className="text-gray-500">
                {e.date} · {label[e.kind]}
              </span>
              <span className="flex items-center gap-2">
                <span className={`tabular-nums ${e.kind === "withdraw" ? "text-red-500" : e.kind === "value" ? "text-gray-500" : ""}`}>
                  {e.kind === "withdraw" ? "−" : e.kind === "deposit" ? "+" : ""}
                  {won(e.amount)}
                </span>
                <button onClick={() => act.deleteFundEntry(e.id)} className="px-1 text-xs text-gray-300">
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <button onClick={() => (act.archiveFund(fund.id), onClose())} className="mt-4 w-full py-2 text-sm text-red-500">
        이 계좌 숨기기
      </button>
    </Sheet>
  );
}

function AddFundSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title="통장·계좌 추가">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름 (예: 비상금, 연금저축)" className={`${inputCls} mb-2`} />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="메모 (선택)" className={`${inputCls} mb-3`} />
      <button
        onClick={() => {
          if (!name.trim()) return;
          act.addFund(name.trim(), note.trim());
          setName("");
          setNote("");
          onClose();
        }}
        className={`${btnCls} w-full`}
      >
        추가
      </button>
    </Sheet>
  );
}
