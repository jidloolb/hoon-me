import { ReactNode } from "react";

export function Card({ title, right, children }: { title?: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between">
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
          className={`rounded-[10px] ${small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} font-medium transition ${value === o.v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CheckRow({ done, onToggle, children, meta, metaTone, onMeta }: { done: boolean; onToggle: () => void; children: ReactNode; meta?: ReactNode; metaTone?: "red" | "gray"; onMeta?: () => void }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <button
        onClick={onToggle}
        aria-label={done ? "완료 취소" : "완료"}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${done ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300"}`}
      >
        {done && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6.5L4.8 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <span className={`flex-1 text-[15px] leading-snug ${done ? "text-gray-400 line-through" : "text-gray-900"}`}>{children}</span>
      {meta && (
        <button onClick={onMeta} className={`shrink-0 text-xs ${metaTone === "red" ? "text-red-500" : "text-gray-400"}`}>
          {meta}
        </button>
      )}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div className="pb-safe w-full max-w-lg rounded-t-3xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="text-sm text-gray-400">
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const inputCls = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500";
export const btnCls = "shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-40";
