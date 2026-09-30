# powerk mobile — the React Native app (iOS + Android)

One app, two modes, Arabic + English:

| | |
|---|---|
| **Built-in server (direct)** | the phone **is** the powerk server — it listens on TCP **10086**, the strip dials it on your home Wi-Fi. No PC, no VPS, nothing else to install. |
| **External server** | client of a `powerk.py` on a PC / Raspberry Pi / VPS (same JSON API as the Android app) — use it for 24/7 control or from anywhere. |
| **Setup tab** | provisions strips entirely from the phone: joins the strip's own `TONLY_TAP_…` Wi-Fi (password `LGU_…` is derived from the name automatically), detects the connection, then sends `up:ip:` + `up:connect:` to `192.168.1.1:30300` — exactly what `powerk.py provision` does, no PC needed. |

The in-app server is a 1:1 port of `powerk.py`'s session logic (`bootinfo`, `getinfo`,
`power_report`, `query`, `event`, 5 s polling, diagnostics every 3rd poll, one
command transaction per strip) — multiple strips supported.

**Direct-mode limits (honest ones):** iOS suspends sockets when an app sits in the
background, and a phone's DHCP IP can change — the strip dials the phone only while
the app is open on the same Wi-Fi, and the app warns when its IP no longer matches
what the strip was provisioned with (re-provisioning is two taps; credentials are
stored). For 24/7 / away-from-home control, switch to an external `powerk.py` in
Settings › Mode.

## Build the IPA

**With GitHub Actions (no Mac needed):** push this folder to GitHub —
`.github/workflows/ios.yml` builds `powerk.ipa` on a macOS runner and uploads it as
an artifact on every push to `main` (or from the Actions tab → *ios-ipa* → *Run
workflow*). Unsigned by default: install it with Xcode/Sideloadly/AltStore, or add
the repo secrets listed at the top of the workflow file (`BUILD_CERTIFICATE_BASE64`,
`P12_PASSWORD`, `BUILD_PROVISION_PROFILE_BASE64`, `KEYCHAIN_PASSWORD`) to get a
signed IPA.

**With a Mac:** `npm ci`, then:

```bash
npx expo prebuild --platform ios
cd ios && pod install
open powerk.xcworkspace   # Xcode → sign with your Apple ID → Run / Product › Archive
```

iOS capabilities this app uses (already configured in `app.json`): **Local
Network** usage description, **Hotspot Configuration** entitlement (joining the
strip's setup network), **ATS exception** for plain-HTTP servers, and **Location
when in use** (network detection during provisioning).

## Develop

```bash
npm install --legacy-peer-deps
npx expo start          # Metro; run on a device/simulator with expo run:ios|android
npm run typecheck       # tsc
npm test                # wire-protocol + hub tests (node)
```

Native modules: `react-native-tcp-socket` (server + provisioning client),
`react-native-wifi-reborn` (Wi-Fi join), `react-native-reanimated` + `react-native-svg`
(power ring, tiles, splash), `@react-native-community/netinfo` (phone IP),
`expo-haptics`, `expo-localization`.
