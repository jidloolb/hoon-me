// 데이터 저장소 — 전부 이 기기(IndexedDB) 안에만 있다. 서버 없음.
// 기기 간 연동은 파일(에어드롭)로: 내보내기 → 상대 기기에서 가져오기 → 레코드 단위 병합.
// 병합 규칙: 같은 id 면 updatedAt 이 더 큰 쪽이 이긴다. 삭제는 deleted 표시(묘비)로 남겨야 병합 때 되살아나지 않는다.
import { useSyncExternalStore } from "react";
import { kst } from "./lib";

type Base = { id: string; updatedAt: number; deleted?: boolean };
export type Todo = Base & { text: string; date: string | null; done: boolean; doneAt: string | null; createdAt: string };
export type Habit = Base & { name: string; unit: string | null; sort: number; archived: boolean };
export type HabitLog = Base & { habitId: string; date: string; value: number | null };
export type Txn = Base & { date: string; kind: "expense" | "income"; amount: number; category: string; memo: string; createdAt: string };
export type Asset = Base & { name: string; type: string; sort: number; archived: boolean };
export type AssetValue = Base & { assetId: string; date: string; value: number };
export type Note = Base & { date: string; kind: "memo" | "diary"; text: string; createdAt: string };

const COLLECTIONS = ["todos", "habits", "habitLogs", "txns", "assets", "assetValues", "notes"] as const;
type Coll = (typeof COLLECTIONS)[number];
type CollMap = {
  todos: Todo;
  habits: Habit;
  habitLogs: HabitLog;
  txns: Txn;
  assets: Asset;
  assetValues: AssetValue;
  notes: Note;
};
export type State = { [K in Coll]: Record<string, CollMap[K]> } & { meta: { lastExportAt: number | null } };

// 시작 습관 — id 를 고정해야 폰·맥에서 각각 생긴 시드가 병합 때 중복되지 않는다.
const SEED_HABITS: Habit[] = [
  { id: "h-sleep", name: "수면", unit: "시간", sort: 0, archived: false, updatedAt: 0 },
  { id: "h-run", name: "러닝", unit: "km", sort: 1, archived: false, updatedAt: 0 },
  { id: "h-read", name: "독서", unit: null, sort: 2, archived: false, updatedAt: 0 },
  { id: "h-diary", name: "일기", unit: null, sort: 3, archived: false, updatedAt: 0 },
];

function empty(): State {
  return {
    todos: {},
    habits: Object.fromEntries(SEED_HABITS.map((h) => [h.id, h])),
    habitLogs: {},
    txns: {},
    assets: {},
    assetValues: {},
    notes: {},
    meta: { lastExportAt: null },
  };
}

// ---------- IndexedDB (상태 전체를 한 덩어리로 저장: 개인 기록 규모면 충분) ----------
const DB_NAME = "hoon-me";
let dbp: Promise<IDBDatabase> | null = null;
function idb(): Promise<IDBDatabase> {
  // 연결은 하나만 열어 재사용
  return (dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}
async function idbGet(key: string): Promise<unknown> {
  const db = await idb();
  return new Promise((res, rej) => {
    const r = db.transaction("kv").objectStore("kv").get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbSet(key: string, val: unknown): Promise<void> {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

// ---------- 전역 상태 ----------
let state: State = empty();
let ready = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function persist() {
  idbSet("state", state).catch((e) => console.error("저장 실패", e));
}

export async function loadStore() {
  const saved = (await idbGet("state")) as State | undefined;
  if (saved) {
    const base = empty();
    state = { ...base, ...saved, meta: { ...base.meta, ...saved.meta } };
    for (const c of COLLECTIONS) state[c] = { ...(base[c] as object), ...(saved[c] as object) } as never;
  }
  ready = true;
  // 브라우저가 저장공간을 임의로 비우지 않게 요청(홈화면 앱은 대부분 자동 허용)
  navigator.storage?.persist?.().catch(() => {});
  emit();
}

function commit(next: State) {
  state = next;
  persist();
  emit();
}

export function useStore(): State | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (ready ? state : null)
  );
}

// 살아있는(삭제 안 된) 레코드 목록
export function live<T extends Base>(rec: Record<string, T>): T[] {
  return Object.values(rec).filter((x) => !x.deleted);
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const nowStr = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);

function put<K extends Coll>(c: K, rec: CollMap[K]) {
  commit({ ...state, [c]: { ...state[c], [rec.id]: { ...rec, updatedAt: Date.now() } } });
}
function patch<K extends Coll>(c: K, id: string, p: Partial<CollMap[K]>) {
  const cur = state[c][id];
  if (cur) put(c, { ...cur, ...p } as CollMap[K]);
}
function remove<K extends Coll>(c: K, id: string) {
  patch(c, id, { deleted: true } as Partial<CollMap[K]>);
}

// ---------- 동작 ----------
export const act = {
  addTodo(text: string, date: string | null) {
    put("todos", { id: uid(), text, date, done: false, doneAt: null, createdAt: nowStr(), updatedAt: 0 });
  },
  toggleTodo(id: string) {
    const t = state.todos[id];
    patch("todos", id, { done: !t.done, doneAt: t.done ? null : nowStr() });
  },
  moveTodo: (id: string, date: string | null) => patch("todos", id, { date }),
  deleteTodo: (id: string) => remove("todos", id),

  setHabit(habitId: string, on: boolean, value: number | null = null, date = kst()) {
    const id = `${habitId}:${date}`;
    if (on) put("habitLogs", { id, habitId, date, value, updatedAt: 0 });
    else if (state.habitLogs[id]) remove("habitLogs", id);
  },
  addHabit(name: string, unit: string | null) {
    const sort = Math.max(0, ...live(state.habits).map((h) => h.sort)) + 1;
    put("habits", { id: uid(), name, unit, sort, archived: false, updatedAt: 0 });
  },
  archiveHabit: (id: string) => patch("habits", id, { archived: true }),

  addTxn(t: { kind: "expense" | "income"; amount: number; category: string; memo: string; date?: string }) {
    put("txns", { id: uid(), date: t.date ?? kst(), kind: t.kind, amount: t.amount, category: t.category, memo: t.memo, createdAt: nowStr(), updatedAt: 0 });
  },
  recatTxn: (id: string, category: string) => patch("txns", id, { category }),
  deleteTxn: (id: string) => remove("txns", id),

  addAsset(name: string, type: string, value: number | null) {
    const id = uid();
    const sort = Math.max(0, ...live(state.assets).map((a) => a.sort)) + 1;
    put("assets", { id, name, type, sort, archived: false, updatedAt: 0 });
    if (value != null) act.setAssetValue(id, value);
  },
  setAssetValue(assetId: string, value: number, date = kst()) {
    put("assetValues", { id: `${assetId}:${date}`, assetId, date, value, updatedAt: 0 });
  },
  archiveAsset: (id: string) => patch("assets", id, { archived: true }),

  addNote(text: string, kind: "memo" | "diary") {
    const date = kst();
    put("notes", { id: uid(), date, kind, text, createdAt: nowStr(), updatedAt: 0 });
    // 일기를 쓰면 '일기' 습관 자동 체크
    if (kind === "diary") {
      const h = live(state.habits).find((x) => x.name === "일기" && !x.archived);
      if (h) act.setHabit(h.id, true, null, date);
    }
  },
  deleteNote: (id: string) => remove("notes", id),
};

// ---------- 내보내기 / 가져오기(병합) ----------
export async function exportFile(): Promise<"shared" | "downloaded"> {
  const data = { app: "hoon-me", version: 1, exportedAt: new Date().toISOString(), state: { ...state, meta: undefined } };
  const name = `나-백업-${kst()}.json`;
  const file = new File([JSON.stringify(data)], name, { type: "application/json" });
  let how: "shared" | "downloaded";
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e; // 공유 시트 닫음 = 취소
      throw e;
    }
    how = "shared";
  } else {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    how = "downloaded";
  }
  commit({ ...state, meta: { ...state.meta, lastExportAt: Date.now() } });
  return how;
}

export async function importFile(f: File): Promise<{ added: number; updated: number }> {
  const data = JSON.parse(await f.text());
  if (data?.app !== "hoon-me" || !data.state) throw new Error("이 앱의 백업 파일이 아니에요");
  const next = { ...state } as State;
  let added = 0;
  let updated = 0;
  for (const c of COLLECTIONS) {
    const mine = { ...(state[c] as Record<string, Base>) };
    const theirs = (data.state[c] ?? {}) as Record<string, Base>;
    for (const [id, rec] of Object.entries(theirs)) {
      const cur = mine[id];
      if (!cur) {
        mine[id] = rec;
        if (!rec.deleted) added++;
      } else if ((rec.updatedAt ?? 0) > (cur.updatedAt ?? 0)) {
        mine[id] = rec;
        updated++;
      }
    }
    (next as Record<string, unknown>)[c] = mine;
  }
  commit(next);
  return { added, updated };
}
