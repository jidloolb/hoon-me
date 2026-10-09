import { useEffect, useState } from "react";
import { act, getState } from "./store";

// PIN 잠금 — 기기 전용(백업 파일에 안 들어감). 앱을 열 때, 그리고 1분 넘게 다른 앱에 갔다 오면 다시 잠근다.
// 숫자 자체는 저장하지 않고 salt+SHA-256 해시만 둔다.
export async function hashPin(pin: string, salt: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pin}`));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function makePin(pin: string) {
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { salt, hash: await hashPin(pin, salt) };
}
export async function checkPin(pin: string) {
  const p = getState().meta.pin;
  return !p || (await hashPin(pin, p.salt)) === p.hash;
}

const RELOCK_MS = 60_000;

export function useLock(hasPin: boolean) {
  const [locked, setLocked] = useState(hasPin);
  useEffect(() => {
    if (!hasPin) {
      setLocked(false);
      return;
    }
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > RELOCK_MS) setLocked(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [hasPin]);
  return { locked, unlock: () => setLocked(false) };
}

export function PinPad({ title, onDone, error }: { title: string; onDone: (pin: string) => void; error?: string }) {
  const [pin, setPin] = useState("");
  // 4자리가 차면 버튼 누른 그 자리에서 바로 넘긴다(effect로 넘기면 onDone이 매 렌더 바뀌어 반복 호출됨)
  function press(k: string) {
    if (k === "⌫") return setPin(pin.slice(0, -1));
    const next = pin.length < 4 ? pin + k : pin;
    if (next.length === 4) {
      setPin("");
      onDone(next);
    } else setPin(next);
  }
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
  return (
    <div className="flex flex-col items-center">
      <p className="mb-5 text-base font-semibold">{title}</p>
      <div className="mb-3 flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < pin.length ? "bg-accent" : "bg-gray-200"}`} />
        ))}
      </div>
      <p className="mb-5 h-5 text-sm text-red-500">{error}</p>
      <div className="grid grid-cols-3 gap-3">
        {keys.map((k, i) =>
          k ? (
            <button
              key={i}
              onClick={() => press(k)}
              className="h-16 w-16 rounded-full bg-gray-100 text-2xl font-medium active:bg-gray-300"
            >
              {k}
            </button>
          ) : (
            <span key={i} />
          )
        )}
      </div>
    </div>
  );
}

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [err, setErr] = useState("");
  return (
    <div className="pt-safe fixed inset-0 z-[100] flex items-center justify-center bg-bg">
      <PinPad
        title="PIN 입력"
        error={err}
        onDone={async (p) => {
          if (await checkPin(p)) onUnlock();
          else setErr("PIN이 달라요");
        }}
      />
    </div>
  );
}

// 설정용: PIN 켜기(두 번 입력) / 끄기(현재 PIN 확인)
export function PinSetup({ hasPin, onFinish }: { hasPin: boolean; onFinish: (msg: string) => void }) {
  const [step, setStep] = useState<"check" | "first" | "second">(hasPin ? "check" : "first");
  const [first, setFirst] = useState("");
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<"off" | "change" | null>(hasPin ? null : "change");

  if (hasPin && !mode) {
    return (
      <div className="flex gap-2">
        <button onClick={() => setMode("change")} className="flex-1 rounded-xl bg-gray-100 py-2.5 font-medium">
          PIN 바꾸기
        </button>
        <button onClick={() => setMode("off")} className="flex-1 rounded-xl bg-gray-100 py-2.5 font-medium text-red-500">
          잠금 끄기
        </button>
      </div>
    );
  }
  if (step === "check")
    return (
      <PinPad
        title="지금 PIN"
        error={err}
        onDone={async (p) => {
          if (!(await checkPin(p))) return setErr("PIN이 달라요");
          setErr("");
          if (mode === "off") {
            act.setPin(null);
            onFinish("잠금을 껐어요");
          } else setStep("first");
        }}
      />
    );
  if (step === "first")
    return (
      <PinPad
        title="새 PIN 4자리"
        error={err}
        onDone={(p) => {
          setFirst(p);
          setErr("");
          setStep("second");
        }}
      />
    );
  return (
    <PinPad
      title="한 번 더"
      error={err}
      onDone={async (p) => {
        if (p !== first) {
          setErr("서로 달라요. 처음부터");
          setStep("first");
          return;
        }
        act.setPin(await makePin(p));
        onFinish("잠금을 켰어요");
      }}
    />
  );
}
