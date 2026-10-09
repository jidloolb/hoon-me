import { useState } from "react";
import { Card, Seg, Sheet, inputCls, btnCls } from "./ui";
import { act, live, type State, type Txn, type Asset } from "./store";
import { kst, won, wonShort, dateLabel, ASSET_TYPES, EXPENSE_CATS, INCOME_CATS } from "./lib";

function shiftMonth(m: string, d: number) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1 + d, 1)).toISOString().slice(0, 7);
}

type AssetRow = Asset & { value: number | null; date: string | null; prev: number | null };

export function Money({ s }: { s: State }) {
  const [view, setView] = useState<"book" | "assets">("book");
  const [month, setMonth] = useState(kst().slice(0, 7));
  const [assetFor, setAssetFor] = useState<AssetRow | null>(null);
  const [addAsset, setAddAsset] = useState(false);
  const [txnFor, setTxnFor] = useState<Txn | null>(null);

  // ----- 가계부 -----
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
  const byDay = new Map<string, Txn[]>();
  for (const x of txns) byDay.set(x.date, [...(byDay.get(x.date) ?? []), x]);

  // ----- 자산: 평가액 스냅샷의 최신값·직전값 -----
  const values = live(s.assetValues);
  const assets: AssetRow[] = live(s.assets)
    .filter((a) => !a.archived)
    .sort((a, b) => a.sort - b.sort)
    .map((a) => {
      const vs = values.filter((v) => v.assetId === a.id).sort((x, y) => y.date.localeCompare(x.date));
      return { ...a, value: vs[0]?.value ?? null, date: vs[0]?.date ?? null, prev: vs[1]?.value ?? null };
    });
  const net = assets.reduce((a, x) => a + (x.value ?? 0), 0);
  const netPrev = assets.reduce((a, x) => a + (x.prev ?? x.value ?? 0), 0);
  // 순자산 추이: 각 월말 시점의 자산별 최신값 합
  const months = [...new Set(values.map((v) => v.date.slice(0, 7)))].sort().slice(-12);
  const trend = months.map((m) => ({
    month: m,
    total: assets.reduce((sum, a) => {
      const v = values.filter((x) => x.assetId === a.id && x.date.slice(0, 7) <= m).sort((x, y) => y.date.localeCompare(x.date))[0];
      return sum + (v?.value ?? 0);
    }, 0),
  }));
  const trendMax = Math.max(1, ...trend.map((p) => p.total));

  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <Seg
          value={view}
          onChange={setView}
          options={[
            { v: "book", label: "가계부" },
            { v: "assets", label: "자산" },
          ]}
        />
      </div>

      {view === "book" ? (
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
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-gray-400">지출</p>
                <p className="mt-0.5 font-semibold">{won(expTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">수입</p>
                <p className="mt-0.5 font-semibold text-blue-600">{won(incTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">남음</p>
                <p className={`mt-0.5 font-semibold ${incTotal - expTotal < 0 ? "text-red-500" : ""}`}>{won(incTotal - expTotal)}</p>
              </div>
            </div>
          </Card>

          {exp.length > 0 && (
            <Card title="어디에 썼나">
              <ul className="space-y-2.5">
                {exp.map(([name, c]) => (
                  <li key={name}>
                    <div className="flex justify-between text-sm">
                      <span>
                        {name} <span className="text-xs text-gray-400">{c.n}건</span>
                      </span>
                      <span className="tabular-nums">{won(c.total)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-gray-100">
                      <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${(c.total / exp[0][1].total) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="내역">
            {txns.length === 0 && <p className="text-sm text-gray-400">이 달 기록이 없어요. 오늘 탭 입력창에서 [돈]으로 적어요.</p>}
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
        </>
      ) : (
        <>
          <Card>
            <p className="text-xs text-gray-400">순자산</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{won(net)}원</p>
            {netPrev !== net && (
              <p className={`mt-0.5 text-sm ${net - netPrev >= 0 ? "text-blue-600" : "text-red-500"}`}>
                지난 기록 대비 {net - netPrev >= 0 ? "+" : ""}
                {wonShort(net - netPrev)}
              </p>
            )}
            {trend.length > 1 && (
              <div className="mt-4 flex h-20 items-end gap-1.5">
                {trend.map((p) => (
                  <div key={p.month} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t-md bg-blue-500/80" style={{ height: `${(p.total / trendMax) * 64}px` }} />
                    <span className="text-[10px] text-gray-400">{Number(p.month.slice(5))}월</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            title="자산"
            right={
              <button onClick={() => setAddAsset(true)} className="text-sm font-medium text-blue-600">
                + 추가
              </button>
            }
          >
            {assets.length === 0 && <p className="text-sm text-gray-400">주식·적금·예금 계좌를 추가하고, 가끔 평가액만 적으면 추이가 쌓여요.</p>}
            {assets.map((a) => (
              <button key={a.id} onClick={() => setAssetFor(a)} className="flex w-full items-center justify-between py-2.5 text-left">
                <span>
                  <span className="mr-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">{a.type}</span>
                  {a.name}
                </span>
                <span className="text-right">
                  <span className="block tabular-nums">{a.value != null ? won(a.value) : "—"}</span>
                  <span className="block text-[11px] text-gray-400">
                    {a.prev != null && a.value != null && a.value !== a.prev && (
                      <span className={a.value > a.prev ? "text-blue-600" : "text-red-500"}>
                        {a.value > a.prev ? "▲" : "▼"}
                        {wonShort(Math.abs(a.value - a.prev))}{" "}
                      </span>
                    )}
                    {a.date ? dateLabel(a.date) : ""}
                  </span>
                </span>
              </button>
            ))}
          </Card>
        </>
      )}

      <AssetValueSheet s={s} asset={assetFor} onClose={() => setAssetFor(null)} />
      <AddAssetSheet open={addAsset} onClose={() => setAddAsset(false)} />
      <TxnSheet txn={txnFor} onClose={() => setTxnFor(null)} />
    </div>
  );
}

const num = (v: string) => Number(v.replace(/[,\s원]/g, ""));

function AssetValueSheet({ s, asset, onClose }: { s: State; asset: AssetRow | null; onClose: () => void }) {
  const [v, setV] = useState("");
  if (!asset) return null;
  const hist = live(s.assetValues)
    .filter((x) => x.assetId === asset.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  function save() {
    const n = num(v);
    if (!v || !Number.isFinite(n)) return;
    act.setAssetValue(asset!.id, n);
    setV("");
    onClose();
  }
  return (
    <Sheet open onClose={onClose} title={`${asset.name} 지금 평가액`}>
      <div className="flex gap-2">
        <input autoFocus inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} placeholder={asset.value != null ? won(asset.value) : "금액"} className={inputCls} />
        <button onClick={save} className={btnCls}>
          저장
        </button>
      </div>
      {v && num(v) > 0 && <p className="mt-1 text-xs text-gray-400">{won(num(v))}원</p>}
      {hist.length > 0 && (
        <ul className="mt-4 max-h-48 overflow-y-auto text-sm">
          {hist.map((h) => (
            <li key={h.id} className="flex justify-between py-1 text-gray-500">
              <span>{h.date}</span>
              <span className="tabular-nums">{won(h.value)}</span>
            </li>
          ))}
        </ul>
      )}
      <button
        onClick={() => {
          act.archiveAsset(asset.id);
          onClose();
        }}
        className="mt-4 w-full py-2 text-sm text-red-500"
      >
        이 자산 숨기기
      </button>
    </Sheet>
  );
}

function AddAssetSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("주식");
  const [v, setV] = useState("");
  function save() {
    if (!name.trim()) return;
    act.addAsset(name.trim(), type, v && Number.isFinite(num(v)) ? num(v) : null);
    setName("");
    setV("");
    onClose();
  }
  return (
    <Sheet open={open} onClose={onClose} title="자산 추가">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {ASSET_TYPES.map((t) => (
          <button key={t} onClick={() => setType(t)} className={`rounded-full px-3 py-1 text-sm ${type === t ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
            {t}
          </button>
        ))}
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름 (예: 토스증권, 청년적금)" className={`${inputCls} mb-2`} />
      <input inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} placeholder="지금 평가액 (선택)" className={`${inputCls} mb-3`} />
      <button onClick={save} className={`${btnCls} w-full`}>
        추가
      </button>
    </Sheet>
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
          <button
            key={c}
            onClick={() => {
              act.recatTxn(txn.id, c);
              onClose();
            }}
            className={`rounded-full px-3 py-1 text-sm ${txn.category === c ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            {c}
          </button>
        ))}
      </div>
      <button
        onClick={() => {
          act.deleteTxn(txn.id);
          onClose();
        }}
        className="mt-5 w-full py-2 text-sm text-red-500"
      >
        삭제
      </button>
    </Sheet>
  );
}
