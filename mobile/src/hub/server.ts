import { hub, HubTransport } from './hub';
import { loadTcpSocket } from '../native';

export const DEVICE_PORT = 10086; // the strip's firmware always dials this port

let server: any = null;
let serverErrorLogged = false;

/** Starts listening on 0.0.0.0:10086 and the hub poll loop. */
export function startHubServer(port = DEVICE_PORT): Promise<void> {
  if (server) return Promise.resolve();
  const TcpSocket = loadTcpSocket();
  if (!TcpSocket) return Promise.reject(new Error('tcp socket unavailable'));
  return new Promise((resolve, reject) => {
    let s: any;
    try {
      s = TcpSocket.createServer((socket: any) => {
        // Any throw here must never take the app down — the strip re-dials us.
        try {
          const peerIp = (socket && socket.remoteAddress) || '?';
          const conn = hub.openConnection(peerIp, {
            ip: peerIp,
            send: (cmd) => {
              try {
                socket.write(`${cmd}\r\n`);
              } catch {
                /* strip may have just dropped; hub will mark it offline */
              }
            },
            close: () => {
              try {
                socket.destroy();
              } catch {}
            },
          });
          try {
            socket.setEncoding('utf8');
          } catch {}
          socket.on('data', (data: string | Buffer | ArrayBuffer) => {
            try {
              const text =
                typeof data === 'string'
                  ? data
                  : data instanceof ArrayBuffer
                    ? new TextDecoder('utf-8').decode(data)
                    : (data as Buffer).toString('utf8');
              conn.feed(text);
            } catch {
              /* ignore a malformed frame; keep the session */
            }
          });
          socket.on('error', () => {
            try {
              conn.closed();
            } catch {}
          });
          socket.on('close', () => {
            try {
              conn.closed();
            } catch {}
          });
        } catch {
          /* ignore connection-level failures */
        }
      });
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    s.on('error', (e: Error) => {
      if (!serverErrorLogged) {
        serverErrorLogged = true;
        console.warn('powerk: hub server error', e?.message);
      }
      server = null;
    });
    try {
      s.listen({ port, host: '0.0.0.0' }, () => {
        server = s;
        hub.start();
        resolve();
      });
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

export function stopHubServer(): void {
  hub.stop();
  if (server) {
    try {
      server.close();
    } catch {}
    server = null;
  }
}