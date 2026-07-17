export const environment = {
  production: false,
  apiUrl: 'http://localhost:3001',
  socketUrl: 'http://localhost:3001',
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
