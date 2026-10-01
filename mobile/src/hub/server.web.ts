// Web: there is no TCP server in a browser, so the built-in powerk server is
// unavailable. The web app is a client of an external powerk.py (server mode).

export const DEVICE_PORT = 10086;

export function startHubServer(_port?: number): Promise<void> {
  return Promise.resolve();
}

export function stopHubServer(): void {
  // no-op on web
}