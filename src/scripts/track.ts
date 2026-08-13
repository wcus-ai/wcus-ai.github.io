/**
 * Click tracking beacon. Listens for clicks on any element carrying
 * `data-track-event`, fires a single `navigator.sendBeacon` to the worker,
 * then lets the default navigation proceed unchanged.
 *
 * Required env (build-time, exposed to client by the `PUBLIC_` prefix):
 *   PUBLIC_TRACKING_ENDPOINT — absolute URL of the worker's `/track` route,
 *   e.g. `https://wcus-site.<account>.workers.dev/track`.
 *
 * When unset (local dev, misconfigured build) tracking silently no-ops; links
 * still work.
 *
 * The listener binds to `document` exactly once via `initTracking()` and uses
 * event delegation, so it survives Astro View Transitions without re-binding.
 */

const ENDPOINT = import.meta.env.PUBLIC_TRACKING_ENDPOINT as string | undefined;

interface TrackPayload {
  event: string;
  project: string;
  target?: string;
}

function isTrackedClick(event: MouseEvent): boolean {
  // Only primary (left, no modifier) and middle-click (new tab)
  if (event.defaultPrevented) return false;
  if (event.button !== 0 && event.button !== 1) return false;
  return true;
}

function readPayload(target: HTMLElement): TrackPayload | null {
  const eventType = target.dataset.trackEvent;
  const project = target.dataset.trackProject;
  if (!eventType || !project) return null;

  const payload: TrackPayload = { event: eventType, project };
  const targetField = target.dataset.trackTarget;
  if (targetField) payload.target = targetField;
  return payload;
}

function handleTrackClick(event: MouseEvent): void {
  if (!ENDPOINT) return;
  if (!isTrackedClick(event)) return;

  // Walk up from the click target to the nearest tracked element.
  const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-track-event]');
  if (!target) return;

  const payload = readPayload(target);
  if (!payload) return;

  try {
    navigator.sendBeacon(ENDPOINT, JSON.stringify(payload));
  } catch {
    // Fail silently so we don't break navigation.
  }
}

export function initTracking(): void {
  document.addEventListener('click', handleTrackClick);
}
