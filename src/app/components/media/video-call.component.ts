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
    <div class="vtt-panel flex flex-col gap-3" [class.border-green-500]="isCallActive()">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full" [ngClass]="isCallActive() ? 'bg-green-500 animate-pulse' : 'bg-gray-500'"></div>
          <h3 class="m-0 text-sm font-semibold text-slate-200">Llamada de vídeo</h3>
        </div>
        <button
          class="vtt-btn-sm"
          [ngClass]="isCallActive() ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'vtt-btn-ghost'"
          (click)="toggleCall()"
          [disabled]="peerService.error() !== null && !isCallActive()"
        >
          <span class="material-symbols-outlined text-sm">
            {{ isCallActive() ? 'call_end' : 'video_call' }}
          </span>
          {{ isCallActive() ? 'Finalizar' : 'Iniciar llamada' }}
        </button>
      </div>

      @if (isCallActive() || peerService.localStream() || remoteStreamEntries().length > 0) {
        <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <!-- Stream local -->
          @if (peerService.localStream()) {
            <div class="relative w-40 h-28 shrink-0 bg-slate-900 rounded-lg overflow-hidden border-2 border-green-500/30">
              <video [srcObject]="peerService.localStream()" autoplay muted playsinline class="w-full h-full object-cover"></video>
              <div class="absolute bottom-1 left-1 bg-black/60 text-slate-200 px-2 py-0.5 text-xs rounded">Tú</div>
            </div>
          }

          <!-- Streams remotos -->
          @for (entry of remoteStreamEntries(); track entry.key) {
            <div class="relative w-40 h-28 shrink-0 bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
              <video [srcObject]="entry.value" autoplay playsinline class="w-full h-full object-cover"></video>
              <div class="absolute bottom-1 left-1 bg-black/60 text-slate-200 px-2 py-0.5 text-xs rounded truncate max-w-[90%]">{{ entry.key.split('-')[0] }}</div>
            </div>
          }
        </div>
      }

      @if (peerService.error()) {
        <div class="bg-red-900/50 text-red-300 p-2 rounded text-xs">
          {{ peerService.error() }}
        </div>
      }
    </div>
  `,
  styles: `
    .scrollbar-thin::-webkit-scrollbar {
      height: 6px;
    }
    .scrollbar-thin::-webkit-scrollbar-track {
      background: rgba(15, 23, 42, 0.5);
      border-radius: 4px;
    }
    .scrollbar-thin::-webkit-scrollbar-thumb {
      background: rgba(51, 65, 85, 0.8);
      border-radius: 4px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoCallComponent implements OnDestroy {
  protected readonly peerService = inject(PeerService);

  readonly isCallActive = signal(false);
  readonly remoteStreamEntries = computed(() => {
    const streams = this.peerService.remoteStreams();
    return Array.from(streams.entries()).map(([key, stream]) => ({ key, value: stream }));
  });

  ngOnDestroy(): void {
    this.endCall();
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
      this.peerService.error.set(null);
      // Generate a simple unique ID that is recognizable
      const uniqueId = `player-${Math.random().toString(36).substr(2, 6)}`;

      await this.peerService.initialize(uniqueId);
      await this.peerService.getLocalStream();
      
      // Notify everyone in the room that we are ready to receive calls
      this.peerService.emitCallSignal();

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
  }
}
