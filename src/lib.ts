// 날짜·금액 도우미

export function kst(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

const WD = ["일", "월", "화", "수", "목", "금", "토"];
export function weekday(d: string): string {
  return WD[new Date(`${d}T12:00:00Z`).getUTCDay()];
}

export function dateLabel(d: string | null, base = kst()): string {
  if (!d) return "언제든";
  if (d === base) return "오늘";
  if (d === kst(1)) return "내일";
  if (d === kst(-1)) return "어제";
  const [, m, day] = d.split("-").map(Number);
  return `${m}/${day}(${weekday(d)})`;
}

export function won(n: number): string {
  return n.toLocaleString("ko-KR");
}

// 큰 금액은 만 단위로 짧게: 1,234,000 → 123만
export function wonShort(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e8) return `${(n / 1e8).toFixed(a >= 1e9 ? 0 : 1).replace(/\.0$/, "")}억`;
  if (a >= 1e4) return `${(n / 1e4).toFixed(a >= 1e6 ? 0 : 1).replace(/\.0$/, "")}만`;
  return won(n);
}

export const EXPENSE_CATS = ["식비", "카페", "교통", "생활", "쇼핑", "의료", "문화", "구독", "경조사", "기타"];
export const INCOME_CATS = ["월급", "부수입", "이자·배당", "기타"];
export const ASSET_TYPES = ["주식", "적금", "예금", "현금", "코인", "연금", "기타"];

const CAT_WORDS: [string, string[]][] = [
  ["카페", ["커피", "카페", "스벅", "라떼", "아아", "디저트", "빵"]],
  ["식비", ["점심", "저녁", "아침", "밥", "식사", "배달", "치킨", "마트", "편의점", "술", "고기", "야식", "간식"]],
  ["교통", ["택시", "버스", "지하철", "주유", "기름", "주차", "톨비", "ktx", "기차", "교통"]],
  ["구독", ["넷플", "유튜브", "구독", "스포티", "icloud", "와우"]],
  ["의료", ["병원", "약국", "약", "치과", "한의원"]],
  ["문화", ["영화", "책", "공연", "전시", "게임"]],
  ["쇼핑", ["옷", "신발", "쿠팡", "무신사", "쇼핑"]],
  ["생활", ["관리비", "통신", "핸드폰", "전기", "가스", "수도", "월세", "세탁", "다이소"]],
  ["경조사", ["축의", "부의", "조의", "선물"]],
  ["월급", ["월급", "급여"]],
  ["이자·배당", ["이자", "배당"]],
];

// "점심 12000" / "커피 4.5천" / "+월급 350만" / "택시 1.2만원"
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
