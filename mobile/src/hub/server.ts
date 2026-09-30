import TcpSocket from 'react-native-tcp-socket';
import { hub, HubTransport } from './hub';

export const DEVICE_PORT = 10086; // the strip's firmware always dials this port

let server: ReturnType<typeof TcpSocket.createServer> | null = null;

/** Starts listening on 0.0.0.0:10086 and the hub poll loop. */
export function startHubServer(port = DEVICE_PORT): Promise<void> {
  if (server) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = TcpSocket.createServer((socket) => {
      const peerIp =
        (socket as unknown as { remoteAddress?: string }).remoteAddress || '?';
      const conn = hub.openConnection(peerIp, {
        ip: peerIp,
        send: (cmd) => socket.write(`${cmd}\r\n`),
        close: () => socket.destroy(),
      });
      socket.setEncoding('utf8');
      socket.on('data', (data: string | Buffer) =>
        conn.feed(typeof data === 'string' ? data : data.toString('utf8')),
      );
      socket.on('error', () => conn.closed());
      socket.on('close', () => conn.closed());
    });
    s.on('error', (e: Error) => {
      server = null;
      reject(e);
    });
    s.listen({ port, host: '0.0.0.0' }, () => {
      server = s;
      hub.start();
      resolve();
    });
  });
}

export function stopHubServer(): void {
  hub.stop();
  if (server) {
    server.close();
    server = null;
  }
}
