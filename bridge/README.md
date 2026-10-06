# powerk bridge

Tiny always-on service that lives at home (Raspberry Pi, old laptop, mini PC, even an
old Android phone via Termux). It terminates the strip's TCP session and relays to
powerk cloud — **outbound only**, so nothing needs to be opened on your router.
Zero dependencies, Node 18+.

## 1. Pair (once)

On the dashboard: *Bridge → Pair a new bridge* → copy the code, then:

```bash
npx powerk-bridge --pair ABCD-1234 --url https://your-app.vercel.app
# or from this folder: node bridge.js --pair ABCD-1234 --url https://your-app.vercel.app
```

This writes `bridge.json` (URL + permanent token) next to `bridge.js`.

## 2. Provision the strip with this machine's LAN IP

Hold the strip's button ~10 s, join `TONLY_TAP_XXXXXXX` from a laptop, then either
the mobile app's Setup tab (Server IP = this machine's LAN IP) or:

```bash
npx powerk-provision --ip <bridge-lan-ip> --ssid "MyWiFi" --password "…"
```

Give this machine a DHCP reservation so the IP never changes.

## 3. Keep it running

```bash
node bridge.js                      # foreground
```

systemd (Linux):

```ini
# /etc/systemd/system/powerk-bridge.service
[Unit]
Description=powerk bridge
After=network-online.target

[Service]
WorkingDirectory=/home/pi/powerk-bridge
ExecStart=/usr/bin/node bridge.js
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now powerk-bridge
```

Termux (Android): `pkg install nodejs`, then `nohup node bridge.js &` plus
`termux-wake-lock`.

## What it does

- listens on TCP **10086** for strips; speaks the `up:` protocol
- pushes state to the cloud (heartbeat every 5 s)
- polls the command queue every second (cloud → bridge → strip)
- **executes schedules and voltage rules locally** — they keep working even if the
  internet or the cloud is briefly down
