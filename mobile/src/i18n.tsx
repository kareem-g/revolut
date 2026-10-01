import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

export type Lang = 'en' | 'ar' | null; // null follows the phone language

// Strings ported from android strings.xml (values + values-ar) plus the new
// provisioning flow. Arabic keeps the Egyptian dialect of the Android app.
const en = {
  app_name: 'powerk',
  tab_plugs: 'Plugs',
  tab_setup: 'Setup',
  tab_settings: 'Settings',
  splash_tagline: 'Local power control',

  strip_name: 'LG+ Power',
  strip_fw: 'fw %1$s',

  header_no_server: 'no server set',
  header_online: '%1$d online · %2$s',
  header_known_offline: '%1$d known · offline',
  header_waiting: 'waiting for the strip · %1$s',
  refresh: 'Refresh',
  connecting: 'Connecting to %1$s…',

  no_server_title: 'No server set',
  no_server_body:
    'Point powerk at the machine running powerk.py — your PC, a Raspberry Pi or a VPS.',
  no_strip_title: 'No strip connected',
  no_strip_body:
    "The strip dials the server itself. Check that it is powered, on a 2.4 GHz Wi-Fi network and provisioned with the server's IP.",
  open_settings: 'Open settings',

  turn_all_on: 'Turn all on',
  turn_all_off: 'Turn all off',
  outlet_n: 'Outlet %1$d',
  state_on: 'ON',
  state_off: 'OFF',
  tile_on_detail: '%1$s W · %2$d°C',
  tile_off_detail: '%1$d°C idle',
  watts_now: 'now',
  unit_watts: 'W',

  settings_title: 'Settings',
  server_title: 'Server',
  server_body:
    'Where powerk.py runs: your PC, a Raspberry Pi or a VPS. Add the token if the server is reachable from the internet.',
  field_host: 'Server IP or host',
  field_port: 'Port',
  field_token: 'Token',
  save: 'Save',
  test: 'Test',
  saved: 'Saved',
  connected_summary: 'Connected · %1$d strip(s), %2$d online',
  open_web_ui: 'Open web UI in browser',

  language_title: 'Language',
  lang_system: 'System',
  lang_english: 'English',
  lang_arabic: 'العربية',
  lang_rtl_note: 'Close and reopen the app to fully apply the layout direction.',

  command_failed: 'Command failed',
  connection_failed: 'Connection failed',
  command_failed_detail: 'Command failed — %1$s',
  connection_failed_detail: 'Connection failed — %1$s',
  http_error: 'HTTP %1$d',

  setup_title: 'First-time setup',
  setup_step_1:
    'Run powerk.py on the machine that stays on, and note the IP it prints.',
  setup_step_2: 'Enter that IP, port and token here, then press Test.',
  setup_step_3: 'Point the strip at that machine once:',
  setup_step_4:
    'Done — the strip connects on its own. No router DNS or port forwarding.',
  setup_footer: 'This app talks to the same JSON API as the web UI.',
  setup_use_app:
    'No PC handy? This app can provision the strip itself — open the Setup tab.',
  web_no_provision:
    'Provisioning needs the mobile app, which joins the strip’s setup Wi‑Fi and sends its credentials. From the browser, run the powerk.py provision command instead.',

  // ---- Connection modes ----------------------------------------------------
  mode_title: 'Mode',
  mode_direct: 'Built-in server',
  mode_server: 'External server',
  mode_direct_desc:
    'This phone IS the server. The strip dials it on your Wi‑Fi — no PC, no VPS, nothing to install.',
  mode_server_desc:
    'A powerk.py running on a PC, Raspberry Pi or VPS. Slower to set up, but works 24/7 and from anywhere.',
  direct_running: 'This phone is the server · port %1$d',
  direct_ip: 'Phone IP: %1$s',
  direct_ip_changed:
    'Phone IP changed since provisioning (%1$s). Re-provision in the Setup tab, or give the phone a DHCP reservation.',
  direct_hint:
    'Works while this app is open on the same Wi‑Fi as the strip. For 24/7 or away-from-home control, switch to an external powerk.py server.',
  direct_failed: 'Could not open port 10086 — is another powerk server running?',
  direct_host_label: 'this phone',
  direct_waiting_first: 'waiting for the strip to dial in…',

  // ---- Provisioning wizard -------------------------------------------------
  prov_title: 'Provision a strip',
  prov_intro:
    'Writes your server IP and home Wi-Fi into the strip — the same thing `powerk.py provision` does, no PC needed.',
  prov_step_server: 'Server',
  prov_step_strip: 'Strip code',
  prov_step_wifi: 'Home Wi-Fi',
  prov_step_join: 'Join the strip',
  prov_step_send: 'Provision',
  prov_step_done: 'Done',

  prov_server_label: 'Server IP (IPv4)',
  prov_server_hint:
    'The IP powerk.py prints when it starts — your LAN IP (Mode A) or the VPS public IP (Mode B).',
  prov_server_hint_direct:
    'This phone’s Wi‑Fi IP, filled in automatically. The strip dials it on port 10086.',
  prov_strip_label: 'Strip Wi‑Fi name (or its 7 characters)',
  prov_strip_hint:
    'The strip announces Wi‑Fi “TONLY_TAP_XXXXXXX”. Type the name from the sticker or from Settings › Wi‑Fi — the password LGU_XXXXXXX is derived from it automatically.',
  prov_password_derived: 'Password (derived automatically)',
  prov_ssid_preview: 'Will join: %1$s',
  prov_wifi_ssid: 'Home Wi-Fi name (SSID)',
  prov_wifi_password: 'Home Wi-Fi password',
  prov_wifi_hint:
    'The network the strip should join. It must be 2.4 GHz — the strip cannot see 5 GHz networks.',
  prov_wifi_stored: 'Saved on this phone — no need to retype.',
  prov_join_auto: 'Join automatically',
  prov_join_manual: 'I’ll join manually in Wi‑Fi settings',
  prov_open_wifi_settings: 'Open Wi‑Fi settings',
  prov_detecting: 'Waiting for the strip network…',
  prov_detected: 'On the strip network — sending credentials…',
  prov_next: 'Next',
  prov_back: 'Back',
  prov_start: 'Start provisioning',
  prov_join_button: 'Join %1$s',
  prov_joining: 'Joining %1$s…',
  prov_send_button: 'Send to strip',
  prov_sending: 'Provisioning…',
  prov_check_button: 'Check the server',
  prov_checking: 'Checking…',

  prov_hold_button:
    'Hold the strip’s main button ~10 s until the LED blinks fast. It then broadcasts its setup network.',
  prov_join_note_ios:
    'iOS will ask to join the network — approve it. The phone leaves your home Wi‑Fi for a minute; that is expected.',
  prov_join_note_android:
    'Android may need location services on to switch networks. Approve the location prompt if it appears.',
  prov_send_note:
    'The phone must still be on the strip’s setup network. Commands go to 192.168.1.1:30300, one connection per line — exactly like powerk.py.',
  prov_done_title: 'Strip provisioned',
  prov_done_body:
    'The strip stores your server IP now. Rejoin your home Wi‑Fi, then give the strip ~20 s to dial in.',
  prov_rejoin_button: 'Rejoin home Wi‑Fi now',
  prov_rejoining: 'Rejoining %1$s…',
  prov_rejoin_failed:
    'Could not switch automatically — open Settings › Wi‑Fi and pick your network.',
  prov_check_found: 'Strip is online and talking to the server.',
  prov_check_offline: 'Server reachable, strip not dialled in yet. Wait a bit and check again.',
  prov_check_none: 'Server reachable, no strips connected yet.',
  prov_check_failed: 'Could not reach the server — rejoin your home Wi‑Fi first.',

  err_ipv4: 'Enter a valid IPv4 address',
  err_code: 'Use the full name like TONLY_TAP_XXXXXXX, or its 7 characters',
  err_wifi_chars: 'Wi‑Fi name and password cannot contain “:” or newlines',
  err_wifi_empty: 'Enter the Wi‑Fi name and password',
  err_not_on_strip_network:
    'Not reachable. Is the LED blinking fast? Is the phone on %1$s?',
  err_no_native:
    'Provisioning needs the full app — this Expo Go build has no raw TCP access. Use powerk.py provision on a PC instead.',
  err_strip_answered: 'Strip answered %1$s, expected %2$s',
  err_join: 'Could not join the strip network — %1$s',

  log_connected: 'connected to %1$s',
  log_sent: '→ %1$s',
  log_got: '← %1$s',
  log_timeout: 'timed out waiting for the strip',
  log_refused: 'not reachable — retrying (%1$s)',
  log_closed: 'connection closed',

  common_ok: 'OK',
  common_cancel: 'Cancel',
  common_retry: 'Retry',
  common_error: 'Error',
};

export type Dict = typeof en;

const ar: Dict = {
  app_name: 'powerk',
  tab_plugs: 'الفاش',
  tab_setup: 'الإعداد',
  tab_settings: 'الإعدادات',
  splash_tagline: 'تحكم في الكهربا من عندك',

  strip_name: 'المشترك الكوري',
  strip_fw: 'الإصدار %1$s',

  header_no_server: 'مفيش سيرفر متحدد',
  header_online: '‏%1$d متصل · %2$s',
  header_known_offline: '‏%1$d معروف · مش متصل',
  header_waiting: 'مستني المشترك · %1$s',
  refresh: 'تحديث',
  connecting: 'جاري الاتصال بـ %1$s…',

  no_server_title: 'مفيش سيرفر متحدد',
  no_server_body:
    'وجّه powerk للجهاز اللي شغّال عليه powerk.py — كمبيوتر، Raspberry Pi أو سيرفر VPS.',
  no_strip_title: 'مفيش مشترك متصل',
  no_strip_body:
    'المشترك بيتصل بالسيرفر لوحده. اتأكد إنه متوصل بالكهربا، وعلى واي فاي 2.4 جيجاهرتز، ومتظبط على عنوان IP بتاع السيرفر.',
  open_settings: 'افتح الإعدادات',

  turn_all_on: 'شغّلهم كلهم',
  turn_all_off: 'اطفيهم كلهم',
  outlet_n: 'الفاشة %1$d',
  state_on: 'شغالة',
  state_off: 'مقفولة',
  tile_on_detail: '%1$s وات · %2$d°',
  tile_off_detail: '%1$d° · مش واصلالها كهربا',
  watts_now: 'دلوقتي',
  unit_watts: 'وات',

  settings_title: 'الإعدادات',
  server_title: 'السيرفر',
  server_body:
    'المكان اللي شغّال عليه powerk.py: كمبيوتر، Raspberry Pi أو سيرفر VPS. ضيف الـ Token لو السيرفر متاح من على الإنترنت.',
  field_host: 'عنوان IP أو اسم السيرفر',
  field_port: 'المنفذ',
  field_token: 'الـ Token',
  save: 'حفظ',
  test: 'اختبار',
  saved: 'اتحفظ',
  connected_summary: 'متصل · %1$d مشترك، %2$d متصل',
  open_web_ui: 'افتح الواجهة في المتصفح',

  language_title: 'اللغة',
  lang_system: 'تلقائي',
  lang_english: 'English',
  lang_arabic: 'العربية',
  lang_rtl_note: 'اقفل التطبيق وافتحه تاني عشان اتجاه الشاشة يتظبط بالكامل.',

  command_failed: 'الأمر فشل',
  connection_failed: 'الاتصال فشل',
  command_failed_detail: 'الأمر فشل — %1$s',
  connection_failed_detail: 'الاتصال فشل — %1$s',
  http_error: 'HTTP %1$d',

  setup_title: 'الإعداد لأول مرة',
  setup_step_1:
    'شغّل powerk.py على الجهاز اللي هيفضل شغّال، وسجّل عنوان الـ IP اللي هيظهرلك.',
  setup_step_2: 'اكتب العنوان والمنفذ والـ Token هنا، وبعد كده دوس اختبار.',
  setup_step_3: 'وجّه المشترك للجهاز ده مرة واحدة:',
  setup_step_4:
    'كده خلصنا — المشترك هيتصل لوحده. مش محتاج تغيّر DNS الراوتر ولا تفتح أي منافذ.',
  setup_footer: 'التطبيق بيستخدم نفس واجهة JSON اللي بتستخدمها واجهة الويب.',
  setup_use_app: 'مفيش كمبيوتر؟ التطبيق نفسه يقدر يظبط المشترك — افتح تاب الإعداد.',
  web_no_provision:
    'الإعداد محتاج تطبيق الموبايل، اللي بيقدر يدخل على شبكة المشترك ويبعت بياناتها. من المتصفح، شغّل أمر powerk.py provision بداله.',

  mode_title: 'النمط',
  mode_direct: 'سيرفر مدمج',
  mode_server: 'سيرفر خارجي',
  mode_direct_desc:
    'الموبايل نفسه هو السيرفر. المشترك بيتصل بيه على الواي فاي — من غير كمبيوتر ولا VPS ولا أي تثبيت.',
  mode_server_desc:
    '‏powerk.py شغّال على كمبيوتر أو Raspberry Pi أو VPS. إعداده أصعب، بس بيشتغل 24 ساعة ومن أي مكان.',
  direct_running: 'الموبايل ده هو السيرفر · المنفذ %1$d',
  direct_ip: '‏IP الموبايل: %1$s',
  direct_ip_changed:
    'عنوان IP بتاع الموبايل اتغيّر بعد الإعداد (%1$s). اعمل إعداد تاني من تاب الإعداد، أو احجز IP ثابت للموبايل.',
  direct_hint:
    'بيشتغل طول ما التطبيق مفتوح على نفس واي فاي المشترك. للتحكم 24 ساعة أو من برّه البيت، استخدم سيرفر powerk.py خارجي.',
  direct_failed: 'معرفش أفتح المنفذ 10086 — في سيرفر powerk تاني شغّال؟',
  direct_host_label: 'الموبايل ده',
  direct_waiting_first: 'مستني المشترك يتصل…',

  prov_title: 'ظبّط مشترك',
  prov_intro:
    'بيكتب عنوان السيرفر وواي فاي البيت جوّه المشترك — نفس اللي بيعمله `powerk.py provision`، من غير كمبيوتر.',
  prov_step_server: 'السيرفر',
  prov_step_strip: 'كود المشترك',
  prov_step_wifi: 'واي فاي البيت',
  prov_step_join: 'ادخل على المشترك',
  prov_step_send: 'الإرسال',
  prov_step_done: 'خلصنا',

  prov_server_label: 'عنوان السيرفر (IPv4)',
  prov_server_hint:
    'العنوان اللي powerk.py بيطلعه أول ما يشتغل — الـ IP بتاعك على الشبكة (Mode A) أو عنوان الـ VPS (Mode B).',
  prov_server_hint_direct:
    '‏IP الموبايل على الواي فاي، بيتعبّى لوحده. المشترك هيتصل بيه على المنفذ 10086.',
  prov_strip_label: 'اسم واي فاي المشترك (أو الـ 7 حروف بتوعه)',
  prov_strip_hint:
    'المشترك بيعلن عن شبكة “TONLY_TAP_XXXXXXX”. اكتب الاسم من الملصق أو من الإعدادات › Wi‑Fi — والباسورد LGU_XXXXXXX بيتولّد منه لوحده.',
  prov_password_derived: 'الباسورد (متولّد تلقائي)',
  prov_ssid_preview: 'هيدخل على: %1$s',
  prov_wifi_ssid: 'اسم واي فاي البيت (SSID)',
  prov_wifi_password: 'باسورد واي فاي البيت',
  prov_wifi_hint:
    'الشبكة اللي المشترك المفروض يدخل عليها. لازم تكون 2.4 جيجاهرتز — المشترك مش شايف شبكات 5 جيجاهرتز.',
  prov_wifi_stored: 'محفوظة في الموبايل — مش محتاج تكتبها تاني.',
  prov_join_auto: 'ادخل تلقائي',
  prov_join_manual: 'هدخل بنفسي من إعدادات الواي فاي',
  prov_open_wifi_settings: 'افتح إعدادات الواي فاي',
  prov_detecting: 'مستني شبكة المشترك…',
  prov_detected: 'على شبكة المشترك — ببعت البيانات…',
  prov_next: 'التالي',
  prov_back: 'رجوع',
  prov_start: 'ابدأ الإعداد',
  prov_join_button: 'ادخل على %1$s',
  prov_joining: 'بيدخل على %1$s…',
  prov_send_button: 'ابعت للمشترك',
  prov_sending: 'جاري الإعداد…',
  prov_check_button: 'اتأكد من السيرفر',
  prov_checking: 'جاري التأكد…',

  prov_hold_button:
    'دوس على زرار المشترك الرئيسي حوالي 10 ثواني لحد ما اللمبة تلمع بسرعة. ساعتها هيفتح شبكة الإعداد بتاعته.',
  prov_join_note_ios:
    'الآيفون هيسألك تدخل على الشبكة — وافق. الموبايل هيخرج من واي فاي البيت لدقيقة، ده طبيعي.',
  prov_join_note_android:
    'أندرويد ممكن يحتاج خدمة الموقع مفتوحة عشان يبدّل الشبكات. وافق على إشعار الموقع لو ظهر.',
  prov_send_note:
    'لازم الموبايل لسه واقف على شبكة الإعداد بتاعة المشترك. الأوامر بتروح على 192.168.1.1:30300، كل سطر في اتصال لوحده — زي powerk.py بالظبط.',
  prov_done_title: 'المشترك اتظبط',
  prov_done_body:
    'المشترك حفظ عنوان السيرفر دلوقتي. ارجع لواي فاي البيت، واستنى حوالي 20 ثانية المشترك يتصل.',
  prov_rejoin_button: 'ارجع لواي فاي البيت دلوقتي',
  prov_rejoining: 'برجع لـ %1$s…',
  prov_rejoin_failed:
    'معرفتش أبدّل تلقائي — افتح الإعدادات › Wi‑Fi واختار شبكتك.',
  prov_check_found: 'المشترك متصل وبيكلّم السيرفر.',
  prov_check_offline: 'السيرفر شغّال، بس المشترك لسه معندش. استنى شوية واتأكد تاني.',
  prov_check_none: 'السيرفر شغّال، بس مفيش أي مشتراكات متصلة.',
  prov_check_failed: 'معرفش أوصل للسيرفر — ارجع لواي فاي البيت الأول.',

  err_ipv4: 'اكتب عنوان IPv4 صحيح',
  err_code: 'اكتب الاسم كامل زي TONLY_TAP_XXXXXXX أو الـ 7 حروف بتوعه',
  err_wifi_chars: 'اسم الواي فاي والباسورد مينفعش فيهم “:” ولا سطر جديد',
  err_wifi_empty: 'اكتب اسم الواي فاي والباسورد',
  err_not_on_strip_network:
    'مش واصل. اللمبة بتنعّ بسرعة؟ والموبايل واقف على %1$s؟',
  err_no_native:
    'الإعداد محتاج التطبيق الكامل — نسخة Expo Go دي مالهاش وصول TCP مباشر. استخدم powerk.py provision من الكمبيوتر بدالها.',
  err_strip_answered: 'المشترك رد %1$s، المتوقع %2$s',
  err_join: 'معرفش أدخل على شبكة المشترك — %1$s',

  log_connected: 'اتصلت بـ %1$s',
  log_sent: '→ %1$s',
  log_got: '← %1$s',
  log_timeout: 'المشترك مردّش في الوقت',
  log_refused: 'مش واصل — بجرب تاني (%1$s)',
  log_closed: 'الاتصال اتقفل',

  common_ok: 'تمام',
  common_cancel: 'إلغاء',
  common_retry: 'جرب تاني',
  common_error: 'خطأ',
};

const dicts: Record<'en' | 'ar', Dict> = { en, ar };

type Params = (string | number)[];

export function translate(lang: 'en' | 'ar', key: keyof Dict, ...params: Params): string {
  const template = dicts[lang][key] ?? dicts.en[key] ?? String(key);
  return template.replace(/%(\d+)\$[sd]/g, (_, i) => String(params[Number(i) - 1] ?? ''));
}

interface I18n {
  lang: Lang;
  /** resolved language after falling back to the device locale */
  resolved: 'en' | 'ar';
  setLang: (l: Lang) => void;
  t: (key: keyof Dict, ...params: Params) => string;
  isRTL: boolean;
  /** true when the chosen language needs a restart to flip the layout */
  rtlPending: boolean;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(null);

  useEffect(() => {
    AsyncStorage.getItem('lang').then((v) =>
      setLangState(v === 'en' || v === 'ar' ? v : null),
    );
  }, []);

  const deviceArabic = useMemo(
    () =>
      Localization.getLocales().some((l) => (l.languageCode ?? '').startsWith('ar')),
    [],
  );

  const resolved = lang ?? (deviceArabic ? 'ar' : 'en');
  const setLang = (l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem('lang', l ?? '');
  };

  const value = useMemo<I18n>(
    () => ({
      lang,
      resolved,
      setLang,
      t: (key, ...params) => translate(resolved, key, ...params),
      isRTL: resolved === 'ar',
      rtlPending: false,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, resolved],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(I18nContext);
  if (!v) throw new Error('useI18n outside provider');
  return v;
}
