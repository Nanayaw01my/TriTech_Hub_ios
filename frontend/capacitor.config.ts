import type { CapacitorConfig } from '@capacitor/cli';

// The app is a thin native shell that loads the LIVE web app. Every Render
// redeploy updates everyone's app instantly — no app-store or OTA publishing.
// Override the address at build time with CAP_SERVER_URL if the domain changes.
const LIVE_URL = process.env.CAP_SERVER_URL || 'https://dandorsolar.site';

const config: CapacitorConfig = {
  appId: 'com.dandorsolar.app',
  appName: 'Dan & Dor Solar',
  // Still required by Capacitor; holds a tiny offline fallback page.
  webDir: 'dist',
  server: {
    url: LIVE_URL,
    androidScheme: 'https',
    cleartext: false,
    // Shown (from the APK) when the live site can't be reached — no internet.
    errorPath: 'offline.html',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
