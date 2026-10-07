import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fanmade.grimoiresquads',
  appName: 'Grimoire Squads',
  webDir: 'dist',
  backgroundColor: '#140f22',
  android: {
    // Fire OS (Amazon) devices run the same Android build — no Google Play Services needed.
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'never',
  },
};

export default config;
