import { Injectable, NgZone, signal } from '@angular/core';
import Peer, { MediaConnection } from 'peerjs';
import { Subscription } from 'rxjs';
import { SocketService } from './socket.service';
import { environment } from '../../environments/environment';

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

  /** Listado y selección de dispositivos */
  readonly availableMicrophones = signal<MediaDeviceInfo[]>([]);
  readonly availableCameras = signal<MediaDeviceInfo[]>([]);
  readonly selectedMicrophoneId = signal<string | null>(null);
  readonly selectedCameraId = signal<string | null>(null);

  /** Detección de volumen y habla (Web Audio API) */
  readonly speakingPeers = signal<Set<string>>(new Set());
  private audioContext: AudioContext | null = null;
  private audioSources = new Map<string, { source: MediaStreamAudioSourceNode; analyser: AnalyserNode }>();
  private monitorInterval: ReturnType<typeof setInterval> | null = null;

  /** Volúmenes locales para streams remotos */
  readonly remoteVolumes = signal<Map<string, number>>(new Map());

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
        const iceServers = (environment as any).peerConfig?.iceServers || [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ];
        this.peer = new Peer(`${sessionId}-${Date.now()}`, {
          config: { iceServers },
        });

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
   * Obtiene el listado de micrófonos y cámaras disponibles y carga preferencias
   */
  async updateAvailableDevices(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter((d) => d.kind === 'audioinput');
      const cameras = devices.filter((d) => d.kind === 'videoinput');

      this.availableMicrophones.set(mics);
      this.availableCameras.set(cameras);

      const savedMic = localStorage.getItem('d20.preferredMic');
      const savedCam = localStorage.getItem('d20.preferredCam');

      if (savedMic && mics.some((m) => m.deviceId === savedMic)) {
        this.selectedMicrophoneId.set(savedMic);
      } else if (mics.length > 0) {
        this.selectedMicrophoneId.set(mics[0].deviceId);
      }

      if (savedCam && cameras.some((c) => c.deviceId === savedCam)) {
        this.selectedCameraId.set(savedCam);
      } else if (cameras.length > 0) {
        this.selectedCameraId.set(cameras[0].deviceId);
      }
    } catch (err) {
      console.warn('[PeerService] Error enumerating devices:', err);
    }
  }

  /**
   * Cambia el micrófono activo y lo persiste
   */
  async setMicrophone(deviceId: string): Promise<void> {
    localStorage.setItem('d20.preferredMic', deviceId);
    this.selectedMicrophoneId.set(deviceId);
    if (this.mediaStream) {
      await this.replaceLocalStreamTrack('audio', deviceId);
    }
  }

  /**
   * Cambia la cámara activa y la persiste
   */
  async setCamera(deviceId: string): Promise<void> {
    localStorage.setItem('d20.preferredCam', deviceId);
    this.selectedCameraId.set(deviceId);
    if (this.mediaStream) {
      await this.replaceLocalStreamTrack('video', deviceId);
    }
  }

  /**
   * Reemplaza en caliente un track (de audio o video) en la conexión local y de todos los peers
   */
  private async replaceLocalStreamTrack(type: 'audio' | 'video', deviceId: string): Promise<void> {
    if (!this.mediaStream) return;

    const oldTracks = type === 'audio' ? this.mediaStream.getAudioTracks() : this.mediaStream.getVideoTracks();
    oldTracks.forEach((t) => t.stop());

    const constraints: MediaStreamConstraints = {};
    if (type === 'audio') {
      constraints.audio = {
        deviceId: { exact: deviceId },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
    } else {
      constraints.video = {
        deviceId: { exact: deviceId },
        width: { ideal: 320, max: 640 },
        height: { ideal: 240, max: 480 },
        frameRate: { ideal: 15, max: 24 },
      };
    }

    try {
      const tempStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newTrack = type === 'audio' ? tempStream.getAudioTracks()[0] : tempStream.getVideoTracks()[0];

      if (!newTrack) {
        throw new Error(`No se pudo obtener el track de ${type}`);
      }

      oldTracks.forEach((t) => this.mediaStream?.removeTrack(t));
      this.mediaStream.addTrack(newTrack);

      // Gatilla la actualización del signal
      this.localStream.set(null);
      this.localStream.set(this.mediaStream);

      // Aplica el estado actual de silenciado
      if (type === 'audio') {
        newTrack.enabled = !this.isAudioMuted();
      } else {
        newTrack.enabled = !this.isVideoMuted();
      }

      // Actualiza la fuente del monitor de audio
      this.monitorStream('local', this.mediaStream);

      // Reemplaza el track en todas las conexiones activas sin colgar la llamada
      this.connections.forEach((call) => {
        const peerConnection = call.peerConnection;
        if (peerConnection) {
          const senders = peerConnection.getSenders();
          const sender = senders.find((s) => s.track && s.track.kind === type);
          if (sender) {
            sender.replaceTrack(newTrack).catch((err) => {
              console.error(`[PeerService] Error replacing track for peer ${call.peer}:`, err);
            });
          }
        }
      });
    } catch (err) {
      console.error(`[PeerService] Error replacing local stream track for ${type}:`, err);
      this.error.set(`Error cambiando dispositivo de ${type === 'audio' ? 'audio' : 'video'}`);
    }
  }

  /**
   * Administra el análisis de volumen para un flujo de audio
   */
  private monitorStream(peerId: string, stream: MediaStream): void {
    if (!stream.getAudioTracks().length) {
      return;
    }

    try {
      if (!this.audioContext) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioContextClass();
      }

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      this.unmonitorStream(peerId);

      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      this.audioSources.set(peerId, { source, analyser });
      this.startAudioMonitoring();
    } catch (err) {
      console.warn('[PeerService] Error monitoring stream audio:', err);
    }
  }

  private unmonitorStream(peerId: string): void {
    const active = this.audioSources.get(peerId);
    if (active) {
      try {
        active.source.disconnect();
      } catch (e) {}
      this.audioSources.delete(peerId);
    }

    if (this.speakingPeers().has(peerId)) {
      const current = new Set(this.speakingPeers());
      current.delete(peerId);
      this.speakingPeers.set(current);
    }
  }

  private startAudioMonitoring(): void {
    if (this.monitorInterval) return;

    this.monitorInterval = setInterval(() => {
      const activeSpeaking = new Set<string>();
      const bufferLength = 32;
      const dataArray = new Uint8Array(bufferLength);

      this.audioSources.forEach(({ analyser }, peerId) => {
        if (peerId === 'local' && this.isAudioMuted()) {
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        // Umbral de detección de voz (> 15 de volumen promedio)
        if (average > 15) {
          activeSpeaking.add(peerId);
        }
      });

      const current = this.speakingPeers();
      let changed = current.size !== activeSpeaking.size;
      if (!changed) {
        for (const id of activeSpeaking) {
          if (!current.has(id)) {
            changed = true;
            break;
          }
        }
      }

      if (changed) {
        this.speakingPeers.set(activeSpeaking);
      }
    }, 150);
  }

  private stopAudioMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    this.audioSources.forEach(({ source }) => {
      try {
        source.disconnect();
      } catch (e) {}
    });
    this.audioSources.clear();

    if (this.audioContext) {
      this.audioContext.close().catch(console.error);
      this.audioContext = null;
    }

    this.speakingPeers.set(new Set());
  }

  /**
   * Métodos para volumen local de peers remotos
   */
  setRemoteVolume(remotePeerId: string, volume: number): void {
    const volumes = this.remoteVolumes();
    volumes.set(remotePeerId, volume);
    this.remoteVolumes.set(new Map(volumes));
    localStorage.setItem(`d20.volume.${remotePeerId}`, String(volume));
  }

  getRemoteVolume(remotePeerId: string): number {
    const saved = localStorage.getItem(`d20.volume.${remotePeerId}`);
    if (saved !== null) {
      return Number(saved);
    }
    const val = this.remoteVolumes().get(remotePeerId);
    return val !== undefined ? val : 1.0;
  }

  /**
   * Obtiene el stream local de cámara/micrófono con constraints optimizados
   */
  async getLocalStream(): Promise<MediaStream> {
    if (this.mediaStream) {
      return this.mediaStream;
    }

    await this.updateAvailableDevices();

    const preferredMic = this.selectedMicrophoneId();
    const preferredCam = this.selectedCameraId();

    const audioConstraints: any = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,
      channelCount: 1,
      latency: 0,
    };
    if (preferredMic) {
      audioConstraints.deviceId = { exact: preferredMic };
    }

    const videoConstraints: any = {
      width: { ideal: 320, max: 640 },
      height: { ideal: 240, max: 480 },
      frameRate: { ideal: 15, max: 24 },
    };
    if (preferredCam) {
      videoConstraints.deviceId = { exact: preferredCam };
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: videoConstraints,
      });

      this.localStream.set(this.mediaStream);
      this.isAudioMuted.set(false);
      this.isVideoMuted.set(false);

      // Vuelve a poblar dispositivos ahora con etiquetas legibles tras la aceptación del permiso
      await this.updateAvailableDevices();

      // Inicia el análisis de voz local
      this.monitorStream('local', this.mediaStream);

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
    this.unmonitorStream(remotePeerId);
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
    this.stopAudioMonitoring();
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
    this.availableMicrophones.set([]);
    this.availableCameras.set([]);
    this.selectedMicrophoneId.set(null);
    this.selectedCameraId.set(null);
    this.remoteVolumes.set(new Map());
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
      const conn = this.connections.get(peerId);
      const isIceDisconnected = conn?.peerConnection &&
        (conn.peerConnection.iceConnectionState === 'failed' ||
         conn.peerConnection.iceConnectionState === 'disconnected');

      if ((videoTrack && videoTrack.readyState === 'ended') || isIceDisconnected) {
        console.warn(`[PeerService] Stream o ICE de ${peerId} congelado/desconectado. Intentando reconexión...`);
        this.reconnectPeer(peerId).catch(console.error);
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
        // Monitorea el volumen de este stream
        this.monitorStream(remotePeerId, stream);
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
