import { Injectable, signal } from '@angular/core';
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

  constructor(private socketService: SocketService) {
    this.setupSocketListeners();
  }

  /**
   * Inicializa PeerJS con un ID único basado en sessionId + peerId generado
   */
  async initialize(sessionId: string): Promise<void> {
    if (this.isInitialized()) {
      return;
    }

    try {
      this.peer = new Peer(`${sessionId}-${Date.now()}`);

      this.peer.on('open', (id) => {
        this.peerId.set(id);
        this.isInitialized.set(true);
      });

      this.peer.on('call', (call) => {
        this.handleIncomingCall(call);
      });

      this.peer.on('error', (err) => {
        this.error.set(`PeerJS error: ${err.message}`);
        console.error('PeerJS error:', err);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inicializando PeerJS';
      this.error.set(message);
      throw err;
    }
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
      return this.mediaStream;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo acceder a cámara/micrófono';
      this.error.set(message);
      throw err;
    }
  }

  /**
   * Llama a otro peer
   */
  async callPeer(remotePeerId: string): Promise<void> {
    if (!this.peer || !this.mediaStream) {
      throw new Error('PeerService no inicializado o sin stream local');
    }

    try {
      const call = this.peer.call(remotePeerId, this.mediaStream);
      this.connections.set(remotePeerId, call);

      call.on('stream', (remoteStream) => {
        this.updateRemoteStream(remotePeerId, remoteStream);
      });

      call.on('close', () => {
        this.closeConnection(remotePeerId);
      });

      call.on('error', (err) => {
        console.error(`Error en llamada a ${remotePeerId}:`, err);
        this.closeConnection(remotePeerId);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : `Error llamando a ${remotePeerId}`;
      this.error.set(message);
      throw err;
    }
  }

  /**
   * Cierra una conexión específica
   */
  closeConnection(remotePeerId: string): void {
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
  }

  /**
   * Cierra todas las conexiones y libera recursos
   */
  disconnect(): void {
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
  }

  /**
   * Maneja llamadas entrantes
   */
  private handleIncomingCall(call: MediaConnection): void {
    if (!this.mediaStream) {
      call.close();
      return;
    }

    this.connections.set(call.peer, call);
    call.answer(this.mediaStream);

    call.on('stream', (remoteStream) => {
      this.updateRemoteStream(call.peer, remoteStream);
    });

    call.on('close', () => {
      this.closeConnection(call.peer);
    });

    call.on('error', (err) => {
      console.error(`Error en llamada entrante de ${call.peer}:`, err);
      this.closeConnection(call.peer);
    });
  }

  /**
   * Actualiza el stream remoto de un peer
   */
  private updateRemoteStream(remotePeerId: string, stream: MediaStream): void {
    const streams = this.remoteStreams();
    streams.set(remotePeerId, stream);
    this.remoteStreams.set(new Map(streams));
  }

  /**
   * Configura listeners para eventos Socket.IO de signaling
   */
  private setupSocketListeners(): void {
    this.socketService.on<PeerSignalPayload>('peerSignal').subscribe((payload) => {
      this.handlePeerSignal(payload);
    });

    this.socketService.on<string>('peerUserLeft').subscribe((remotePeerId) => {
      this.closeConnection(remotePeerId);
    });

    this.socketService.on<{ fromPeerId: string; fromSessionId: string }>('peerCallSignal').subscribe((payload) => {
      // If we are initialized and have a local stream, call the new peer!
      if (this.isInitialized() && this.localStream() && payload.fromPeerId !== this.peerId()) {
        this.callPeer(payload.fromPeerId).catch((err) => {
          console.error('Error auto-calling peer:', err);
        });
      }
    });
  }

  /**
   * Maneja señales de signaling (para futuro uso si necesitas SFU)
   */
  private handlePeerSignal(payload: PeerSignalPayload): void {
    // Placeholder para lógica de signaling avanzada
    console.log('Peer signal received:', payload);
  }

  /**
   * Emite señal al servidor para contactar otro peer o a toda la sala
   */
  emitCallSignal(targetSessionId?: string): void {
    if (!this.peerId()) {
      throw new Error('PeerJS no inicializado');
    }

    this.socketService.emit('peerCallRequest', {
      fromPeerId: this.peerId(),
      toSessionId: targetSessionId,
    });
  }
}
