/**
 * Lets the browser install the page as an app: registers the (do-nothing) service worker public/sw.js. Only for a built page that the helper serves
 * over http: the dev server and the tests never register one, so nothing is left behind in those browsers.
 */
export interface WorkerHost {
  serviceWorker?: { register: (url: string) => Promise<unknown> };
}

export function registerServiceWorker(
  host: WorkerHost = navigator,
  production: boolean = import.meta.env.PROD,
  protocol: string = location.protocol,
): void {
  if (!production || protocol !== "http:" || !host.serviceWorker) return;
  host.serviceWorker.register("/sw.js").catch(() => {}); // not installable then; nothing else depends on it
}
