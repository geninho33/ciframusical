import { describe, expect, it, vi } from "vitest";
import { handlePlayerKeydown, isEditableTarget } from "./playerKeyboard";

function makeActions() {
  return {
    toggle: vi.fn(),
    seekBy: vi.fn(),
    seekToStart: vi.fn(),
    seekToEnd: vi.fn(),
    nudgeTranspose: vi.fn(),
    nudgeRate: vi.fn(),
    toggleLoop: vi.fn(),
    clearLoop: vi.fn(),
  };
}

function key(code: string, opts: Partial<KeyboardEvent> = {}) {
  return {
    code,
    shiftKey: false,
    preventDefault: vi.fn(),
    target: { tagName: "DIV" },
    ...opts,
  } as unknown as KeyboardEvent;
}

describe("playerKeyboard", () => {
  it("ignores editable targets", () => {
    expect(isEditableTarget({ tagName: "INPUT" } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: "TEXTAREA" } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: "DIV" } as unknown as EventTarget)).toBe(false);

    const actions = makeActions();
    const e = key("Space", {
      target: { tagName: "INPUT" } as unknown as EventTarget,
    });
    expect(handlePlayerKeydown(e, actions)).toBe(false);
    expect(actions.toggle).not.toHaveBeenCalled();
  });

  it("maps Space / arrows / transpose / loop (RF-D08)", () => {
    const actions = makeActions();
    expect(handlePlayerKeydown(key("Space"), actions)).toBe(true);
    expect(actions.toggle).toHaveBeenCalled();

    handlePlayerKeydown(key("ArrowRight", { shiftKey: true }), actions);
    expect(actions.seekBy).toHaveBeenCalledWith(5);

    handlePlayerKeydown(key("Equal"), actions);
    expect(actions.nudgeTranspose).toHaveBeenCalledWith(1);

    handlePlayerKeydown(key("KeyL"), actions);
    expect(actions.toggleLoop).toHaveBeenCalled();

    handlePlayerKeydown(key("Escape"), actions);
    expect(actions.clearLoop).toHaveBeenCalled();
  });
});
