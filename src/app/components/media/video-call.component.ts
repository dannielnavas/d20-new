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
    <div class="vtt-panel flex flex-col gap-4 transition-all duration-500 relative group border" [ngClass]="isCallActive() ? 'border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)] bg-slate-900/40 backdrop-blur-md' : 'border-white/5 bg-slate-900/20'">
      <!-- Glow effect when active -->
      @if (isCallActive()) {
        <div class="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-[60px] pointer-events-none transition-opacity duration-1000 opacity-100"></div>
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
              Mesa de Juego (Comunicaciones)
              @if (isCallActive() && remoteStreamEntries().length === 0 && !isLoading()) {
                <span class="text-xs font-medium text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-full animate-pulse border border-emerald-500/20">Esperando jugadores...</span>
              }
            </h3>
            <p class="text-xs text-slate-400 font-medium mt-0.5">Voz y video en tiempo real</p>
          </div>
        </div>
        
        <div class="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md shadow-inner">
          @if (isCallActive()) {
            <button
              class="relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 cursor-pointer"
              [ngClass]="peerService.isAudioMuted() ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white'"
              (click)="peerService.toggleAudio()"
              title="Silenciar/Activar micrófono"
            >
              <span class="material-symbols-outlined text-[20px]">
                {{ peerService.isAudioMuted() ? 'mic_off' : 'mic' }}
              </span>
            </button>
            <button
              class="relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 cursor-pointer"
              [ngClass]="peerService.isVideoMuted() ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white'"
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
            class="flex items-center gap-2 px-5 h-10 rounded-xl font-medium transition-all duration-300 shadow-sm cursor-pointer"
            [ngClass]="isCallActive() ? 'bg-rose-500/90 text-white hover:bg-rose-600 shadow-[0_0_15px_rgba(244,63,94,0.2)] border border-rose-400/50' : 'bg-emerald-500/90 text-white hover:bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.2)] border border-emerald-400/50'"
            (click)="toggleCall()"
            [disabled]="isLoading() || (peerService.error() !== null && !isCallActive())"
          >
            <span class="material-symbols-outlined text-[18px]" [class.animate-spin]="isLoading() && !isCallActive()">
              {{ isLoading() && !isCallActive() ? 'progress_activity' : (isCallActive() ? 'call_end' : 'video_call') }}
            </span>
            <span class="text-sm font-semibold tracking-wide">{{ isCallActive() ? 'Desconectar' : (isLoading() ? 'Conectando...' : 'Unirse a la mesa') }}</span>
          </button>
        </div>
      </div>

      @if (isCallActive() || peerService.localStream() || remoteStreamEntries().length > 0) {
        <div class="mt-4 flex gap-6 overflow-x-auto pb-6 pt-2 snap-x snap-mandatory scrollbar-none scroll-smooth px-2 items-center justify-center min-h-[140px] relative">
          
          <!-- Decorative table line -->
          <div class="absolute bottom-2 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"></div>

          <!-- Stream local -->
          @if (peerService.localStream()) {
            <div class="relative w-28 h-28 shrink-0 bg-slate-900 rounded-full overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all duration-300 snap-center group border-4 ring-2 ring-black/50" 
                 [ngClass]="peerService.isAudioMuted() ? 'border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.3)]' : 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]'">
              <video [srcObject]="peerService.localStream()" autoplay muted playsinline class="w-full h-full object-cover transition-opacity duration-500" [class.opacity-20]="peerService.isVideoMuted()"></video>
              
              <div class="absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] pointer-events-none"></div>
              
              <!-- Name tag -->
              <div class="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center justify-center whitespace-nowrap">
                <div class="bg-black/80 backdrop-blur-xl px-3 py-1 rounded-full border border-white/20 shadow-xl flex items-center gap-1.5">
                  <span class="text-[10px] font-bold text-white tracking-widest uppercase">Tú</span>
                  @if (peerService.isAudioMuted()) {
                    <span class="material-symbols-outlined text-[12px] text-rose-400">mic_off</span>
                  }
                </div>
              </div>

              @if (peerService.isVideoMuted()) {
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span class="material-symbols-outlined text-[32px] text-slate-500">person_off</span>
                </div>
              }
            </div>
          }

          <!-- Streams remotos -->
          @for (entry of remoteStreamEntries(); track entry.key) {
            <div class="relative w-28 h-28 shrink-0 bg-slate-900 rounded-full overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] border-4 border-slate-700/50 ring-2 ring-black/50 snap-center group hover:border-emerald-500/40 transition-all duration-500 hover:scale-105 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <video [srcObject]="entry.value" autoplay playsinline class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"></video>
              
              <div class="absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] pointer-events-none"></div>
              
              <!-- Name tag -->
              <div class="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center justify-center whitespace-nowrap opacity-90 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-300 z-10">
                <div class="bg-black/80 backdrop-blur-xl px-3 py-1 rounded-full border border-white/20 shadow-xl">
                  <span class="text-[10px] font-bold text-white tracking-widest uppercase">{{ entry.key.split('-')[0] }}</span>
                </div>
              </div>
            </div>
          }
        </div>
      }

      @if (peerService.error()) {
        <div class="mt-2 bg-rose-500/10 border border-rose-500/20 text-rose-200 px-4 py-3 rounded-xl text-sm flex items-center gap-3 backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
          <span class="material-symbols-outlined text-rose-400">error_outline</span>
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
