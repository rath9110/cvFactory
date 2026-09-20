/**
 * Asks the server to refresh the learning proposals.
 *
 * Called when a piece of work finishes — a download, a save, or the tab going
 * away — rather than when the learning page is opened, so the model runs after
 * something has actually changed instead of on every page view.
 *
 * Safe to call as often as you like. The browser side de-duplicates within a
 * page load, and the server recomputes only when its signature has moved, so
 * extra calls cost nothing.
 */

let pending: Promise<void> | null = null;
let firedThisPageLoad = false;

async function post(keepalive: boolean): Promise<void> {
  try {
    await fetch("/api/learn/refresh", { method: "POST", keepalive });
  } catch {
    // Best effort. A missed refresh just means the learning page shows its
    // previous proposals and reports itself as out of date.
  }
}

export function triggerLearningRefresh(): void {
  if (pending) return;
  firedThisPageLoad = true;
  pending = post(false).finally(() => {
    pending = null;
  });
}

/**
 * The last-chance trigger. `keepalive` lets the request outlive the page, which
 * a normal fetch would not. Skipped when a refresh already ran on this page.
 */
export function triggerLearningRefreshOnExit(): void {
  if (firedThisPageLoad || pending) return;
  firedThisPageLoad = true;
  void post(true);
}
