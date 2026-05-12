import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';

import { PeerService } from '../../services/peer.service';
import { RoomStateService } from '../../services/room-state.service';

@Component({
  selector: 'app-video-call',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="vtt-panel vtt-video-call-container">
      <div class="vtt-panel-header">
        <h3>Llamada de vídeo</h3>
        <button
          class="vtt-btn-ghost vtt-btn-sm"
          (click)="toggleCall()"
          [disabled]="!peerService.isInitialized()"
        >
          {{ isCallActive() ? 'Finalizar' : 'Iniciar' }} llamada
        </button>
      </div>

      <div class="vtt-video-grid">
        <!-- Stream local -->
        <div class="vtt-video-tile">
          <video #localVideo autoplay muted playsinline class="vtt-video-stream"></video>
          <div class="vtt-video-label">Tú</div>
        </div>

        <!-- Streams remotos -->
        @for (entry of remoteStreamEntries(); track entry.key) {
          <div class="vtt-video-tile">
            <video [srcObject]="entry.value" autoplay playsinline class="vtt-video-stream"></video>
            <div class="vtt-video-label">{{ entry.key }}</div>
          </div>
        }
      </div>

      @if (peerService.error()) {
        <div class="vtt-error-toast">
          {{ peerService.error() }}
        </div>
      }
    </div>
  `,
  styles: `
    .vtt-video-call-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background: #0f172a;
      border-radius: 0.5rem;
      padding: 1rem;
    }

    .vtt-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;

      h3 {
        margin: 0;
        font-size: 1rem;
        color: #f1f5f9;
      }
    }

    .vtt-video-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.75rem;
      max-height: 400px;
      overflow-y: auto;
      border-radius: 0.375rem;
    }

    .vtt-video-tile {
      position: relative;
      aspect-ratio: 16 / 9;
      background: #1e293b;
      border-radius: 0.375rem;
      overflow: hidden;
      border: 2px solid #334155;
    }

    .vtt-video-stream {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .vtt-video-label {
      position: absolute;
      bottom: 0.5rem;
      left: 0.5rem;
      background: rgba(0, 0, 0, 0.6);
      color: #e2e8f0;
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
      border-radius: 0.25rem;
    }

    .vtt-error-toast {
      background: #7f1d1d;
      color: #fca5a5;
      padding: 0.75rem;
      border-radius: 0.375rem;
      font-size: 0.875rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoCallComponent implements OnInit, OnDestroy {
  protected readonly peerService = inject(PeerService);
  private readonly roomStateService = inject(RoomStateService);

  private localVideoRef: HTMLVideoElement | null = null;

  readonly isCallActive = signal(false);
  readonly remoteStreamEntries = computed(() => {
    const streams = this.peerService.remoteStreams();
    return Array.from(streams.entries()).map(([key, stream]) => ({ key, value: stream }));
  });

  ngOnInit(): void {
    this.initializeLocalVideo();
  }

  ngOnDestroy(): void {
    this.endCall();
    this.peerService.disconnect();
  }

  async toggleCall(): Promise<void> {
    if (this.isCallActive()) {
      this.endCall();
    } else {
      await this.startCall();
    }
  }

  private async startCall(): Promise<void> {
    try {
      // Genera un ID único basado en timestamp + random
      const uniqueId = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Inicializa PeerJS con ID único
      await this.peerService.initialize(uniqueId);

      // Obtiene stream local
      const stream = await this.peerService.getLocalStream();
      this.attachStreamToVideo(stream);

      this.isCallActive.set(true);
    } catch (err) {
      console.error('Error iniciando llamada:', err);
      this.peerService.error.set(
        err instanceof Error ? err.message : 'Error inicializando llamada',
      );
    }
  }

  private endCall(): void {
    this.peerService.disconnect();
    this.isCallActive.set(false);

    if (this.localVideoRef) {
      this.localVideoRef.srcObject = null;
    }
  }

  private async initializeLocalVideo(): Promise<void> {
    // Se inicia en startCall
  }

  private attachStreamToVideo(stream: MediaStream): void {
    // Acceder al template ref no es ideal, usamos el signal localStream
    // Esta es una alternativa: usando el streaming directamente
  }

  private setupVideoElement(): void {
    const videoElement = document.querySelector('video[#localVideo]') as HTMLVideoElement | null;
    if (videoElement && this.peerService.localStream()) {
      videoElement.srcObject = this.peerService.localStream();
    }
  }
}
