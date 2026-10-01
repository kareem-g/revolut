import * as Network from 'expo-network';

/** The phone's current IP (Wi‑Fi, when connected). Empty string if none. */
export function getLocalIp(): Promise<string> {
  return Network.getIpAddressAsync()
    .then((ip) => ip || '')
    .catch(() => '');
}

function subnetPrefix(ip: string): string | null {
  const m = /^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/.exec(ip.trim());
  return m ? m[1] : null;
}

function isPrivatePrefix(p: string): boolean {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(p + '.');
}

async function probe(host: string, port: number, timeoutMs = 350): Promise<boolean> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(`http://${host}:${port}/api/state`, {
      method: 'GET',
      signal: c.signal,
    });
    if (!r.ok) return false;
    const j = await r.json();
    return Array.isArray((j as { devices?: unknown })?.devices);
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Scans the local /24 subnet for a reachable powerk.py web server and returns
 * its IP. Probes in parallel (bounded) so a typical home network resolves in a
 * couple of seconds; cancels as soon as one is found.
 */
export async function discoverServer(
  localIp: string,
  port: number,
  onProgress?: (found: boolean) => void,
): Promise<string | null> {
  const prefix = subnetPrefix(localIp);
  if (!prefix || !isPrivatePrefix(prefix)) return null;

  const hosts: string[] = [];
  for (let i = 1; i <= 254; i++) {
    const host = `${prefix}.${i}`;
    if (host !== localIp) hosts.push(host);
  }

  let found: string | null = null;
  let next = 0;
  const CONCURRENCY = 30;

  const worker = async () => {
    while (next < hosts.length && !found) {
      const i = next++;
      const host = hosts[i];
      if (await probe(host, port)) {
        found = host;
        onProgress?.(true);
        return;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, hosts.length) }, worker));
  onProgress?.(false);
  return found;
}