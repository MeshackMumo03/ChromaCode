// The push hook must never load expo-notifications on an app binary that lacks
// its native code (older APKs still receive OTA updates). This loads
// hooks/useNotifications.ts with the native module lookup stubbed out.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../hooks/useNotifications.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
}).outputText;

function load({ os = 'android', environment = 'standalone', present = () => true } = {}) {
  const required = [];
  const fakeNotifications = { marker: 'expo-notifications' };
  const fakeDevice = { marker: 'expo-device', isDevice: true };
  const modules = {
    'expo-constants': { __esModule: true, default: { executionEnvironment: environment, expoConfig: {} } },
    expo: { requireOptionalNativeModule: (name) => (present(name) ? {} : null) },
    'expo-router': { useRouter: () => ({}) },
    react: { useEffect() {}, useRef: (v) => ({ current: v }), useState: (v) => [v, () => {}] },
    'react-native': { Platform: { OS: os } },
    '@/constants/api': { getBaseUrl: () => 'https://example.invalid/api' },
    './useAuth': { useAuth: () => ({}) },
    'expo-notifications': fakeNotifications,
    'expo-device': fakeDevice,
  };
  const context = {
    exports: {},
    console: { log() {}, warn() {} },
    require: (name) => {
      required.push(name);
      if (!(name in modules)) throw new Error(`unexpected require ${name}`);
      return modules[name];
    },
  };
  context.module = { exports: context.exports };
  vm.runInNewContext(compiled, context);
  return { hook: context.exports, required, fakeNotifications };
}

test('old APK without the native modules: never loads expo-notifications', () => {
  for (const missing of ['ExpoPushTokenManager', 'ExpoDevice', 'ExpoNotificationChannelManager']) {
    const { hook, required } = load({ present: (name) => name !== missing });
    assert.equal(hook.loadNotificationModules(), null, missing);
    assert.ok(!required.includes('expo-notifications'), `loaded expo-notifications although ${missing} is missing`);
    assert.ok(!required.includes('expo-device'));
  }
});

test('Expo Go and web: push stays off', () => {
  for (const options of [{ environment: 'storeClient' }, { os: 'web' }]) {
    const { hook, required } = load(options);
    assert.equal(hook.loadNotificationModules(), null);
    assert.ok(!required.includes('expo-notifications'));
  }
});

test('new APK with the native modules: loads expo-notifications', () => {
  const { hook, required, fakeNotifications } = load();
  const loaded = hook.loadNotificationModules();
  assert.equal(loaded.Notifications, fakeNotifications);
  assert.ok(required.includes('expo-notifications'));
});
