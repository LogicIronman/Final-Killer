import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export function keyboardEventCode(event: KeyboardEvent | ReactKeyboardEvent) {
  return event.code || event.key;
}

export function isActionKey(event: KeyboardEvent, configuredCode: string) {
  return keyboardEventCode(event) === configuredCode || event.key === configuredCode;
}

export function shouldIgnoreActionKeyInInput(event: KeyboardEvent) {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement)) return false;
  if (event.ctrlKey || event.metaKey) return false;
  return true;
}

export function labelForKeyCode(code: string) {
  if (code === "Space") return "空格";
  if (code === "Enter") return "Enter";
  if (code === "ArrowRight") return "右方向键";
  if (code === "ArrowLeft") return "左方向键";
  if (code === "ArrowUp") return "上方向键";
  if (code === "ArrowDown") return "下方向键";
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return `小键盘 ${code.slice(6)}`;
  return code;
}
