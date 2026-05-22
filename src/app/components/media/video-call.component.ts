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
      <!-- Panel de Ajustes de Dispositivos -->
      @if (showSettings() && isCallActive()) {
        <div
          class="absolute bottom-16 bg-slate-950/95 border border-white/15 rounded-2xl p-4 w-72 flex flex-col gap-3 shadow-2xl backdrop-blur-lg animate-in fade-in slide-in-from-bottom-2 pointer-events-auto z-50 text-slate-200 text-xs"
        >
          <h4 class="font-bold text-emerald-400 tracking-wide uppercase mb-1 flex items-center gap-1">
            <span class="material-symbols-outlined text-[15px]">settings</span> Ajustes de Dispositivos
          </h4>

          <!-- Micrófono -->
          <div class="flex flex-col gap-1">
            <label class="font-semibold text-slate-400 flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">mic</span> Micrófono
            </label>
            <select
              [value]="peerService.selectedMicrophoneId()"
              (change)="onMicChange($event)"
              class="w-full bg-slate-900 border border-white/10 rounded-lg p-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer text-slate-200"
            >
              @for (mic of peerService.availableMicrophones(); track mic.deviceId) {
                <option [value]="mic.deviceId">{{ mic.label || 'Micrófono (' + mic.deviceId.slice(0, 5) + ')' }}</option>
              } @empty {
                <option value="">No hay micrófonos disponibles</option>
              }
            </select>
          </div>

          <!-- Cámara -->
          <div class="flex flex-col gap-1">
            <label class="font-semibold text-slate-400 flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">videocam</span> Cámara
            </label>
            <select
              [value]="peerService.selectedCameraId()"
              (change)="onCameraChange($event)"
              class="w-full bg-slate-900 border border-white/10 rounded-lg p-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer text-slate-200"
            >
              @for (cam of peerService.availableCameras(); track cam.deviceId) {
                <option [value]="cam.deviceId">{{ cam.label || 'Cámara (' + cam.deviceId.slice(0, 5) + ')' }}</option>
              } @empty {
                <option value="">No hay cámaras disponibles</option>
              }
            </select>
          </div>
        </div>
      }

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
                  : peerService.speakingPeers().has('local')
                    ? 'border-emerald-400 ring-4 ring-emerald-500/40 shadow-[0_0_25px_rgba(52,211,153,0.5)] scale-[1.02]'
                    : 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
              "
            >
              <video
                [srcObject]="peerService.localStream()"
                autoplay
                [muted]="true"
                playsinline
                class="w-full h-full object-cover transition-opacity duration-500"
                [class.opacity-20]="peerService.isVideoMuted()"
              ></video>

              <div
                class="absolute inset-0 rounded-full shadow-[inset_0_0_0_rgba(0,0,0,0.8)] pointer-events-none"
              ></div>

              @if (peerService.isVideoMuted()) {
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span class="material-symbols-outlined text-[28px] text-slate-500"
                    >person_off</span
                  >
                </div>
              }

              <!-- Etiqueta "Tú" -->
              <div class="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5 text-center">
                <span class="text-[9px] font-bold text-white/80 tracking-wider uppercase">Tú</span>
              </div>
            </div>
          }

          <!-- Streams remotos -->
          @for (entry of remoteStreamEntries(); track entry.key) {
            <div
              class="relative w-32 h-24 md:w-40 md:h-28 shrink-0 bg-slate-900 rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.6)] border-2 md:border-4 ring-2 ring-black/50 snap-center group hover:border-emerald-500/40 transition-all duration-500"
              [ngClass]="
                peerService.speakingPeers().has(entry.key)
                  ? 'border-emerald-400 ring-4 ring-emerald-500/40 shadow-[0_0_25px_rgba(52,211,153,0.5)] scale-[1.02]'
                  : 'border-slate-700/50'
              "
            >
              <video
                [srcObject]="entry.value"
                autoplay
                playsinline
                class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                [muted]="peerService.isRemoteMuted(entry.key)"
                [volume]="peerService.getRemoteVolume(entry.key)"
              ></video>

              <div
                class="absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] pointer-events-none"
              ></div>

              <!-- Icono silenciado -->
              @if (peerService.isRemoteMuted(entry.key)) {
                <div class="absolute top-1 left-1 bg-rose-500/90 rounded-full p-0.5 pointer-events-none">
                  <span class="material-symbols-outlined text-[10px] text-white">mic_off</span>
                </div>
              }

              <!-- Controles locales de volumen (para todos en hover) -->
              <div
                class="absolute bottom-6 left-0 right-0 px-2 py-1 bg-black/85 flex items-center justify-between gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto"
              >
                <span class="material-symbols-outlined text-[12px] text-white/70 select-none">
                  {{ peerService.getRemoteVolume(entry.key) === 0 ? 'volume_off' : peerService.getRemoteVolume(entry.key) < 0.5 ? 'volume_down' : 'volume_up' }}
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  [value]="peerService.getRemoteVolume(entry.key)"
                  (input)="onVolumeChange(entry.key, $event)"
                  class="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  title="Volumen local"
                />
              </div>

              <!-- Controles DM (aparecen en hover) -->
              @if (isDm()) {
                <div
                  class="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1.5 pointer-events-auto"
                >
                  <!-- Silenciar remoto -->
                  <button
                    class="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer"
                    [ngClass]="
                      peerService.isRemoteMuted(entry.key)
                        ? 'bg-emerald-500/80 text-white hover:bg-emerald-500'
                        : 'bg-rose-500/80 text-white hover:bg-rose-500'
                    "
                    (click)="peerService.toggleRemoteMute(entry.key)"
                    [title]="peerService.isRemoteMuted(entry.key) ? 'Activar audio' : 'Silenciar'"
                  >
                    <span class="material-symbols-outlined text-[12px]">
                      {{ peerService.isRemoteMuted(entry.key) ? 'mic' : 'mic_off' }}
                    </span>
                    {{ peerService.isRemoteMuted(entry.key) ? 'Activar' : 'Silenciar' }}
                  </button>

                  <!-- Reconectar (descongelar) -->
                  <button
                    class="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-amber-500/80 text-white hover:bg-amber-500 transition-all cursor-pointer"
                    (click)="reconnectFrozen(entry.key)"
                    title="Reconectar si está congelado"
                  >
                    <span class="material-symbols-outlined text-[12px]">refresh</span>
                    Descongelar
                  </button>

                  <!-- Expulsar de la llamada -->
                  <button
                    class="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-500/80 text-white hover:bg-slate-600 transition-all cursor-pointer"
                    (click)="kickFromCall(entry.key)"
                    title="Sacar de la llamada"
                  >
                    <span class="material-symbols-outlined text-[12px]">call_end</span>
                    Sacar
                  </button>
                </div>
              }

              <!-- Nombre del peer -->
              <div class="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5 text-center">
                <span class="text-[9px] font-bold text-white/80 tracking-wider uppercase truncate block">
                  {{ getDisplayName(entry.key) }}
                </span>
              </div>
            </div>
          }
        </div>
      }

      <div
        class="flex items-center gap-2 bg-black/50 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md shadow-xl transition-all duration-300 hover:bg-black/60 pointer-events-auto"
      >
        @if (isCallActive()) {
          <button
            class="relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 cursor-pointer"
            [ngClass]="
              peerService.isAudioMuted()
                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                : 'bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white'
            "
            (click)="peerService.toggleAudio()"
            title="Silenciar/Activar micrófono"
          >
            <span class="material-symbols-outlined text-[18px]">
              {{ peerService.isAudioMuted() ? 'mic_off' : 'mic' }}
            </span>
          </button>
          <button
            class="relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 cursor-pointer"
            [ngClass]="
              peerService.isVideoMuted()
                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                : 'bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white'
            "
            (click)="peerService.toggleVideo()"
            title="Apagar/Encender cámara"
          >
            <span class="material-symbols-outlined text-[18px]">
              {{ peerService.isVideoMuted() ? 'videocam_off' : 'videocam' }}
            </span>
          </button>
          <button
            class="relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 cursor-pointer"
            [ngClass]="
              showSettings()
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                : 'bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white'
            "
            (click)="toggleSettings()"
            title="Ajustes de Dispositivos"
          >
            <span class="material-symbols-outlined text-[18px]">settings</span>
          </button>
          <div class="w-px h-6 bg-white/10 mx-1"></div>
        }

        <button
          class="flex items-center gap-2 px-4 h-9 rounded-xl font-medium transition-all duration-300 shadow-sm cursor-pointer"
          [ngClass]="
            isCallActive()
              ? 'bg-rose-500/90 text-white hover:bg-rose-600 shadow-[0_0_15px_rgba(244,63,94,0.2)] border border-rose-400/50'
              : 'bg-emerald-500/90 text-white hover:bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.2)] border border-emerald-400/50'
          "
          (click)="toggleCall()"
          [disabled]="isLoading() || (peerService.error() !== null && !isCallActive())"
        >
          <span
            class="material-symbols-outlined text-[17px]"
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
          <span class="text-xs font-semibold tracking-wide">{{
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

  private readonly CALL_ACTIVE_KEY = 'd20.callActive';

  readonly isCallActive = signal(false);
  readonly isLoading = signal(false);
  readonly showSettings = signal(false);

  readonly remoteStreamEntries = computed(() => {
    const streams = this.peerService.remoteStreams();
    return Array.from(streams.entries()).map(([key, stream]) => ({ key, value: stream }));
  });

  readonly isDm = computed(() => this.roomState.sessionState()?.role === 'dm');

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

  kickFromCall(peerId: string): void {
    this.peerService.kickPeer(peerId);
  }

  reconnectFrozen(peerId: string): void {
    this.peerService.reconnectPeer(peerId).catch(console.error);
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

  toggleSettings(): void {
    this.showSettings.update((v) => !v);
    if (this.showSettings()) {
      this.peerService.updateAvailableDevices().catch(console.error);
    }
  }

  onMicChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.peerService.setMicrophone(select.value).catch(console.error);
  }

  onCameraChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.peerService.setCamera(select.value).catch(console.error);
  }

  onVolumeChange(peerId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    this.peerService.setRemoteVolume(peerId, value);
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

      const safeName = displayName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 15);
      const uniqueId = `${role}-${safeName}-${Math.random().toString(36).substring(2, 6)}`;

      await this.peerService.initialize(uniqueId);
      await this.peerService.getLocalStream();

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
    this.showSettings.set(false);
  }
}
