import { useRef, useState } from "react";
import { Today } from "./Today";
import { Calendar } from "./Calendar";
import { Money } from "./Money";
import { Grow } from "./Grow";
import { Insights } from "./Insights";
import { Sheet, inputCls, btnCls } from "./ui";
import { LockScreen, PinSetup, useLock } from "./Lock";
import { act, activeSpaces, exportFile, importFile, live, storageError, useStore, type State } from "./store";
import { kst } from "./lib";

type Tab = "today" | "cal" | "money" | "grow" | "insights";
const TABS: { v: Tab; label: string; icon: string }[] = [
  { v: "today", label: "오늘", icon: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" },
  { v: "cal", label: "달력", icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" },
  { v: "money", label: "돈", icon: "M3 7h18v12H3zM3 11h18M7 15h3" },
  { v: "grow", label: "성장", icon: "M12 20V10M12 10c0-4 3-6 7-6 0 4-3 6-7 6ZM12 13c0-3-2.5-5-6-5 0 3 2.5 5 6 5Z" },
  { v: "insights", label: "분석", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
];

export function App() {
  const s = useStore();
  if (!s) return null;
  return <Main s={s} />;
}

function Main({ s }: { s: State }) {
  const { locked, unlock } = useLock(!!s.meta.pin);
  const [tab, setTab] = useState<Tab>("today");
  const [date, setDate] = useState(kst());
  const [settings, setSettings] = useState(false);

  function go(t: Tab) {
    setTab(t);
    window.scrollTo(0, 0);
  }
  if (locked) return <LockScreen onUnlock={unlock} />;

  // 백업 안 한 지 7일 넘으면 알림(기록이 이 기기에만 있으니까)
  const hasData = live(s.blocks).length + live(s.txns).length + live(s.notes).length + live(s.habitLogs).length > 0;
  const since = s.meta.lastExportAt ? Math.floor((Date.now() - s.meta.lastExportAt) / 86400000) : null;
  const nudge = hasData && (since === null || since >= 7);

  return (
    <div className="mx-auto min-h-[100dvh] max-w-lg">
      <header className="pt-safe sticky top-0 z-20 bg-bg/90 px-4 backdrop-blur">
        <div className="flex items-center justify-between py-3">
          <h1 className="text-xl font-bold">{TABS.find((x) => x.v === tab)!.label}</h1>
          <button onClick={() => setSettings(true)} aria-label="설정" className="relative rounded-full p-1.5 text-gray-500 active:bg-gray-200">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6" />
            </svg>
            {nudge && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500" />}
          </button>
        </div>
      </header>

      <main className="px-4 pb-28">
        {storageError && <p className="mb-3 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-500">{storageError}</p>}
        {nudge && tab === "today" && (
          <button onClick={() => setSettings(true)} className="mb-3 w-full rounded-2xl bg-amber-50 px-4 py-3 text-left text-sm text-amber-800">
            {since === null ? "아직 백업한 적이 없어요." : `백업한 지 ${since}일 지났어요.`} 기록은 이 폰에만 있어요 — 탭해서 맥으로 보내기
          </button>
        )}
        {tab === "today" && <Today s={s} date={date} setDate={setDate} />}
        {tab === "cal" && (
          <Calendar
            s={s}
            date={date}
            onPick={(d) => {
              setDate(d);
              go("today");
            }}
          />
        )}
        {tab === "money" && <Money s={s} />}
        {tab === "grow" && <Grow s={s} />}
        {tab === "insights" && <Insights s={s} />}
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg">
          {TABS.map((x) => (
            <button key={x.v} onClick={() => go(x.v)} className={`flex flex-1 flex-col items-center gap-0.5 pt-2 text-[11px] ${tab === x.v ? "text-blue-600" : "text-gray-400"}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={x.icon} />
              </svg>
              {x.label}
            </button>
          ))}
        </div>
      </nav>

      <Settings s={s} open={settings} onClose={() => setSettings(false)} />
    </div>
  );
}

// ---------- 설정: 연동·백업 / 잠금 / Space / 습관 ----------
function Settings({ s, open, onClose }: { s: State; open: boolean; onClose: () => void }) {
  const [page, setPage] = useState<"menu" | "sync" | "pin" | "spaces" | "habits">("menu");
  const close = () => {
    setPage("menu");
    onClose();
  };
  const titles = { menu: "설정", sync: "맥과 연동 · 백업", pin: "PIN 잠금", spaces: "Space", habits: "습관" };
  return (
    <Sheet open={open} onClose={close} title={titles[page]}>
      {page === "menu" && (
        <ul className="divide-y divide-gray-100">
          {(
            [
              ["sync", "맥과 연동 · 백업", "에어드롭으로 주고받기"],
              ["pin", "PIN 잠금", s.meta.pin ? "켜짐" : "꺼짐"],
              ["spaces", "Space", `${activeSpaces(s).length}개`],
              ["habits", "습관", `${live(s.habits).filter((h) => !h.archived).length}개`],
            ] as const
          ).map(([k, label, sub]) => (
            <li key={k}>
              <button onClick={() => setPage(k)} className="flex w-full items-center justify-between py-3.5 text-left">
                <span>{label}</span>
                <span className="text-sm text-gray-400">{sub} ›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {page === "sync" && <Sync s={s} />}
      {page === "pin" && <PinSetup hasPin={!!s.meta.pin} onFinish={() => setPage("menu")} />}
      {page === "spaces" && <SpacesEdit s={s} />}
      {page === "habits" && <HabitsEdit s={s} />}
      {page !== "menu" && (
        <button onClick={() => setPage("menu")} className="mt-5 w-full py-2 text-sm text-gray-400">
          ‹ 설정으로
        </button>
      )}
    </Sheet>
  );
}

// 연동 = 파일 주고받기. 폰 [내보내기] → 에어드롭 → 맥 [가져오기] (반대도 같음). 합칠 때 더 최근에 고친 쪽이 이긴다.
function Sync({ s }: { s: State }) {
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const last = s.meta.lastExportAt ? new Date(s.meta.lastExportAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "없음";
  return (
    <div>
      <p className="mb-4 text-sm leading-relaxed text-gray-500">
        기록은 이 기기 안에만 있어요. 옮기거나 백업하려면 파일로 보내요.
        <br />
        <span className="text-xs text-gray-400">
          블록 {live(s.blocks).length} · 돈 {live(s.txns).length} · 기록 {live(s.notes).length} · 마지막 내보내기 {last}
        </span>
      </p>
      <button
        onClick={async () => {
          try {
            setMsg((await exportFile()) === "shared" ? "보냈어요" : "다운로드 폴더에 저장했어요");
          } catch (e) {
            if ((e as Error).name !== "AbortError") setMsg(`실패: ${(e as Error).message}`);
          }
        }}
        className={`${btnCls} mb-2 w-full !py-3`}
      >
        내보내기 (에어드롭)
      </button>
      <button onClick={() => fileRef.current?.click()} className="w-full rounded-xl bg-gray-100 py-3 font-semibold text-gray-800">
        가져오기 (받은 파일 합치기)
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const r = await importFile(f);
            setMsg(`합쳤어요 — 새로 ${r.added}개, 갱신 ${r.updated}개`);
          } catch (err) {
            setMsg(`실패: ${(err as Error).message}`);
          }
          e.target.value = "";
        }}
      />
      {msg && <p className="mt-3 text-center text-sm font-medium text-blue-600">{msg}</p>}
      <ol className="mt-5 space-y-1 text-xs leading-relaxed text-gray-400">
        <li>1. 폰: 내보내기 → 공유 시트에서 에어드롭 → 맥</li>
        <li>2. 맥: 이 앱을 열고 가져오기 → 다운로드 폴더의 「나-백업-날짜.json」</li>
        <li>맥에서 고친 걸 폰에 반영할 땐 반대로. 합칠 때 더 최근에 고친 쪽이 남아요.</li>
      </ol>
    </div>
  );
}

function SpacesEdit({ s }: { s: State }) {
  const [name, setName] = useState("");
  return (
    <div>
      <ul className="mb-4 divide-y divide-gray-100">
        {activeSpaces(s).map((sp) => (
          <li key={sp.id} className="flex items-center gap-3 py-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: sp.color }} />
            <input defaultValue={sp.name} onBlur={(e) => e.target.value.trim() && e.target.value !== sp.name && act.renameSpace(sp.id, e.target.value.trim())} className="min-w-0 flex-1 bg-transparent py-1 outline-none" />
            <button onClick={() => window.confirm(`'${sp.name}' 숨길까요? 기록은 남아요`) && act.archiveSpace(sp.id)} className="text-xs text-red-500">
              숨기기
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="새 Space (예: 명상, 부업)" className={inputCls} />
        <button onClick={() => name.trim() && (act.addSpace(name.trim()), setName(""))} className={btnCls}>
          추가
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-400">이름을 눌러 바로 고칠 수 있어요. 색은 순서대로 자동.</p>
    </div>
  );
}

function HabitsEdit({ s }: { s: State }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const habits = live(s.habits)
    .filter((h) => !h.archived)
    .sort((a, b) => a.sort - b.sort);
  return (
    <div>
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
        <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="단위" className={`${inputCls} !w-20`} />
        <button
          onClick={() => {
            if (!name.trim()) return;
            act.addHabit(name.trim(), unit.trim() || null);
            setName("");
            setUnit("");
          }}
          className={btnCls}
        >
          추가
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-400">단위를 넣으면 체크할 때 값도 적어요 (예: 수면 7.5시간)</p>
    </div>
  );
}
