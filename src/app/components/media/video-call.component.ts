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
    <div class="vtt-panel flex flex-col gap-4 transition-all duration-500 relative overflow-hidden group border" [ngClass]="isCallActive() ? 'border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'border-white/5'">
      <!-- Glow effect when active -->
      @if (isCallActive()) {
        <div class="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-[60px] pointer-events-none transition-opacity duration-1000 opacity-100"></div>
      }

      <div class="flex flex-wrap items-center justify-between gap-4 relative z-10">
        <div class="flex items-center gap-3">
          <div class="relative flex h-3.5 w-3.5 items-center justify-center">
            @if (isCallActive()) {
              <div class="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60"></div>
              <div class="relative h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
            } @else {
              <div class="relative h-2 w-2 rounded-full bg-slate-600"></div>
            }
          </div>
          <div>
            <h3 class="m-0 text-base font-semibold text-white tracking-tight flex items-center gap-2 font-display">
              Comunicaciones
              @if (isCallActive() && remoteStreamEntries().length === 0 && !isLoading()) {
                <span class="text-xs font-medium text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-full animate-pulse border border-emerald-500/20">Esperando...</span>
              }
            </h3>
            <p class="text-xs text-slate-400 font-medium mt-0.5">Voz y video en tiempo real</p>
          </div>
        </div>
        
        <div class="flex items-center gap-2 bg-black/20 p-1.5 rounded-xl border border-white/5 backdrop-blur-sm">
          @if (isCallActive()) {
            <button
              class="relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-300 cursor-pointer"
              [ngClass]="peerService.isAudioMuted() ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white'"
              (click)="peerService.toggleAudio()"
              title="Silenciar/Activar micrófono"
            >
              <span class="material-symbols-outlined text-[20px]">
                {{ peerService.isAudioMuted() ? 'mic_off' : 'mic' }}
              </span>
            </button>
            <button
              class="relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-300 cursor-pointer"
              [ngClass]="peerService.isVideoMuted() ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white'"
              (click)="peerService.toggleVideo()"
              title="Apagar/Encender cámara"
            >
              <span class="material-symbols-outlined text-[20px]">
                {{ peerService.isVideoMuted() ? 'videocam_off' : 'videocam' }}
              </span>
            </button>
            <div class="w-px h-6 bg-white/10 mx-1"></div>
          }
          <button
            class="flex items-center gap-2 px-4 h-10 rounded-lg font-medium transition-all duration-300 shadow-sm cursor-pointer"
            [ngClass]="isCallActive() ? 'bg-red-500/90 text-white hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.2)] border border-red-400/50' : 'bg-emerald-500/90 text-white hover:bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.2)] border border-emerald-400/50'"
            (click)="toggleCall()"
            [disabled]="isLoading() || (peerService.error() !== null && !isCallActive())"
          >
            <span class="material-symbols-outlined text-[18px]" [class.animate-spin]="isLoading() && !isCallActive()">
              {{ isLoading() && !isCallActive() ? 'progress_activity' : (isCallActive() ? 'call_end' : 'video_call') }}
            </span>
            <span class="text-sm">{{ isCallActive() ? 'Desconectar' : (isLoading() ? 'Conectando...' : 'Unirse a la sala') }}</span>
          </button>
        </div>
      </div>

      @if (isCallActive() || peerService.localStream() || remoteStreamEntries().length > 0) {
        <div class="mt-2 flex gap-3 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-thin scroll-smooth px-1">
          <!-- Stream local -->
          @if (peerService.localStream()) {
            <div class="relative w-[220px] aspect-video shrink-0 bg-slate-900 rounded-2xl overflow-hidden shadow-xl transition-all duration-300 snap-start group border-2" 
                 [ngClass]="peerService.isAudioMuted() ? 'border-red-500/40 shadow-[0_8px_30px_rgba(239,68,68,0.15)]' : 'border-emerald-500/40 shadow-[0_8px_30px_rgba(16,185,129,0.15)]'">
              <video [srcObject]="peerService.localStream()" autoplay muted playsinline class="w-full h-full object-cover transition-opacity duration-500" [class.opacity-10]="peerService.isVideoMuted()"></video>
              
              <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 pointer-events-none"></div>
              
              <div class="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                <div class="flex items-center gap-2 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
                  <span class="text-xs font-semibold text-white tracking-wide">Tú</span>
                </div>
                <div class="flex gap-1.5">
                  @if (peerService.isAudioMuted()) {
                    <div class="bg-red-500/80 backdrop-blur-md p-1 rounded-md shadow-lg flex items-center justify-center">
                      <span class="material-symbols-outlined text-[14px] text-white">mic_off</span>
                    </div>
                  }
                  @if (peerService.isVideoMuted()) {
                    <div class="bg-red-500/80 backdrop-blur-md p-1 rounded-md shadow-lg flex items-center justify-center">
                      <span class="material-symbols-outlined text-[14px] text-white">videocam_off</span>
                    </div>
                  }
                </div>
              </div>

              @if (peerService.isVideoMuted()) {
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                   <div class="h-16 w-16 rounded-2xl bg-slate-800/80 backdrop-blur-sm flex items-center justify-center border border-white/5 shadow-2xl">
                     <span class="material-symbols-outlined text-[32px] text-slate-400">person_off</span>
                   </div>
                </div>
              }
            </div>
          }

          <!-- Streams remotos -->
          @for (entry of remoteStreamEntries(); track entry.key) {
            <div class="relative w-[220px] aspect-video shrink-0 bg-slate-900 rounded-2xl overflow-hidden border border-white/10 shadow-lg snap-start group">
              <video [srcObject]="entry.value" autoplay playsinline class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"></video>
              
              <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-80 pointer-events-none"></div>
              
              <div class="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                <div class="flex items-center gap-2 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 max-w-full">
                  <span class="text-xs font-semibold text-white tracking-wide truncate">{{ entry.key.split('-')[0] | titlecase }}</span>
                </div>
              </div>
            </div>
          }
        </div>
      }

      @if (peerService.error()) {
        <div class="mt-2 bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl text-sm flex items-center gap-3 backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
          <span class="material-symbols-outlined text-red-400">error_outline</span>
          <p class="font-medium">{{ peerService.error() }}</p>
        </div>
      }
    </div>
  `,
  styles: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoCallComponent implements OnDestroy {
  protected readonly peerService = inject(PeerService);

  readonly isCallActive = signal(false);
  readonly isLoading = signal(false);
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
      this.isLoading.set(true);
      
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
    } finally {
      this.isLoading.set(false);
    }
  }

  private endCall(): void {
    this.peerService.disconnect();
    this.isCallActive.set(false);
  }
}
