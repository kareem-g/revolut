// Provisioning protocol for the MTTL-W01 strip's setup access point.
// Mirrors powerk.py: connect to 192.168.1.1:30300, send each command in its
// OWN connection with CRLF, read one line, expect the ok token.
//
//   up:ip:<ip>                -> up:ip:ip_ok
//   up:connect:<ssid>:<pw>    -> up:connect:connect_ok

export const SETUP_HOST = '192.168.1.1';
export const SETUP_PORT = 30300;

export interface WifiCreds {
  ssid: string;
  password: string;
}

/** IPv4 in dotted-quad form (powerk.py: `--ip must be an IPv4 address`). */
export function isIpv4(value: string): boolean {
  const parts = value.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
}

/**
 * The strip announces `TONLY_TAP_XXXXXXX` with password `LGU_XXXXXXX` — the same
 * 7 characters. The user types the full SSID (from the label or iOS Wi-Fi list)
 * or just the 7 characters; SSID and password are derived automatically.
 */
export function stripCodeToNetwork(input: string): WifiCreds | null {
  let code = input.trim();
  const prefix = 'tonly_tap_';
  if (code.toLowerCase().startsWith(prefix)) code = code.slice(prefix.length);
  code = code.toUpperCase(); // the strip broadcasts uppercase; Wi-Fi names are case-sensitive
  if (!isStripCode(code)) return null;
  return { ssid: `TONLY_TAP_${code}`, password: `LGU_${code}` };
}

const CODE_RE = /^[A-Za-z0-9]{7}$/;
export function isStripCode(value: string): boolean {
  return CODE_RE.test(value.trim());
}

/** powerk.py refuses `:` and newlines in SSID/password (protocol limitation). */
export function credsValid({ ssid, password }: WifiCreds): boolean {
  if (!ssid || !password) return false;
  return ![...ssid, ...password].some((c) => c === ':' || c === '\r' || c === '\n');
}

export function buildIpCommand(ip: string): string {
  return `up:ip:${ip}`;
}

export function buildConnectCommand({ ssid, password }: WifiCreds): string {
  return `up:connect:${ssid}:${password}`;
}

export function expectsIpOk(reply: string): boolean {
  return reply.includes('ip_ok');
}

export function expectsConnectOk(reply: string): boolean {
  return reply.includes('connect_ok');
}
