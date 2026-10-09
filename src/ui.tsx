import { ReactNode } from "react";
import type { Space } from "./store";

export function Card({ title, right, children, className = "" }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-gray-800">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Seg<T extends string>({ value, options, onChange, small }: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void; small?: boolean }) {
  return (
    <div className="inline-flex rounded-xl bg-gray-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`rounded-[10px] ${small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} font-medium transition ${value === o.v ? "bg-accent text-white shadow-sm" : "text-gray-500"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Check({ done, onClick, color = "#8b6cf7" }: { done: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={done ? "완료 취소" : "완료"}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition"
      style={done ? { background: color, borderColor: color, color: "#fff" } : { borderColor: "#564d77" }}
    >
      {done && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6.5L4.8 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="pb-safe max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="shrink-0 text-sm text-gray-400">
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Chips<T extends string | number | null>({ value, options, onChange }: { value: T; options: { v: T; label: ReactNode; color?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.v === value;
        return (
          <button
            key={String(o.v)}
            type="button"
            onClick={() => onChange(o.v)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${on ? "bg-accent text-white" : "bg-gray-100 text-gray-600"}`}
          >
            {o.color && <span className="h-2 w-2 rounded-full" style={{ background: o.color }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SpaceChips({ spaces, value, onChange, allowNone = true }: { spaces: Space[]; value: string | null; onChange: (v: string | null) => void; allowNone?: boolean }) {
  return (
    <Chips<string | null>
      value={value}
      onChange={onChange}
      options={[...(allowNone ? [{ v: null, label: "없음" }] : []), ...spaces.map((s) => ({ v: s.id as string | null, label: s.name, color: s.color }))]}
    />
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-2 text-sm text-gray-400">{children}</p>;
}

// 한 줄 막대(값 라벨 포함) — 분석·가계부 공용
export function BarRow({ label, value, max, color = "#9d82ff", text }: { label: ReactNode; value: number; max: number; color?: string; text: ReactNode }) {
  return (
    <li>
      <div className="flex justify-between gap-2 text-sm">
        <span className="text-gray-700">{label}</span>
        <span className="tabular-nums text-gray-900">{text}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-gray-100">
        <div className="h-1.5 rounded-full" style={{ width: `${max && value > 0 ? Math.max(2, (value / max) * 100) : 0}%`, background: color }} />
      </div>
    </li>
  );
}

// 작은 추이선(2px 선, 마지막 점 표시)
export function Spark({ values, height = 48, color = "#9d82ff" }: { values: number[]; height?: number; color?: string }) {
  if (values.length < 2) return null;
  const w = 300;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 8) + 4, height - 6 - ((v - min) / span) * (height - 12)]);
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none" aria-hidden>
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="4" fill={color} stroke="#1a1626" strokeWidth="2" />
    </svg>
  );
}

// 세로 막대 묶음(월별 등) — 값은 막대 위 라벨
export function Columns({ items, color = "#9d82ff", fmt }: { items: { label: string; value: number }[]; color?: string; fmt: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex h-28 items-end gap-1.5">
      {items.map((i) => (
        <div key={i.label} className="flex flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] tabular-nums text-gray-500">{i.value ? fmt(i.value) : ""}</span>
          <div className="w-full rounded-t-[4px]" style={{ height: `${(i.value / max) * 72}px`, background: color, minHeight: i.value ? 2 : 0 }} />
          <span className="text-[10px] text-gray-400">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

export const inputCls = "w-full rounded-xl border border-gray-200 bg-card px-3 py-2.5 outline-none focus:border-blue-500";
export const btnCls = "shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-40";
export const ghostBtn = "rounded-xl bg-gray-100 px-4 py-2.5 font-medium text-gray-700";
