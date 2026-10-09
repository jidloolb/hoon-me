// 날짜·시간·금액·통계 도우미

export function kst(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}
export function addDays(d: string, n: number): string {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
}
export function range(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const WD = ["일", "월", "화", "수", "목", "금", "토"];
export function weekday(d: string): string {
  return WD[new Date(`${d}T12:00:00Z`).getUTCDay()];
}
export function weekdayIdx(d: string): number {
  return new Date(`${d}T12:00:00Z`).getUTCDay();
}
export function dateLabel(d: string | null, base = kst()): string {
  if (!d) return "언제든";
  if (d === base) return "오늘";
  if (d === addDays(base, 1)) return "내일";
  if (d === addDays(base, -1)) return "어제";
  const [, m, day] = d.split("-").map(Number);
  return `${m}/${day}(${weekday(d)})`;
}
export function longDate(d: string): string {
  const [, m, day] = d.split("-").map(Number);
  return `${m}월 ${day}일 ${weekday(d)}요일`;
}

// 분(0~1440) ↔ "HH:MM"
export function hm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
export function nowMin(): number {
  const s = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour12: false });
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}
export function dur(min: number): string {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

export function won(n: number): string {
  return Math.round(n).toLocaleString("ko-KR");
}
export function wonShort(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e8) return `${(n / 1e8).toFixed(a >= 1e9 ? 0 : 1).replace(/\.0$/, "")}억`;
  if (a >= 1e4) return `${(n / 1e4).toFixed(a >= 1e6 ? 0 : 1).replace(/\.0$/, "")}만`;
  return won(n);
}
// "50만" "1,200,000" "3.5천" → 숫자
export function parseAmount(s: string): number {
  const m = s.trim().replace(/,/g, "").match(/^(-?\d+(?:\.\d+)?)\s*(억|만|천|k|K)?\s*원?$/);
  if (!m) return NaN;
  const mul = ({ 억: 1e8, 만: 1e4, 천: 1e3, k: 1e3, K: 1e3 } as Record<string, number>)[m[2]] ?? 1;
  return Math.round(parseFloat(m[1]) * mul);
}

export const EXPENSE_CATS = ["식비", "카페", "교통", "생활", "쇼핑", "의료", "문화", "구독", "경조사", "자기계발", "기타"];
export const INCOME_CATS = ["월급", "부수입", "이자·배당", "기타"];

const CAT_WORDS: [string, string[]][] = [
  ["카페", ["커피", "카페", "스벅", "라떼", "아아", "디저트", "빵"]],
  ["식비", ["점심", "저녁", "아침", "밥", "식사", "배달", "치킨", "마트", "편의점", "술", "고기", "야식", "간식"]],
  ["교통", ["택시", "버스", "지하철", "주유", "기름", "주차", "톨비", "ktx", "기차", "교통"]],
  ["구독", ["넷플", "유튜브", "구독", "스포티", "icloud", "와우"]],
  ["의료", ["병원", "약국", "약", "치과", "한의원"]],
  ["자기계발", ["책", "강의", "클래스", "수강", "교재", "인강"]],
  ["문화", ["영화", "공연", "전시", "게임"]],
  ["쇼핑", ["옷", "신발", "쿠팡", "무신사", "쇼핑"]],
  ["생활", ["관리비", "통신", "핸드폰", "전기", "가스", "수도", "월세", "세탁", "다이소"]],
  ["경조사", ["축의", "부의", "조의", "선물"]],
  ["월급", ["월급", "급여"]],
  ["이자·배당", ["이자", "배당"]],
];

// "점심 12000" / "커피 4.5천" / "+월급 350만"
export function parseMoney(s: string): { kind: "expense" | "income"; amount: number; memo: string; category: string } | null {
  let t = s.trim();
  let kind: "expense" | "income" = "expense";
  if (t.startsWith("+")) {
    kind = "income";
    t = t.slice(1).trim();
  }
  const re = /(\d[\d,]*(?:\.\d+)?)\s*(억|만|천|k|K)?\s*원?/g;
  let m: RegExpExecArray | null;
  let last: RegExpExecArray | null = null;
  while ((m = re.exec(t))) last = m;
  if (!last) return null;
  const mul = ({ 억: 1e8, 만: 1e4, 천: 1e3, k: 1e3, K: 1e3 } as Record<string, number>)[last[2]] ?? 1;
  const amount = Math.round(parseFloat(last[1].replace(/,/g, "")) * mul);
  if (!amount) return null;
  const memo = (t.slice(0, last.index) + t.slice(last.index + last[0].length)).trim();
  const low = memo.toLowerCase();
  let category = CAT_WORDS.find(([, ws]) => ws.some((w) => low.includes(w)))?.[0] ?? "기타";
  if (kind === "expense" && INCOME_CATS.includes(category) && category !== "기타") kind = "income";
  if (kind === "income" && !INCOME_CATS.includes(category)) category = "기타";
  return { kind, amount, memo, category };
}

// 피어슨 상관계수 — 두 값이 다 있는 날만
export function pearson(pairs: [number, number][]): number | null {
  const n = pairs.length;
  if (n < 3) return null;
  const mx = pairs.reduce((a, p) => a + p[0], 0) / n;
  const my = pairs.reduce((a, p) => a + p[1], 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  if (!sxx || !syy) return null;
  return sxy / Math.sqrt(sxx * syy);
}

// 사진 → 짧은 변 기준 축소 JPEG dataURL(약 100KB)
export async function shrinkPhoto(file: File, max = 900): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.72);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Space 색 — dataviz 범주 팔레트(다크 단계) 순서 고정(색맹 검증된 순서). 9번째부터는 회색.
export const SPACE_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
// 예전(밝은 테마) 색 → 다크 단계. 이미 저장된 Space 색을 불러올 때 바꿔 준다.
export const LIGHT_TO_DARK: Record<string, string> = Object.fromEntries(
  ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"].map((c, i) => [c, SPACE_COLORS[i]])
);
export const NONE_COLOR = "#6f6790";
