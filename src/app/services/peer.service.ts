import { Injectable, NgZone, signal } from '@angular/core';
import Peer, { MediaConnection } from 'peerjs';
import { Subscription } from 'rxjs';
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
  private socketSubscriptions: Subscription[] = [];
  private frozenCheckInterval: ReturnType<typeof setInterval> | null = null;

  readonly peerId = signal<string | null>(null);
  readonly isInitialized = signal(false);
  readonly localStream = signal<MediaStream | null>(null);
  readonly remoteStreams = signal<Map<string, MediaStream>>(new Map());
  readonly error = signal<string | null>(null);

  /** Signals para controlar silenciado de peers remotos (DM feature) */
  readonly mutedRemotePeers = signal<Set<string>>(new Set());

  readonly isAudioMuted = signal(false);
  readonly isVideoMuted = signal(false);

  constructor(
    private socketService: SocketService,
    private ngZone: NgZone,
  ) {}

  async initialize(sessionId: string): Promise<void> {
    if (this.isInitialized()) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer(`${sessionId}-${Date.now()}`);

        this.peer.on('open', (id) => {
          this.peerId.set(id);
          this.setupSocketListeners();
          this.isInitialized.set(true);
          this.startFrozenStreamWatcher();
          resolve();
        });

        this.peer.on('call', (call) => {
          this.handleIncomingCall(call);
        });

        this.peer.on('error', (err) => {
          const msg = `PeerJS error: ${err.message}`;
          this.error.set(msg);
          console.error('PeerJS error:', err);

          // Auto-reload si se pierde conexión con el servidor de señalización
          if (
            err.message?.toLowerCase().includes('lost connection') ||
            err.message?.toLowerCase().includes('server') ||
            err.type === 'server-error' ||
            err.type === 'network'
          ) {
            console.warn('[PeerService] Lost server connection – reloading in 3 s');
            setTimeout(() => {
              window.location.reload();
            }, 3000);
          }

          if (!this.isInitialized()) {
            reject(err);
          }
        });

        this.peer.on('disconnected', () => {
          console.warn('[PeerService] Peer disconnected from server, attempting reconnect…');
          if (this.peer && !this.peer.destroyed) {
            this.peer.reconnect();
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
   * Obtiene el stream local de cámara/micrófono con constraints optimizados
   */
  async getLocalStream(): Promise<MediaStream> {
    if (this.mediaStream) {
      return this.mediaStream;
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Mejora de volumen y calidad
          sampleRate: 48000,
          channelCount: 1,
          latency: 0,
        } as any,
        video: {
          width: { ideal: 320, max: 640 },
          height: { ideal: 240, max: 480 },
          frameRate: { ideal: 15, max: 24 },
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
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      this.isAudioMuted.set(audioTracks.some((t) => !t.enabled));
    }
  }

  toggleVideo(): void {
    if (this.mediaStream) {
      const videoTracks = this.mediaStream.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      this.isVideoMuted.set(videoTracks.some((t) => !t.enabled));
    }
  }

  /**
   * Silencia/activa el audio de un peer remoto (DM feature). Afecta globalmente.
   */
  toggleRemoteMute(remotePeerId: string): void {
    // DM manda señal global
    this.socketService.emit('peerControl', { targetPeerId: remotePeerId, action: 'mute' });
    
    // Mantenemos el estado local también por precaución
    const muted = new Set(this.mutedRemotePeers());
    if (muted.has(remotePeerId)) {
      muted.delete(remotePeerId);
    } else {
      muted.add(remotePeerId);
    }
    this.mutedRemotePeers.set(muted);
  }

  isRemoteMuted(remotePeerId: string): boolean {
    return this.mutedRemotePeers().has(remotePeerId);
  }

  /**
   * Cierra la conexión con un peer específico a nivel global (DM puede expulsar de la llamada)
   */
  kickPeer(remotePeerId: string): void {
    console.log(`[PeerService] Kicking peer globally: ${remotePeerId}`);
    this.socketService.emit('peerControl', { targetPeerId: remotePeerId, action: 'kick' });
    this.closeConnection(remotePeerId);
  }

  /**
   * Fuerza reconexión con un peer congelado
   */
  async reconnectPeer(remotePeerId: string): Promise<void> {
    console.log(`[PeerService] Forcing reconnect to frozen peer: ${remotePeerId}`);
    this.closeConnection(remotePeerId);
    await new Promise((r) => setTimeout(r, 500));
    if (this.isInitialized() && this.localStream()) {
      await this.callPeer(remotePeerId).catch((err) => {
        console.error('[PeerService] Error reconectando con peer congelado:', err);
      });
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

    if (remotePeerId === this.peerId()) {
      console.warn('[PeerService] Ignoring self-call attempt');
      return;
    }

    if (this.connections.has(remotePeerId)) {
      console.log(`[PeerService] Connection already exists for ${remotePeerId}, skipping...`);
      return;
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
    this.stopFrozenStreamWatcher();
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

    // Cleanup socket subscriptions
    this.socketSubscriptions.forEach((sub) => sub.unsubscribe());
    this.socketSubscriptions = [];

    this.isInitialized.set(false);
    this.peerId.set(null);
    this.remoteStreams.set(new Map());
    this.mutedRemotePeers.set(new Set());
    this.isAudioMuted.set(false);
    this.isVideoMuted.set(false);
  }

  /**
   * Monitorea streams congelados usando requestVideoFrameCallback / fallback con timestamps
   */
  private startFrozenStreamWatcher(): void {
    if (this.frozenCheckInterval) return;
    // Revisamos cada 8 segundos si algún stream está congelado
    this.frozenCheckInterval = setInterval(() => {
      this.checkFrozenStreams();
    }, 8000);
  }

  private stopFrozenStreamWatcher(): void {
    if (this.frozenCheckInterval) {
      clearInterval(this.frozenCheckInterval);
      this.frozenCheckInterval = null;
    }
  }

  private frozenFrameCounts = new Map<string, number>();

  private checkFrozenStreams(): void {
    const streams = this.remoteStreams();
    streams.forEach((stream, peerId) => {
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) return;

      // Si el track está en estado ended o muted sin razón, lo marcamos como posiblemente congelado
      if (videoTrack.readyState === 'ended') {
        console.warn(`[PeerService] Stream de ${peerId} parece congelado (track ended), cerrando...`);
        this.closeConnection(peerId);
      }
    });
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

    if (call.peer === this.peerId()) {
      console.warn('[PeerService] Ignoring incoming call from self');
      call.close();
      return;
    }

    if (this.connections.has(call.peer)) {
      console.log(`[PeerService] Closing existing connection with ${call.peer} to accept new one`);
      this.closeConnection(call.peer);
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
    if (remotePeerId === this.peerId()) {
      console.warn('[PeerService] Ignoring remote stream from self');
      return;
    }

    this.ngZone.run(() => {
      const streams = this.remoteStreams();
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
    this.socketSubscriptions.push(
      this.socketService.on<PeerSignalPayload>('peerSignal').subscribe((payload) => {
        this.handlePeerSignal(payload);
      }),
    );

    this.socketSubscriptions.push(
      this.socketService.on<string>('peerUserLeft').subscribe((remotePeerId) => {
        console.log(`[PeerService] socket peerUserLeft: ${remotePeerId}`);
        this.closeConnection(remotePeerId);
      }),
    );

    this.socketSubscriptions.push(
      this.socketService
        .on<{ fromPeerId: string; fromSessionId: string }>('peerCallSignal')
        .subscribe((payload) => {
          console.log(`[PeerService] socket peerCallSignal from: ${payload.fromPeerId}`);
          if (this.isInitialized() && this.localStream() && payload.fromPeerId !== this.peerId()) {
            console.log(`[PeerService] Will auto-call ${payload.fromPeerId}`);
            this.callPeer(payload.fromPeerId).catch((err) => {
              console.error('[PeerService] Error auto-calling peer:', err);
            });
          } else {
            console.warn(
              `[PeerService] Ignored peerCallSignal. initialized: ${this.isInitialized()}, localStream: ${!!this.localStream()}, isSelf: ${payload.fromPeerId === this.peerId()}`,
            );
          }
        }),
    );

    this.socketSubscriptions.push(
      this.socketService.on<{ targetPeerId: string; action: 'kick' | 'mute' }>('peerControl').subscribe((payload) => {
        // Si la orden es para mí
        if (payload.targetPeerId === this.peerId()) {
          if (payload.action === 'kick') {
            console.warn('[PeerService] DM has kicked you from the call.');
            this.disconnect();
          } else if (payload.action === 'mute') {
            console.warn('[PeerService] DM has muted you.');
            if (!this.isAudioMuted()) {
              this.toggleAudio();
            }
          }
        } else {
          // Si es para otro, en caso de kick aseguro cerrar mi conexión con él
          if (payload.action === 'kick') {
            this.closeConnection(payload.targetPeerId);
          }
        }
      }),
    );
  }

  /**
   * Maneja señales de signaling
   */
  private handlePeerSignal(payload: PeerSignalPayload): void {
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
