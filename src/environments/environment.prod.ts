export const environment = {
  production: true,
  apiUrl: 'https://smiling-winny-dannieldev-596bcab2.koyeb.app',
  socketUrl: 'https://smiling-winny-dannieldev-596bcab2.koyeb.app',
  discordClientId: '1503499096659591218',
  discordActivityEnabled: true,
  peerConfig: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ],
  },
} as const;
