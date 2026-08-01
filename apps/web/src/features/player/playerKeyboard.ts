export type PlayerKeyboardActions = {
  toggle: () => void | Promise<void>;
  seekBy: (deltaSec: number) => void;
  seekToStart: () => void;
  seekToEnd: () => void;
  nudgeTranspose: (delta: number) => void;
  nudgeRate: (delta: number) => void;
  toggleLoop: () => void;
  clearLoop: () => void;
};

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  const tag = el.tagName?.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return (
    (typeof HTMLInputElement !== "undefined" && target instanceof HTMLInputElement) ||
    (typeof HTMLTextAreaElement !== "undefined" &&
      target instanceof HTMLTextAreaElement) ||
    (typeof HTMLSelectElement !== "undefined" && target instanceof HTMLSelectElement)
  );
}

/** RF-D08 — atalhos do Play-Along. Retorna true se consumiu o evento. */
export function handlePlayerKeydown(
  e: KeyboardEvent,
  actions: PlayerKeyboardActions,
): boolean {
  if (isEditableTarget(e.target)) return false;

  switch (e.code) {
    case "Space":
      e.preventDefault();
      void actions.toggle();
      return true;
    case "ArrowLeft":
      e.preventDefault();
      actions.seekBy(e.shiftKey ? -5 : -1);
      return true;
    case "ArrowRight":
      e.preventDefault();
      actions.seekBy(e.shiftKey ? 5 : 1);
      return true;
    case "Home":
      e.preventDefault();
      actions.seekToStart();
      return true;
    case "End":
      e.preventDefault();
      actions.seekToEnd();
      return true;
    case "KeyJ":
      e.preventDefault();
      actions.seekBy(-2);
      return true;
    case "KeyK":
      e.preventDefault();
      void actions.toggle();
      return true;
    case "KeyL":
      e.preventDefault();
      actions.toggleLoop();
      return true;
    case "Equal":
    case "NumpadAdd":
      e.preventDefault();
      actions.nudgeTranspose(1);
      return true;
    case "Minus":
    case "NumpadSubtract":
      e.preventDefault();
      actions.nudgeTranspose(-1);
      return true;
    case "BracketLeft":
      e.preventDefault();
      actions.nudgeRate(-0.05);
      return true;
    case "BracketRight":
      e.preventDefault();
      actions.nudgeRate(0.05);
      return true;
    case "Escape":
      e.preventDefault();
      actions.clearLoop();
      return true;
    default:
      return false;
  }
}
