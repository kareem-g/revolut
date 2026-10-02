import {
  SETUP_HOST,
  SETUP_PORT,
  WifiCreds,
  buildConnectCommand,
  buildIpCommand,
  expectsConnectOk,
  expectsIpOk,
} from './provision';
import { loadTcpSocket } from './native';

export type LogSink = (key: string, ...args: string[]) => void;

const CONNECT_TIMEOUT_MS = 4000;
const REPLY_TIMEOUT_MS = 6000;
const REACHABILITY_SECONDS = 30;

/**
 * Opens one connection, sends `line\r\n`, waits for a full line back.
 * Each provisioning command uses its own connection, exactly like powerk.py.
 */
function exchange(line: string, onLog: LogSink): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const TcpSocket = loadTcpSocket();
    if (!TcpSocket) return reject(new SetupError('err_no_native'));
    let settled = false;
    let buffer = '';
    let replyTimer: ReturnType<typeof setTimeout> | null = null;
    let socket: any = null;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (replyTimer) clearTimeout(replyTimer);
      try {
        socket.destroy();
      } catch {}
      fn();
    };

    socket = TcpSocket.createConnection(
      { host: SETUP_HOST, port: SETUP_PORT, noDelay: true },
      () => {
        // Only write once the connection is actually open — writing earlier
        // throws "Socket is closed" (the library still marks the socket pending).
        onLog('log_connected', SETUP_HOST);
        // Short settle beat before writing: the first small frame can otherwise
        // be lost and the strip closes with no reply.
        setTimeout(() => {
          try {
            socket.write(`${line}\r\n`, 'utf8');
            onLog('log_sent', line);
          } catch (e) {
            finish(() => reject(e instanceof Error ? e : new Error(String(e))));
          }
        }, 120);
      },
    );
    socket.setEncoding('utf8');

    socket.on('data', (data: string | Buffer) => {
      buffer += typeof data === 'string' ? data : data.toString('utf8');
      const newline = buffer.indexOf('\n');
      if (newline !== -1) {
        const reply = buffer.slice(0, newline).replace(/\r/g, '').replace(/\0/g, '').trim();
        onLog('log_got', reply);
        finish(() => resolve(reply));
      }
    });
    socket.on('error', (e: { message?: string }) =>
      finish(() => reject(new SetupError('socket', e?.message || 'socket error'))),
    );
    socket.on('close', () => {
      if (!settled) {
        // Device pads frames with NULs and may close early; treat buffered text as the reply.
        const reply = buffer.replace(/\r/g, '').replace(/\0/g, '').trim();
        if (reply) {
          onLog('log_got', reply);
          finish(() => resolve(reply));
        } else {
          finish(() => reject(new SetupError('log_closed')));
        }
      }
    });

    replyTimer = setTimeout(
      () => finish(() => reject(new SetupError('log_timeout'))),
      REPLY_TIMEOUT_MS,
    );
  });
}

/** Tries createConnection once; resolves when the socket is writable. */
function canReach(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const TcpSocket = loadTcpSocket();
    if (!TcpSocket) return reject(new SetupError('err_no_native'));
    let settled = false;
    const socket = TcpSocket.createConnection({ host: SETUP_HOST, port: SETUP_PORT, noDelay: true }, () => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve();
    });
    socket.on('error', (e: { message?: string }) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error(e?.message || 'unreachable'));
    });
    setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error('timeout'));
    }, CONNECT_TIMEOUT_MS);
  });
}

/** Error whose message is an i18n key + args (rendered by the Setup screen). */
export class SetupError extends Error {
  key: string;
  args: string[];
  constructor(key: string, ...args: string[]) {
    super(key);
    this.key = key;
    this.args = args;
  }
}

/**
 * Sends one provisioning command on its own connection, retrying transport
 * failures a couple of times (the strip's setup service can drop the first).
 */
async function sendSetupCommand(cmd: string, onLog: LogSink): Promise<string> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await exchange(cmd, onLog);
    } catch (e) {
      lastErr = e;
      if (attempt < 3) {
        onLog('log_refused', String(attempt));
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }
  throw lastErr;
}

/**
 * Sends both provisioning commands, retrying reachability for a while first
 * (powerk.py does the same wait/retry loop around the setup port).
 */
export async function provisionStrip(
  serverIp: string,
  home: WifiCreds,
  onLog: LogSink,
): Promise<void> {
  const deadline = Date.now() + REACHABILITY_SECONDS * 1000;
  for (let attempt = 1; ; attempt++) {
    try {
      await canReach();
      break;
    } catch {
      if (Date.now() > deadline) throw new SetupError('err_unreachable_setup');
      onLog('log_refused', String(attempt));
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const ipReply = await sendSetupCommand(buildIpCommand(serverIp), onLog);
  if (!expectsIpOk(ipReply))
    throw new SetupError('err_strip_answered', ipReply, 'up:ip:ip_ok');

  const connectReply = await sendSetupCommand(buildConnectCommand(home), onLog);
  if (!expectsConnectOk(connectReply))
    throw new SetupError('err_strip_answered', connectReply, 'up:connect:connect_ok');
}
