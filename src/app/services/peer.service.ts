import { Injectable, NgZone, signal } from '@angular/core';
import Peer, { MediaConnection } from 'peerjs';
import { SocketService } from './socket.service';

export interface PeerUser {
  peerId: string;
  sessionId: string;
  stream?: MediaStream;
}

export interface PeerSignalPayload {
  from: string;
  to: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  data: unknown;
}

@Injectable({ providedIn: 'root' })
export class PeerService {
  private peer: Peer | null = null;
  private mediaStream: MediaStream | null = null;
  private connections = new Map<string, MediaConnection>();

  readonly peerId = signal<string | null>(null);
  readonly isInitialized = signal(false);
  readonly localStream = signal<MediaStream | null>(null);
  readonly remoteStreams = signal<Map<string, MediaStream>>(new Map());
  readonly error = signal<string | null>(null);

  readonly isAudioMuted = signal(false);
  readonly isVideoMuted = signal(false);

  constructor(private socketService: SocketService, private ngZone: NgZone) {
    this.setupSocketListeners();
  }

  async initialize(sessionId: string): Promise<void> {
    if (this.isInitialized()) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer(`${sessionId}-${Date.now()}`);

        this.peer.on('open', (id) => {
          this.peerId.set(id);
          this.isInitialized.set(true);
          resolve();
        });

        this.peer.on('call', (call) => {
          this.handleIncomingCall(call);
        });

        this.peer.on('error', (err) => {
          this.error.set(`PeerJS error: ${err.message}`);
          console.error('PeerJS error:', err);
          // Only reject if it happens during initialization
          if (!this.isInitialized()) {
            reject(err);
          }
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error inicializando PeerJS';
        this.error.set(message);
        reject(err);
      }
    });
  }

  /**
   * Obtiene el stream local de cámara/micrófono
   */
  async getLocalStream(): Promise<MediaStream> {
    if (this.mediaStream) {
      return this.mediaStream;
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
        },
      });

      this.localStream.set(this.mediaStream);
      this.isAudioMuted.set(false);
      this.isVideoMuted.set(false);
      return this.mediaStream;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo acceder a cámara/micrófono';
      this.error.set(message);
      throw err;
    }
  }

  toggleAudio(): void {
    if (this.mediaStream) {
      const audioTracks = this.mediaStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      this.isAudioMuted.set(audioTracks.some(t => !t.enabled));
    }
  }

  toggleVideo(): void {
    if (this.mediaStream) {
      const videoTracks = this.mediaStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      this.isVideoMuted.set(videoTracks.some(t => !t.enabled));
    }
  }

  /**
   * Llama a otro peer
   */
  async callPeer(remotePeerId: string): Promise<void> {
    console.log(`[PeerService] Initiating call to: ${remotePeerId}`);
    if (!this.peer || !this.mediaStream) {
      console.error('[PeerService] No inicializado o sin stream local al llamar');
      throw new Error('PeerService no inicializado o sin stream local');
    }

    try {
      const call = this.peer.call(remotePeerId, this.mediaStream);
      this.connections.set(remotePeerId, call);
      console.log(`[PeerService] Call created for ${remotePeerId}`);

      call.on('stream', (remoteStream) => {
        console.log(`[PeerService] Received stream from ${remotePeerId} via call`);
        this.updateRemoteStream(remotePeerId, remoteStream);
      });

      call.on('close', () => {
        console.log(`[PeerService] Call closed by ${remotePeerId}`);
        this.closeConnection(remotePeerId);
      });

      call.on('error', (err) => {
        console.error(`[PeerService] Error en llamada a ${remotePeerId}:`, err);
        this.closeConnection(remotePeerId);
      });
    } catch (err) {
      console.error(`[PeerService] Excepción al llamar a ${remotePeerId}:`, err);
      const message = err instanceof Error ? err.message : `Error llamando a ${remotePeerId}`;
      this.error.set(message);
      throw err;
    }
  }

  /**
   * Cierra una conexión específica
   */
  closeConnection(remotePeerId: string): void {
    console.log(`[PeerService] Closing connection to ${remotePeerId}`);
    this.ngZone.run(() => {
      const connection = this.connections.get(remotePeerId);
      if (connection) {
        connection.close();
        this.connections.delete(remotePeerId);
      }

      const streams = this.remoteStreams();
      if (streams.has(remotePeerId)) {
        streams.delete(remotePeerId);
        this.remoteStreams.set(new Map(streams));
      }
    });
  }

  /**
   * Cierra todas las conexiones y libera recursos
   */
  disconnect(): void {
    console.log('[PeerService] Disconnecting all');
    this.connections.forEach((conn) => conn.close());
    this.connections.clear();

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
      this.localStream.set(null);
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.isInitialized.set(false);
    this.peerId.set(null);
    this.remoteStreams.set(new Map());
    this.isAudioMuted.set(false);
    this.isVideoMuted.set(false);
  }

  /**
   * Maneja llamadas entrantes
   */
  private handleIncomingCall(call: MediaConnection): void {
    console.log(`[PeerService] Incoming call from: ${call.peer}`);
    if (!this.mediaStream) {
      console.warn(`[PeerService] No local stream to answer call from ${call.peer}`);
      call.close();
      return;
    }

    this.connections.set(call.peer, call);
    console.log(`[PeerService] Answering call from ${call.peer}`);
    call.answer(this.mediaStream);

    call.on('stream', (remoteStream) => {
      console.log(`[PeerService] Received stream from ${call.peer} via answer`);
      this.updateRemoteStream(call.peer, remoteStream);
    });

    call.on('close', () => {
      console.log(`[PeerService] Incoming call closed by ${call.peer}`);
      this.closeConnection(call.peer);
    });

    call.on('error', (err) => {
      console.error(`[PeerService] Error en llamada entrante de ${call.peer}:`, err);
      this.closeConnection(call.peer);
    });
  }

  /**
   * Actualiza el stream remoto de un peer
   */
  private updateRemoteStream(remotePeerId: string, stream: MediaStream): void {
    console.log(`[PeerService] updateRemoteStream for ${remotePeerId}`);
    this.ngZone.run(() => {
      const streams = this.remoteStreams();
      // Verificamos si ya tenemos el stream exacto para no hacer updates innecesarios
      if (streams.get(remotePeerId) !== stream) {
        console.log(`[PeerService] Adding/Updating stream for ${remotePeerId} in Map`);
        streams.set(remotePeerId, stream);
        this.remoteStreams.set(new Map(streams));
      } else {
        console.log(`[PeerService] Stream for ${remotePeerId} already exists and is identical`);
      }
    });
  }

  /**
   * Configura listeners para eventos Socket.IO de signaling
   */
  private setupSocketListeners(): void {
    this.socketService.on<PeerSignalPayload>('peerSignal').subscribe((payload) => {
      this.handlePeerSignal(payload);
    });

    this.socketService.on<string>('peerUserLeft').subscribe((remotePeerId) => {
      console.log(`[PeerService] socket peerUserLeft: ${remotePeerId}`);
      this.closeConnection(remotePeerId);
    });

    this.socketService.on<{ fromPeerId: string; fromSessionId: string }>('peerCallSignal').subscribe((payload) => {
      console.log(`[PeerService] socket peerCallSignal from: ${payload.fromPeerId}`);
      // If we are initialized and have a local stream, call the new peer!
      if (this.isInitialized() && this.localStream() && payload.fromPeerId !== this.peerId()) {
        console.log(`[PeerService] Will auto-call ${payload.fromPeerId}`);
        this.callPeer(payload.fromPeerId).catch((err) => {
          console.error('[PeerService] Error auto-calling peer:', err);
        });
      } else {
        console.warn(`[PeerService] Ignored peerCallSignal. initialized: ${this.isInitialized()}, localStream: ${!!this.localStream()}, isSelf: ${payload.fromPeerId === this.peerId()}`);
      }
    });
  }

  /**
   * Maneja señales de signaling (para futuro uso si necesitas SFU)
   */
  private handlePeerSignal(payload: PeerSignalPayload): void {
    // Placeholder para lógica de signaling avanzada
    console.log('[PeerService] Peer signal received:', payload);
  }

  /**
   * Emite señal al servidor para contactar otro peer o a toda la sala
   */
  emitCallSignal(targetSessionId?: string): void {
    if (!this.peerId()) {
      throw new Error('PeerJS no inicializado');
    }

    console.log(`[PeerService] emitCallSignal with fromPeerId: ${this.peerId()}`);
    this.socketService.emit('peerCallRequest', {
      fromPeerId: this.peerId(),
      toSessionId: targetSessionId,
    });
  }
}
