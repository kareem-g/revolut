/* Tests for the pure powerk logic: wire protocol, provisioning protocol, hub.
 * Run: node tests/logic.test.js  (after `npm run build:test`)
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const proto = require(path.join(__dirname, '..', '.test-build', 'hub', 'protocol.js'));
const prov = require(path.join(__dirname, '..', '.test-build', 'provision.js'));
const { hub } = require(path.join(__dirname, '..', '.test-build', 'hub', 'hub.js'));

// ---- wire protocol ----------------------------------------------------------

test('bootinfo parses model/mac/fw', () => {
  const b = proto.matchBootinfo(
    'up:bootinfo:lgutap;A493B91C0C4C;A493B91C0C4C;0.1.54-1.0.66;connect'
  );
  assert.ok(b);
  assert.equal(b.model, 'lgutap');
  assert.equal(b.mac, 'A493B91C0C4C');
  assert.equal(b.fw, '0.1.54-1.0.66');
});

test('bootinfo rejects bad mac', () => {
  assert.equal(proto.matchBootinfo('up:bootinfo:lgutap;XX;XX;1.0;connect'), null);
});

const GETINFO_LINE =
  'up:getinfo:1:12345;on;0;0;0;2300;0000005A;00000001;00000002;ok;00;28' +
  '\u0000\u0000'; // device pads frames with NULs

test('getinfo parses one channel with NUL padding', () => {
  const recs = proto.parseGetinfo(GETINFO_LINE);
  assert.equal(recs.length, 1);
  assert.deepEqual(recs[0], { n: 1, on: true, powerW: 2.3, energyKwh: 0.09, tempC: 28 });
});

test('getinfo parses 4 channels, skips channel 5 (aggregate)', () => {
  const line =
    'up:getinfo:' +
    [1, 2, 3, 4, 5]
      .map(
        (ch) =>
          `${ch}:100;${ch % 2 ? 'on' : 'off'};0;0;0;${ch}000;00000000;00000000;00000000;ok;00;2${ch}`
      )
      .join(';');
  const recs = proto.parseGetinfo(line);
  assert.equal(recs.length, 4);
  assert.deepEqual(recs.map((r) => r.n), [1, 2, 3, 4]);
});

test('power_report: mV above 50000, mA below stays unused (caller filters)', () => {
  assert.deepEqual(proto.matchPowerReport('up:power_report:1:231000'), { ch: 1, value: 231000 });
  assert.deepEqual(proto.matchPowerReport('up:power_report:1:150'), { ch: 1, value: 150 });
});

test('query carries rssi', () => {
  assert.equal(proto.matchQuery('up:query:-62'), -62);
});

test('event parses physical button presses', () => {
  assert.deepEqual(proto.matchEvent('up:event:onoff:3:on'), { ch: 3, on: true });
  assert.deepEqual(proto.matchEvent('up:event:onoff:0:off'), { ch: 0, on: false });
  assert.equal(proto.matchEvent('up:event:onoff:5:on'), null);
});

test('onoff acks recognised', () => {
  assert.equal(proto.isOnoffAck('up:onoff:2:off'), true);
  assert.equal(proto.isOnoffAck('up:event:onoff:2:off'), false);
});

// ---- provisioning protocol ----------------------------------------------------

test('ipv4 validation', () => {
  assert.equal(prov.isIpv4('192.168.1.14'), true);
  assert.equal(prov.isIpv4('10.0.0.1'), true);
  assert.equal(prov.isIpv4('256.1.1.1'), false);
  assert.equal(prov.isIpv4('1.2.3'), false);
  assert.equal(prov.isIpv4('powerk.local'), false);
});

test('SSID → password auto-derivation (the LGU_ rule)', () => {
  const full = prov.stripCodeToNetwork('TONLY_TAP_91C0C4C');
  assert.deepEqual(full, { ssid: 'TONLY_TAP_91C0C4C', password: 'LGU_91C0C4C' });
  const lower = prov.stripCodeToNetwork('tonly_tap_91c0c4c');
  assert.equal(lower.password, 'LGU_91C0C4C');
  const bare = prov.stripCodeToNetwork('91C0C4C');
  assert.deepEqual(bare, { ssid: 'TONLY_TAP_91C0C4C', password: 'LGU_91C0C4C' });
  assert.equal(prov.stripCodeToNetwork('TONLY_TAP_TOOLONGG'), null); // 8 chars
  assert.equal(prov.stripCodeToNetwork('TONLY_TAP_AB-12'), null); // bad charset
  assert.equal(prov.stripCodeToNetwork(''), null);
});

test('SSID/password charset: no colons or newlines', () => {
  assert.equal(prov.credsValid({ ssid: 'HOME', password: 'pw:1' }), false);
  assert.equal(prov.credsValid({ ssid: 'HOME\n', password: 'pw' }), false);
  assert.equal(prov.credsValid({ ssid: 'HOME', password: 'pw' }), true);
  assert.equal(prov.credsValid({ ssid: '', password: 'pw' }), false);
});

test('command builders', () => {
  assert.equal(prov.buildIpCommand('192.168.1.14'), 'up:ip:192.168.1.14');
  assert.equal(
    prov.buildConnectCommand({ ssid: 'HOME', password: 'pw' }),
    'up:connect:HOME:pw'
  );
});

// ---- hub (the in-app server) with a fake transport -----------------------------

function makeFakeStrip() {
  const sent = [];
  const transport = {
    ip: '192.168.1.77',
    send: (cmd) => sent.push(cmd),
    close: () => {},
  };
  return { sent, transport };
}

function getinfoFrame() {
  return (
    'up:getinfo:' +
    [1, 2, 3, 4]
      .map(
        (ch) =>
          `${ch}:100;${ch <= 2 ? 'on' : 'off'};0;0;0;${ch}500;00000000;00000000;00000000;ok;00;30`
      )
      .join(';')
  );
}

test('hub: bootinfo registers device and asks for state', () => {
  const conn = hub.openConnection('192.168.1.77', { ip: '192.168.1.77', send: () => {}, close: () => {} });
  conn.feed('up:bootinfo:lgutap;A493B91C0C4C;A493B91C0C4C;0.1.54-1.0.66;connect\r\n');
  assert.equal(hub.snapshot().strips.length, 1);
  const strip = hub.snapshot().strips[0];
  assert.equal(strip.name, 'MTTL 91C0C4C');
  assert.equal(strip.online, true);
  conn.closed();
  assert.equal(hub.snapshot().strips[0].online, false);
});

test('hub: full session — state, commands, events, offline', async () => {
  const { sent, transport } = makeFakeStrip();
  const conn = hub.openConnection(transport.ip, transport);
  const snapBefore = hub.snapshot().strips.length;

  conn.feed('up:bootinfo:lgutap;B493B91C0C4D;B493B91C0C4D;0.1.66;connect\r\n');
  assert.ok(sent.includes('up:getinfo:all'), 'refresh after bootinfo');
  assert.ok(hub.snapshot().strips.length >= snapBefore + 1);

  conn.feed(getinfoFrame() + '\r\n');
  let strip = hub.snapshot().strips.find((s) => s.mac === 'B493B91C0C4D');
  assert.equal(strip.outlets.filter((o) => o.on).length, 2);
  assert.equal(strip.powerW, 12); // per-channel W: 1.5 + 2.5 + 3.5 + 4.5
  assert.deepEqual(strip.outlets.map((o) => o.n), [1, 2, 3, 4]);

  // voltage + rssi diagnostics
  conn.feed('up:power_report:1:231000\r\n');
  conn.feed('up:query:-58\r\n');
  strip = hub.snapshot().strips.find((s) => s.mac === 'B493B91C0C4D');
  assert.equal(strip.voltage, 231.0);
  assert.equal(strip.rssi, -58);
  assert.equal(strip.currentA, Math.round((12 / 231) * 100) / 100);

  // command: turn all off → 4 onoff frames + settle + refresh
  await hub.setOutlet('B493B91C0C4D', 0, false);
  assert.deepEqual(
    sent.filter((c) => c.startsWith('up:onoff:')),
    ['up:onoff:1:off', 'up:onoff:2:off', 'up:onoff:3:off', 'up:onoff:4:off']
  );
  assert.equal(sent[sent.length - 1], 'up:getinfo:all');

  // acks are ignored, events update state (physical button)
  conn.feed('up:onoff:1:off\r\n');
  conn.feed('up:event:onoff:1:on\r\n');
  strip = hub.snapshot().strips.find((s) => s.mac === 'B493B91C0C4D');
  assert.equal(strip.outlets.find((o) => o.n === 1).on, true);

  // multiple strips: another strip joins, mac suffix disambiguates
  const conn2 = hub.openConnection('192.168.1.78', { ip: '192.168.1.78', send: () => {}, close: () => {} });
  conn2.feed('up:bootinfo:lgutap;C493B91C0C4E;C493B91C0C4E;0.1.66;connect\r\n');
  assert.equal(hub.snapshot().strips.length, snapBefore + 2);

  // re-connect: old session replaced, strip stays online
  const { transport: t3 } = makeFakeStrip();
  const conn3 = hub.openConnection('192.168.1.79', t3);
  conn3.feed('up:bootinfo:lgutap;B493B91C0C4D;B493B91C0C4D;0.1.66;connect\r\n');
  conn.closed(); // stale session drops
  strip = hub.snapshot().strips.find((s) => s.mac === 'B493B91C0C4D');
  assert.equal(strip.online, true, 'new session keeps strip online');

  conn2.closed();
  conn3.closed();
  assert.equal(hub.snapshot().strips.find((s) => s.mac === 'B493B91C0C4D').online, false);
});

test('hub: setOutlet on an offline strip rejects', async () => {
  await assert.rejects(() => hub.setOutlet('DEADBEEF0000', 1, true));
});
