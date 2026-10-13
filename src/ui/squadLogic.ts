// Pure rules for the squad board's tap-to-swap interaction (unit-tested).

export type SlotAction = { kind: 'select'; slot: number } | { kind: 'deselect' } | { kind: 'swap'; a: number; b: number };

/**
 * What tapping `slot` does given the current selection `sel` (-1 = none):
 * tapping the selected slot clears it; with a hero selected, tapping another slot swaps
 * (moving to an empty slot is a swap with nobody); otherwise the tapped slot becomes selected.
 */
export function slotTap(sel: number, slot: number, slots: readonly (string | null)[]): SlotAction {
  if (sel === slot) return { kind: 'deselect' };
  if (sel >= 0 && sel < slots.length && slots[sel]) return { kind: 'swap', a: sel, b: slot };
  return { kind: 'select', slot };
}

/** Slot a roster hero should go to: the selected slot, else the first empty one, else -1. */
export function assignTarget(sel: number, slots: readonly (string | null)[]): number {
  if (sel >= 0 && sel < slots.length) return sel;
  return slots.findIndex((x) => !x);
}

/** After filling `filled`, the next empty slot to select (or -1 when the squad is full). */
export function nextEmpty(slots: readonly (string | null)[], filled: number): number {
  for (let i = 1; i <= slots.length; i++) {
    const j = (filled + i) % slots.length;
    if (!slots[j] && j !== filled) return j;
  }
  return -1;
}

/** Initial selection: the first empty slot, or nothing when the squad is full. */
export function initialSelection(slots: readonly (string | null)[]): number {
  return slots.findIndex((x) => !x);
}
