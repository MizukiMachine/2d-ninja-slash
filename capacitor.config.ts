import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mizuki2.ninjaslash',
  appName: 'Gekka no Shinobi',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
