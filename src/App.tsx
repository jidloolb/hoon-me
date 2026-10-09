import { useRef, useState } from "react";
import { Today } from "./Today";
import { Todos } from "./Todos";
import { Money } from "./Money";
import { Notes } from "./Notes";
import { Sheet } from "./ui";
import { useStore, exportFile, importFile, live } from "./store";
import { kst, weekday } from "./lib";

type Tab = "today" | "todos" | "money" | "notes";
const TABS: { v: Tab; label: string; icon: string }[] = [
  { v: "today", label: "오늘", icon: "M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3 5 5M19 19l-1.3-1.3M6.3 17.7 5 19M19 5l-1.3 1.3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" },
  { v: "todos", label: "할일", icon: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" },
  { v: "money", label: "돈", icon: "M3 7h18v12H3zM3 11h18M7 15h3" },
  { v: "notes", label: "기록", icon: "M5 4h10l4 4v12H5zM9 12h6M9 16h4" },
];

export function App() {
  const s = useStore();
  const [tab, setTab] = useState<Tab>(() => {
    try {
      return (sessionStorage.getItem("tab") as Tab) || "today";
    } catch {
      return "today";
    }
  });
  const [sync, setSync] = useState(false);

  function go(t: Tab) {
    setTab(t);
    try {
      sessionStorage.setItem("tab", t);
    } catch {}
    window.scrollTo(0, 0);
  }

  if (!s) return null;
  const t = kst();

  return (
    <div className="mx-auto min-h-[100dvh] max-w-lg">
      <header className="pt-safe sticky top-0 z-10 bg-[#f6f7f9]/90 px-4 backdrop-blur">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-bold">{TABS.find((x) => x.v === tab)!.label}</h1>
            <span className="text-sm text-gray-400">
              {Number(t.slice(5, 7))}월 {Number(t.slice(8))}일 {weekday(t)}요일
            </span>
          </div>
          <button onClick={() => setSync(true)} aria-label="맥과 연동" className="rounded-full p-1.5 text-gray-400 active:bg-gray-200">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4" />
            </svg>
          </button>
        </div>
      </header>

      <main className="px-4 pb-28">
        {tab === "today" && <Today s={s} goMoney={() => go("money")} goSync={() => setSync(true)} />}
        {tab === "todos" && <Todos s={s} />}
        {tab === "money" && <Money s={s} />}
        {tab === "notes" && <Notes s={s} />}
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur">
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

      <SyncSheet open={sync} onClose={() => setSync(false)} />
    </div>
  );
}

// 연동 = 파일 주고받기. 폰 [내보내기] → 에어드롭 → 맥 [가져오기] (반대도 같음). 합칠 때 더 최근에 고친 쪽이 이긴다.
function SyncSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  if (!s) return null;
  const last = s.meta.lastExportAt ? new Date(s.meta.lastExportAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "없음";
  const counts = `할일 ${live(s.todos).length} · 지출/수입 ${live(s.txns).length} · 기록 ${live(s.notes).length}`;

  async function doExport() {
    try {
      const how = await exportFile();
      setMsg(how === "shared" ? "보냈어요" : "파일을 다운로드 폴더에 저장했어요");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMsg(`실패: ${(e as Error).message}`);
    }
  }
  async function doImport(f: File | undefined) {
    if (!f) return;
    try {
      const r = await importFile(f);
      setMsg(`합쳤어요 — 새로 ${r.added}개, 갱신 ${r.updated}개`);
    } catch (e) {
      setMsg(`실패: ${(e as Error).message}`);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <Sheet open={open} onClose={onClose} title="맥과 연동 · 백업">
      <p className="mb-4 text-sm leading-relaxed text-gray-500">
        기록은 이 기기 안에만 있어요. 다른 기기로 옮기거나 백업하려면 파일로 보내요.
        <br />
        <span className="text-xs text-gray-400">
          {counts} · 마지막 내보내기 {last}
        </span>
      </p>
      <button onClick={doExport} className="mb-2 w-full rounded-xl bg-blue-600 py-3 font-semibold text-white">
        내보내기 (에어드롭)
      </button>
      <button onClick={() => fileRef.current?.click()} className="w-full rounded-xl bg-gray-100 py-3 font-semibold text-gray-800">
        가져오기 (받은 파일 합치기)
      </button>
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => doImport(e.target.files?.[0])} />
      {msg && <p className="mt-3 text-center text-sm font-medium text-blue-600">{msg}</p>}
      <ol className="mt-5 space-y-1 text-xs leading-relaxed text-gray-400">
        <li>1. 폰: 내보내기 → 공유 시트에서 에어드롭 → 맥 선택</li>
        <li>2. 맥: 이 앱을 열고 가져오기 → 다운로드 폴더의 「나-백업-날짜.json」</li>
        <li>맥에서 고친 걸 폰에 반영할 땐 반대로 하면 돼요. 합칠 때 더 최근에 고친 쪽이 남아요.</li>
      </ol>
    </Sheet>
  );
}
