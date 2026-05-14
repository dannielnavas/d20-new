import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';

import { PeerService } from '../../services/peer.service';
import { RoomStateService } from '../../services/room-state.service';

@Component({
  selector: 'app-video-call',
  standalone: true,
  imports: [NgClass],
  template: `
    <div
      class="flex flex-col items-center gap-2 transition-all duration-500 relative w-full group pointer-events-none"
    >
      <!-- Área de Fichas / Cámaras -->
      @if (isCallActive() || peerService.localStream() || remoteStreamEntries().length > 0) {
        <div
          class="flex flex-row flex-nowrap w-full gap-3 overflow-x-auto pb-4 pt-2 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-white/20 px-2 items-center md:justify-center justify-start relative pointer-events-auto max-w-full"
        >
          <!-- Stream local -->
          @if (peerService.localStream()) {
            <div
              class="relative w-32 h-24 md:w-40 md:h-28 shrink-0 bg-slate-900 rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.6)] transition-all duration-300 snap-center group border-2 md:border-4 ring-2 ring-black/50"
              [ngClass]="
                peerService.isAudioMuted()
                  ? 'border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                  : 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
              "
            >
              <video
                [srcObject]="peerService.localStream()"
                autoplay
                muted
                playsinline
                class="w-full h-full object-cover transition-opacity duration-500"
                [class.opacity-20]="peerService.isVideoMuted()"
              ></video>

              <div
                class="absolute inset-0 rounded-full shadow-[inset_0_0_0_rgba(0,0,0,0.8)] pointer-events-none"
              ></div>

              <!-- Name tag -->
              <!-- <div
                class="absolute -bottom-[-6px] left-1/2 -translate-x-1/2 flex items-center justify-center whitespace-nowrap z-10"
              >
                <div
                  class="bg-black/80 backdrop-blur-xl px-3 py-1 rounded-full border border-white/20 shadow-xl flex items-center gap-1.5"
                >
                  <span class="text-[10px] font-bold text-white tracking-widest uppercase"
                    >Tú ({{ getMyDisplayName() }})</span
                  >
                  @if (peerService.isAudioMuted()) {
                    <span class="material-symbols-outlined text-[12px] text-rose-400">mic_off</span>
                  }
                </div>
              </div> -->

              @if (peerService.isVideoMuted()) {
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span class="material-symbols-outlined text-[32px] text-slate-500"
                    >person_off</span
                  >
                </div>
              }
            </div>
          }

          <!-- Streams remotos -->
          @for (entry of remoteStreamEntries(); track entry.key) {
            <div
              class="relative w-32 h-24 md:w-40 md:h-28 shrink-0 bg-slate-900 rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.6)] border-2 md:border-4 border-slate-700/50 ring-2 ring-black/50 snap-center group hover:border-emerald-500/40 transition-all duration-500 hover:scale-105 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            >
              <video
                [srcObject]="entry.value"
                autoplay
                playsinline
                class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              ></video>

              <div
                class="absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] pointer-events-none"
              ></div>
            </div>
          }
        </div>
      }

      <div
        class="flex items-center gap-2 bg-black/50 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md shadow-xl transition-all duration-300 hover:bg-black/60 pointer-events-auto"
      >
        @if (isCallActive()) {
          <button
            class="relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 cursor-pointer"
            [ngClass]="
              peerService.isAudioMuted()
                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                : 'bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white'
            "
            (click)="peerService.toggleAudio()"
            title="Silenciar/Activar micrófono"
          >
            <span class="material-symbols-outlined text-[20px]">
              {{ peerService.isAudioMuted() ? 'mic_off' : 'mic' }}
            </span>
          </button>
          <button
            class="relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 cursor-pointer"
            [ngClass]="
              peerService.isVideoMuted()
                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                : 'bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white'
            "
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
          [ngClass]="
            isCallActive()
              ? 'bg-rose-500/90 text-white hover:bg-rose-600 shadow-[0_0_15px_rgba(244,63,94,0.2)] border border-rose-400/50'
              : 'bg-emerald-500/90 text-white hover:bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.2)] border border-emerald-400/50'
          "
          (click)="toggleCall()"
          [disabled]="isLoading() || (peerService.error() !== null && !isCallActive())"
        >
          <span
            class="material-symbols-outlined text-[18px]"
            [class.animate-spin]="isLoading() && !isCallActive()"
          >
            {{
              isLoading() && !isCallActive()
                ? 'progress_activity'
                : isCallActive()
                  ? 'call_end'
                  : 'video_call'
            }}
          </span>
          <span class="text-sm font-semibold tracking-wide">{{
            isCallActive() ? '' : isLoading() ? 'Conectando...' : 'Unirse a la mesa'
          }}</span>
        </button>
      </div>

      @if (peerService.error()) {
        <div
          class="absolute -top-16 bg-rose-500/90 border border-rose-400 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-2xl animate-in fade-in slide-in-from-bottom-4 pointer-events-auto z-50"
        >
          <span class="material-symbols-outlined text-[18px]">error_outline</span>
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
  protected readonly roomState = inject(RoomStateService);

  readonly isCallActive = signal(false);
  readonly isLoading = signal(false);
  readonly remoteStreamEntries = computed(() => {
    const streams = this.peerService.remoteStreams();
    return Array.from(streams.entries()).map(([key, stream]) => ({ key, value: stream }));
  });

  getDisplayName(peerId: string): string {
    const parts = peerId.split('-');
    if (parts.length >= 2) {
      if (parts[0] === 'dm') return 'DM';
      return parts[1].replace(/_/g, ' ') || 'JUGADOR';
    }
    return peerId;
  }

  getMyDisplayName(): string {
    const role = this.roomState.sessionState()?.role;
    if (role === 'dm') return 'DM';

    const claimedTokenId = this.roomState.sessionState()?.claimedTokenId;
    if (claimedTokenId) {
      const token = this.roomState.roomState()?.tokens.find((t) => t.id === claimedTokenId);
      if (token && token.name) {
        return token.name;
      }
    }
    return 'JUGADOR';
  }

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

      const role = this.roomState.sessionState()?.role;
      let displayName = role === 'dm' ? 'DM' : 'Jugador';

      const claimedTokenId = this.roomState.sessionState()?.claimedTokenId;
      if (role === 'player' && claimedTokenId) {
        const token = this.roomState.roomState()?.tokens.find((t) => t.id === claimedTokenId);
        if (token && token.name) {
          displayName = token.name;
        }
      }

      // Clean up name for PeerJS ID: alphanumeric and underscores only
      const safeName = displayName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 15);
      const uniqueId = `${role}-${safeName}-${Math.random().toString(36).substring(2, 6)}`;

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
