// Exclude legacy (pre-new-architecture) native modules from the iOS build.
// react-native-tcp-socket and react-native-wifi-reborn have no TurboModule
// codegen and crash at launch under RN 0.86's new architecture on iOS. Their
// JS is already stubbed (src/native.ts / src/wifi.ts), so the app degrades to
// server mode + no in-app provisioning until these are replaced with new-arch
// modules. Android keeps them (they work there via the interop layer).
module.exports = {
  dependencies: {
    'react-native-tcp-socket': {
      platforms: { ios: null },
    },
    'react-native-wifi-reborn': {
      platforms: { ios: null },
    },
  },
};