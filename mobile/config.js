import { Platform } from 'react-native';

// Default IP per environment:
//   Web browser   → 127.0.0.1 (backend on same machine)
//   Android emu   → 10.0.2.2  (host machine from inside emulator)
//   iOS simulator → 127.0.0.1
//   Physical device → your machine's LAN IP
//     Windows : run `ipconfig`  → "IPv4 Address" under your Wi-Fi adapter
//     Mac/Linux: run `ifconfig` → inet on en0 (Mac) or wlan0 (Linux)
export const CONFIG = {
  SERVER_IP: Platform.OS === 'web' ? '127.0.0.1' : '10.0.2.2',
  PORT: '8091',
  API_PREFIX: '/api/v1',
};
