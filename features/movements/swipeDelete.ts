/**
 * Shared trigger for the swipe-to-delete gesture on a movement row: closes
 * the revealed action panel first, then hands off to the same delete flow
 * used by the detail sheet's Eliminar button (confirm dialogs included) --
 * kept as a pure function so the event itself is unit-testable without
 * rendering the Swipeable/gesture-handler tree.
 */
export function runSwipeToDeleteAction(closeRow: () => void, onDelete: () => void): void {
  closeRow();
  onDelete();
}
