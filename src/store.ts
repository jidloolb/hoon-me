// 데이터 저장소 — 전부 이 기기(IndexedDB) 안에만 있다. 서버 없음.
// 기기 간 연동은 파일(에어드롭)로: 내보내기 → 상대 기기에서 가져오기 → 레코드 단위 병합.
// 병합 규칙: 같은 id 면 updatedAt 이 더 큰 쪽이 이긴다. 삭제는 deleted 표시(묘비)로 남겨야 병합 때 되살아나지 않는다.
import { useSyncExternalStore } from "react";
import { kst, SPACE_COLORS } from "./lib";

type Base = { id: string; updatedAt: number; deleted?: boolean };
export type Space = Base & { name: string; color: string; sort: number; archived: boolean };
export type Task = Base & { text: string; spaceId: string | null; estMin: number | null; done: boolean; doneAt: string | null; createdAt: string };
export type BlockStatus = "planned" | "done" | "skipped";
export type Block = Base & {
  date: string;
  start: number; // 분 단위(0~1440)
  end: number;
  title: string;
  spaceId: string | null;
  taskId: string | null;
  status: BlockStatus;
  actualMin: number | null; // 실제로 한 시간(없으면 계획 시간으로 본다)
  note: string;
};
export type Habit = Base & { name: string; unit: string | null; sort: number; archived: boolean };
export type HabitLog = Base & { habitId: string; date: string; value: number | null };
export type Txn = Base & { date: string; kind: "expense" | "income"; amount: number; category: string; memo: string; createdAt: string };
export type Fund = Base & { name: string; note: string; sort: number; archived: boolean };
export type FundEntry = Base & { fundId: string; date: string; kind: "deposit" | "withdraw" | "value"; amount: number; createdAt: string };
export type Metric = Base & { key: "weight" | "condition"; date: string; value: number };
export type Learn = Base & { date: string; text: string; createdAt: string };
export type Book = Base & { title: string; kind: "책" | "강의"; unit: string; total: number | null; status: "진행" | "완료" | "보류"; createdAt: string; finishedAt: string | null };
export type BookLog = Base & { bookId: string; date: string; amount: number };
export type Note = Base & { date: string; kind: "memo" | "diary"; text: string; createdAt: string };
// 고정 지출(매달 같은 날 나가는 돈). fundId 가 있으면 지출이 아니라 그 계좌로 이체(모으기 넣기)
export type Recur = Base & { name: string; amount: number; day: number; category: string; fundId: string | null; sort: number; archived: boolean };
export type Day = Base & { date: string; reflection: string; photo: string | null; condition: number | null; closedAt: string };

const COLLECTIONS = ["spaces", "tasks", "blocks", "habits", "habitLogs", "txns", "funds", "fundEntries", "metrics", "learns", "books", "bookLogs", "notes", "days", "recurs"] as const;
type Coll = (typeof COLLECTIONS)[number];
type CollMap = {
  spaces: Space;
  tasks: Task;
  blocks: Block;
  habits: Habit;
  habitLogs: HabitLog;
  txns: Txn;
  funds: Fund;
  fundEntries: FundEntry;
  metrics: Metric;
  learns: Learn;
  books: Book;
  bookLogs: BookLog;
  notes: Note;
  days: Day;
  recurs: Recur;
};
// meta 는 이 기기 전용(내보내기에 안 들어감): PIN·마지막 백업 시각
export type Meta = { lastExportAt: number | null; pin: { salt: string; hash: string } | null };
export type State = { [K in Coll]: Record<string, CollMap[K]> } & { meta: Meta };

// 시드 — id 를 고정해야 폰·맥에서 각각 생긴 시드가 병합 때 중복되지 않는다.
const seed = <T,>(xs: T[]) => Object.fromEntries((xs as (T & { id: string })[]).map((x) => [x.id, x]));
const SEED_SPACES: Space[] = [
  ["s-work", "일"],
  ["s-learn", "학습"],
  ["s-health", "건강"],
  ["s-money", "금융"],
  ["s-life", "생활"],
  ["s-rest", "휴식"],
].map(([id, name], i) => ({ id, name, color: SPACE_COLORS[i], sort: i, archived: false, updatedAt: 0 }));
const SEED_HABITS: Habit[] = (
  [
    ["h-sleep", "수면", "시간"],
    ["h-run", "러닝", "km"],
    ["h-read", "독서", "쪽"],
    ["h-meditate", "명상", "분"],
    ["h-diary", "일기", null],
  ] as [string, string, string | null][]
).map(([id, name, unit], i) => ({ id, name, unit, sort: i, archived: false, updatedAt: 0 }));
const SEED_FUNDS: Fund[] = [
  ["f-save", "저금", "그냥 모으는 돈"],
  ["f-cma", "CMA", "통장"],
  ["f-isa", "ISA ETF", "S&P500 · 나스닥100"],
  ["f-house", "주택청약", ""],
].map(([id, name, note], i) => ({ id, name, note, sort: i, archived: false, updatedAt: 0 }));

function empty(): State {
  const s = Object.fromEntries(COLLECTIONS.map((c) => [c, {}])) as unknown as State;
  s.spaces = seed(SEED_SPACES);
  s.habits = seed(SEED_HABITS);
  s.funds = seed(SEED_FUNDS);
  s.meta = { lastExportAt: null, pin: null };
  return s;
}

// ---------- IndexedDB (상태 전체를 한 덩어리로 저장) ----------
let dbp: Promise<IDBDatabase> | null = null;
function idb(): Promise<IDBDatabase> {
  return (dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open("hoon-me", 1);
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
const emit = () => listeners.forEach((l) => l());

export async function loadStore() {
  const saved = (await idbGet("state")) as Partial<State> | undefined;
  if (saved) {
    const base = empty();
    for (const c of COLLECTIONS) (base as Record<string, unknown>)[c] = { ...(base[c] as object), ...((saved[c] as object) ?? {}) };
    base.meta = { ...base.meta, ...(saved.meta ?? {}) };
    state = base;
  }
  ready = true;
  navigator.storage?.persist?.().catch(() => {});
  emit();
}

function commit(next: State) {
  state = next;
  idbSet("state", state).catch((e) => console.error("저장 실패", e));
  emit();
}
export function getState() {
  return state;
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

export function live<T extends Base>(rec: Record<string, T>): T[] {
  return Object.values(rec).filter((x) => !x.deleted);
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const nowStr = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);

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
  // Space
  addSpace(name: string) {
    const n = live(state.spaces).length;
    put("spaces", { id: uid(), name, color: SPACE_COLORS[n] ?? "#8a8a86", sort: n, archived: false, updatedAt: 0 });
  },
  renameSpace: (id: string, name: string) => patch("spaces", id, { name }),
  archiveSpace: (id: string) => patch("spaces", id, { archived: true }),

  // Inbox 할일
  addTask(text: string, spaceId: string | null = null, estMin: number | null = null) {
    const id = uid();
    put("tasks", { id, text, spaceId, estMin, done: false, doneAt: null, createdAt: nowStr(), updatedAt: 0 });
    return id;
  },
  updateTask: (id: string, p: Partial<Task>) => patch("tasks", id, p),
  toggleTask(id: string) {
    const t = state.tasks[id];
    patch("tasks", id, { done: !t.done, doneAt: t.done ? null : nowStr() });
  },
  deleteTask: (id: string) => remove("tasks", id),

  // 시간 블록
  addBlock(b: { date: string; start: number; end: number; title: string; spaceId: string | null; taskId?: string | null }) {
    const id = uid();
    put("blocks", { id, taskId: null, status: "planned", actualMin: null, note: "", updatedAt: 0, ...b });
    return id;
  },
  updateBlock: (id: string, p: Partial<Block>) => patch("blocks", id, p),
  setBlockStatus(id: string, status: BlockStatus, actualMin: number | null = null) {
    const b = state.blocks[id];
    patch("blocks", id, { status, actualMin: status === "done" ? actualMin : null });
    // Inbox 에서 온 블록이면 할일 완료도 같이
    if (b.taskId && state.tasks[b.taskId]) patch("tasks", b.taskId, { done: status === "done", doneAt: status === "done" ? nowStr() : null });
  },
  deleteBlock: (id: string) => remove("blocks", id),

  // 습관
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

  // 가계부
  addTxn(t: { kind: "expense" | "income"; amount: number; category: string; memo: string; date?: string }) {
    put("txns", { id: uid(), date: t.date ?? kst(), kind: t.kind, amount: t.amount, category: t.category, memo: t.memo, createdAt: nowStr(), updatedAt: 0 });
  },
  recatTxn: (id: string, category: string) => patch("txns", id, { category }),
  deleteTxn: (id: string) => remove("txns", id),

  // 모으기(저금·CMA·ISA·청약 …)
  addFund(name: string, note: string) {
    const sort = Math.max(0, ...live(state.funds).map((f) => f.sort)) + 1;
    put("funds", { id: uid(), name, note, sort, archived: false, updatedAt: 0 });
  },
  archiveFund: (id: string) => patch("funds", id, { archived: true }),
  addFundEntry(fundId: string, kind: FundEntry["kind"], amount: number, date = kst()) {
    // 평가액은 하루 하나(같은 날 다시 적으면 덮어씀)
    const id = kind === "value" ? `${fundId}:value:${date}` : uid();
    put("fundEntries", { id, fundId, date, kind, amount, createdAt: nowStr(), updatedAt: 0 });
  },
  deleteFundEntry: (id: string) => remove("fundEntries", id),

  // 몸
  setMetric(key: Metric["key"], value: number, date = kst()) {
    put("metrics", { id: `${key}:${date}`, key, date, value, updatedAt: 0 });
  },

  // 학습
  addLearn: (text: string) => put("learns", { id: uid(), date: kst(), text, createdAt: nowStr(), updatedAt: 0 }),
  deleteLearn: (id: string) => remove("learns", id),
  addBook(title: string, kind: Book["kind"], total: number | null) {
    put("books", { id: uid(), title, kind, unit: kind === "책" ? "쪽" : "강", total, status: "진행", createdAt: nowStr(), finishedAt: null, updatedAt: 0 });
  },
  setBookStatus: (id: string, status: Book["status"]) => patch("books", id, { status, finishedAt: status === "완료" ? kst() : null }),
  logBook(bookId: string, amount: number) {
    put("bookLogs", { id: uid(), bookId, date: kst(), amount, updatedAt: 0 });
    // 책을 읽으면 '독서' 습관 자동 체크(오늘 읽은 쪽 수 합계로)
    const b = state.books[bookId];
    if (b?.kind === "책") {
      const today = kst();
      const pages = live(state.bookLogs)
        .filter((l) => l.date === today && state.books[l.bookId]?.kind === "책")
        .reduce((a, l) => a + l.amount, 0);
      act.setHabit("h-read", true, pages, today);
    }
  },

  // 기록
  addNote(text: string, kind: "memo" | "diary") {
    const date = kst();
    put("notes", { id: uid(), date, kind, text, createdAt: nowStr(), updatedAt: 0 });
    if (kind === "diary") act.setHabit("h-diary", true, null, date);
  },
  deleteNote: (id: string) => remove("notes", id),

  // 하루 마무리(Today Zero)
  closeDay(date: string, reflection: string, photo: string | null, condition: number | null) {
    put("days", { id: date, date, reflection, photo, condition, closedAt: nowStr(), updatedAt: 0 });
    if (condition != null) act.setMetric("condition", condition, date);
  },

  // 고정 지출
  addRecur(r: { name: string; amount: number; day: number; category: string; fundId: string | null }) {
    const sort = Math.max(0, ...live(state.recurs).map((x) => x.sort)) + 1;
    put("recurs", { id: uid(), ...r, sort, archived: false, updatedAt: 0 });
  },
  updateRecur: (id: string, p: Partial<Recur>) => patch("recurs", id, p),
  archiveRecur: (id: string) => patch("recurs", id, { archived: true }),
  // 냈음 = 가계부 지출(또는 모으기 넣기)을 정해진 id 로 만든다 → 같은 달 두 번 기록 안 됨, 취소하면 그 기록만 지움
  payRecur(id: string, month: string) {
    const r = state.recurs[id];
    const key = `r:${id}:${month}`;
    const date = recurDate(r, month);
    if (r.fundId) put("fundEntries", { id: key, fundId: r.fundId, date, kind: "deposit", amount: r.amount, createdAt: nowStr(), updatedAt: 0 });
    else put("txns", { id: key, date, kind: "expense", amount: r.amount, category: r.category, memo: r.name, createdAt: nowStr(), updatedAt: 0 });
  },
  unpayRecur(id: string, month: string) {
    const key = `r:${id}:${month}`;
    if (state.txns[key]) remove("txns", key);
    if (state.fundEntries[key]) remove("fundEntries", key);
  },

  // 기기 전용
  setPin(pin: Meta["pin"]) {
    commit({ ...state, meta: { ...state.meta, pin } });
  },
};

// ---------- 내보내기 / 가져오기(병합) ----------
export async function exportFile(): Promise<"shared" | "downloaded"> {
  const { meta: _meta, ...rest } = state;
  void _meta;
  const data = { app: "hoon-me", version: 2, exportedAt: new Date().toISOString(), state: rest };
  const name = `나-백업-${kst()}.json`;
  const file = new File([JSON.stringify(data)], name, { type: "application/json" });
  let how: "shared" | "downloaded";
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: name });
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
  const next = { ...state };
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

// ---------- 파생 계산(여러 화면 공용) ----------
export function activeSpaces(s: State) {
  return live(s.spaces)
    .filter((x) => !x.archived)
    .sort((a, b) => a.sort - b.sort);
}
export function spaceOf(s: State, id: string | null) {
  return id ? s.spaces[id] : undefined;
}
export function blocksOn(s: State, date: string) {
  return live(s.blocks)
    .filter((b) => b.date === date)
    .sort((a, b) => a.start - b.start);
}
// Inbox = 안 끝났고, 잡혀 있는(계획·완료) 블록이 없는 할일
export function inbox(s: State) {
  const scheduled = new Set(
    live(s.blocks)
      .filter((b) => b.taskId && b.status !== "skipped")
      .map((b) => b.taskId)
  );
  return live(s.tasks)
    .filter((t) => !t.done && !scheduled.has(t.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export function blockMinutes(b: Block) {
  return b.status === "done" ? b.actualMin ?? b.end - b.start : 0;
}
export function hasHabit(s: State, habitId: string, date: string) {
  const l = s.habitLogs[`${habitId}:${date}`];
  return !!l && !l.deleted;
}
export function fundSummary(s: State, fundId: string) {
  const es = live(s.fundEntries)
    .filter((e) => e.fundId === fundId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const principal = es.reduce((a, e) => a + (e.kind === "deposit" ? e.amount : e.kind === "withdraw" ? -e.amount : 0), 0);
  const lastValue = [...es].reverse().find((e) => e.kind === "value");
  // 마지막 평가 이후 넣고 뺀 돈은 평가액에 더한다(평가액 업데이트 전까지)
  let value = principal;
  if (lastValue) {
    const after = es.filter((e) => e.kind !== "value" && (e.date > lastValue.date || (e.date === lastValue.date && e.createdAt > lastValue.createdAt)));
    value = lastValue.amount + after.reduce((a, e) => a + (e.kind === "deposit" ? e.amount : -e.amount), 0);
  }
  return { entries: es, principal, value, gain: value - principal, valuedAt: lastValue?.date ?? null };
}

// ---------- 고정 지출 ----------
// 그 달의 실제 날짜(31일·말일 → 그 달 마지막 날로)
export function recurDate(r: Recur, month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(r.day, last)).padStart(2, "0")}`;
}
export function activeRecurs(s: State) {
  return live(s.recurs)
    .filter((r) => !r.archived)
    .sort((a, b) => a.day - b.day || a.sort - b.sort);
}
export function recurPaid(s: State, id: string, month: string) {
  const key = `r:${id}:${month}`;
  const t = s.txns[key] ?? s.fundEntries[key];
  return !!t && !t.deleted;
}
