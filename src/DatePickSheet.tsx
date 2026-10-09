import { Sheet } from "./ui";
import { kst } from "./lib";

// 할일 날짜 바꾸기 — 칩 한 번이면 끝, 특정 날짜는 아래 입력
export function DatePickSheet({ open, onClose, onPick, onDelete }: { open: boolean; onClose: () => void; onPick: (d: string | null) => void; onDelete?: () => void }) {
  const chips: [string, string | null][] = [
    ["오늘", kst()],
    ["내일", kst(1)],
    ["모레", kst(2)],
    ["다음 주", kst(7)],
    ["언제든", null],
  ];
  return (
    <Sheet open={open} onClose={onClose} title="언제 할까요?">
      <div className="flex flex-wrap gap-2">
        {chips.map(([l, d]) => (
          <button key={l} onClick={() => onPick(d)} className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium">
            {l}
          </button>
        ))}
      </div>
      <input type="date" className="mt-4 w-full rounded-xl border border-gray-200 px-3 py-2.5" onChange={(e) => e.target.value && onPick(e.target.value)} />
      {onDelete && (
        <button onClick={onDelete} className="mt-5 w-full py-2 text-sm text-red-500">
          삭제
        </button>
      )}
    </Sheet>
  );
}
