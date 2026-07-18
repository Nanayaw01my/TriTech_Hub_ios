import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tritechhub.app',
  appName: 'TriTech Hub',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // OTA live updates — the app asks our own server if a newer UI bundle
    // exists, downloads it, and applies it on next launch. Publish a new
    // bundle with the "Publish OTA Update" GitHub Action.
    CapacitorUpdater: {
      autoUpdate: true,
      updateUrl: 'https://tritechhub.online/api/app/updates',
      resetWhenUpdate: true,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
    },
  },
};

export default config;
