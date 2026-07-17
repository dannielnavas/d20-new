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
  imports: [],
  template: `
    <!-- ══════ BARRA DE VIDEOCONFERENCIA — tira horizontal superior ══════ -->
    <div class="relative w-full flex items-stretch h-full"
      style="background: linear-gradient(to right, rgba(124,58,237,0.06) 0%, rgba(8,7,15,0.85) 50%, rgba(194,24,91,0.06) 100%);">

      <!-- ── Panel de ajustes (abre hacia abajo) ── -->
      @if (showSettings() && isCallActive()) {
        <div class="absolute top-full right-[160px] mt-1.5 w-72 bg-[var(--vtt-bg-soft)]/98 border border-purple-900/40 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl backdrop-blur-xl z-50">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[13px] text-purple-400" aria-hidden="true">settings</span>
            <h4 class="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Dispositivos de audio/vídeo</h4>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1" for="mic-select">
              <span class="material-symbols-outlined text-[11px]" aria-hidden="true">mic</span> Micrófono
            </label>
            <select id="mic-select" [value]="peerService.selectedMicrophoneId()" (change)="onMicChange($event)"
              class="w-full bg-black/40 border border-purple-900/30 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer">
              @for (mic of peerService.availableMicrophones(); track mic.deviceId) {
                <option [value]="mic.deviceId">{{ mic.label || 'Micrófono ' + mic.deviceId.slice(0, 6) }}</option>
              } @empty {
                <option value="">Sin micrófonos disponibles</option>
              }
            </select>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1" for="cam-select">
              <span class="material-symbols-outlined text-[11px]" aria-hidden="true">videocam</span> Cámara
            </label>
            <select id="cam-select" [value]="peerService.selectedCameraId()" (change)="onCameraChange($event)"
              class="w-full bg-black/40 border border-purple-900/30 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer">
              @for (cam of peerService.availableCameras(); track cam.deviceId) {
                <option [value]="cam.deviceId">{{ cam.label || 'Cámara ' + cam.deviceId.slice(0, 6) }}</option>
              } @empty {
                <option value="">Sin cámaras disponibles</option>
              }
            </select>
          </div>
        </div>
      }

      <!-- ── Tira de asientos (scroll horizontal, tarjetas grandes) ── -->
      <div class="flex-1 flex items-center gap-3 px-4 py-2 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-purple-900/40 min-w-0"
        role="list"
        aria-label="Participantes en la videollamada">

        <!-- Estado vacío -->
        @if (!isCallActive() && remoteStreamEntries().length === 0) {
          <div class="flex items-center gap-3 py-1 shrink-0">
            <span class="material-symbols-outlined text-[22px] text-slate-700" aria-hidden="true">group</span>
            <div>
              <p class="text-[11px] font-semibold text-slate-600">Mesa vacía</p>
              <p class="text-[10px] text-slate-700">Únete a la llamada para ver a tu grupo</p>
            </div>
          </div>
        }

        <!-- ── ASIENTO LOCAL ── -->
        @if (peerService.localStream()) {
          <div class="relative shrink-0 w-[100px] h-[120px] rounded-2xl overflow-hidden group border-2 transition-all duration-300 cursor-default"
            [class]="localBorderClass()"
            role="listitem"
            [attr.aria-label]="'Tu cámara: ' + getMyDisplayName()">

            <!-- Fondo-avatar -->
            <div class="absolute inset-0 flex items-center justify-center"
              [class]="isDm() ? 'bg-gradient-to-b from-yellow-950 to-amber-900' : 'bg-gradient-to-b from-violet-950 to-purple-900'"
              aria-hidden="true">
              <span class="text-5xl font-black select-none leading-none"
                [class]="isDm() ? 'text-amber-300/70' : 'text-purple-200/70'">{{ myInitial() }}</span>
            </div>

            <!-- Stream de vídeo -->
            <video [srcObject]="peerService.localStream()" autoplay [muted]="true" playsinline
              class="absolute inset-0 w-full h-full object-cover object-center z-10 transition-opacity duration-300"
              [class.opacity-0]="peerService.isVideoMuted()"></video>

            <!-- Gradiente inferior para nombre -->
            <div class="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-black/90 to-transparent pointer-events-none z-20" aria-hidden="true"></div>

            <!-- Brillo al hablar -->
            @if (peerService.speakingPeers().has('local') && !peerService.isAudioMuted()) {
              <div class="absolute inset-0 pointer-events-none z-30 rounded-2xl" aria-hidden="true"
                style="box-shadow: inset 0 0 20px rgba(251,191,36,0.65);"></div>
            }

            <!-- Indicador: micrófono silenciado -->
            @if (peerService.isAudioMuted()) {
              <div class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-rose-600 border border-rose-400/60 flex items-center justify-center z-40"
                aria-label="Micrófono silenciado">
                <span class="material-symbols-outlined text-[12px] text-white" aria-hidden="true">mic_off</span>
              </div>
            }

            <!-- Rol (arriba-izquierda) -->
            <div class="absolute top-1.5 left-1.5 z-40" aria-hidden="true">
              <span class="material-symbols-outlined text-[14px]"
                [class]="isDm() ? 'text-amber-400' : 'text-violet-400'">
                {{ isDm() ? 'auto_awesome' : 'person' }}
              </span>
            </div>

            <!-- Nombre + "tú" -->
            <div class="absolute bottom-0 inset-x-0 pb-2 px-1.5 text-center z-40 pointer-events-none" aria-hidden="true">
              <span class="text-[10px] font-bold leading-tight truncate block"
                [class]="isDm() ? 'text-amber-300' : 'text-violet-300'">{{ getMyDisplayName() }}</span>
              <span class="text-[8px] text-slate-400 leading-none">tú</span>
            </div>
          </div>
        }

        <!-- ── ASIENTOS REMOTOS ── -->
        @for (entry of remoteStreamEntries(); track entry.key) {
          <div class="relative shrink-0 w-[100px] h-[120px] rounded-2xl overflow-hidden group border-2 transition-all duration-300"
            [class]="remoteBorderClass(entry.key)"
            role="listitem"
            [attr.aria-label]="'Cámara de ' + getDisplayName(entry.key)">

            <!-- Fondo-avatar -->
            <div class="absolute inset-0 flex items-center justify-center"
              [class]="isDmPeer(entry.key) ? 'bg-gradient-to-b from-yellow-950 to-amber-900' : 'bg-gradient-to-b from-violet-950 to-purple-900'"
              aria-hidden="true">
              <span class="text-5xl font-black select-none leading-none"
                [class]="isDmPeer(entry.key) ? 'text-amber-300/70' : 'text-purple-200/70'">{{ getPeerInitial(entry.key) }}</span>
            </div>

            <!-- Stream remoto -->
            <video [srcObject]="entry.value" autoplay playsinline
              class="absolute inset-0 w-full h-full object-cover object-center z-10"
              [muted]="peerService.isRemoteMuted(entry.key)"
              [volume]="peerService.getRemoteVolume(entry.key)"></video>

            <!-- Gradiente inferior -->
            <div class="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-black/90 to-transparent pointer-events-none z-20" aria-hidden="true"></div>

            <!-- Brillo al hablar -->
            @if (peerService.speakingPeers().has(entry.key)) {
              <div class="absolute inset-0 pointer-events-none z-30 rounded-2xl" aria-hidden="true"
                style="box-shadow: inset 0 0 20px rgba(251,191,36,0.65);"></div>
            }

            <!-- Indicador: silenciado -->
            @if (peerService.isRemoteMuted(entry.key)) {
              <div class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-rose-600 border border-rose-400/60 flex items-center justify-center z-40"
                [attr.aria-label]="getDisplayName(entry.key) + ' silenciado'">
                <span class="material-symbols-outlined text-[12px] text-white" aria-hidden="true">mic_off</span>
              </div>
            }

            <!-- Rol (arriba-izquierda) -->
            <div class="absolute top-1.5 left-1.5 z-40" aria-hidden="true">
              <span class="material-symbols-outlined text-[14px]"
                [class]="isDmPeer(entry.key) ? 'text-amber-400' : 'text-violet-400'">
                {{ isDmPeer(entry.key) ? 'auto_awesome' : 'person' }}
              </span>
            </div>

            <!-- Slider de volumen (hover) -->
            <div class="absolute bottom-[28px] inset-x-2 opacity-0 group-hover:opacity-100 transition-opacity z-40">
              <label [for]="'vol-' + entry.key" class="sr-only">Volumen de {{ getDisplayName(entry.key) }}</label>
              <input [id]="'vol-' + entry.key" type="range" min="0" max="1" step="0.05"
                [value]="peerService.getRemoteVolume(entry.key)"
                (input)="onVolumeChange(entry.key, $event)"
                (click)="$event.stopPropagation()"
                class="w-full h-1 appearance-none bg-white/20 rounded-full cursor-pointer accent-amber-400">
            </div>

            <!-- Controles DM (overlay en hover) -->
            @if (isDm()) {
              <div class="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 z-40"
                role="group" [attr.aria-label]="'Controles de ' + getDisplayName(entry.key)">
                <button
                  class="w-10 h-8 rounded-lg flex items-center justify-center text-[9px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  [class]="peerService.isRemoteMuted(entry.key)
                    ? 'bg-emerald-700/90 hover:bg-emerald-600 text-white'
                    : 'bg-rose-700/90 hover:bg-rose-600 text-white'"
                  (click)="peerService.toggleRemoteMute(entry.key); $event.stopPropagation()"
                  [attr.aria-label]="peerService.isRemoteMuted(entry.key) ? 'Activar audio de ' + getDisplayName(entry.key) : 'Silenciar ' + getDisplayName(entry.key)">
                  <span class="material-symbols-outlined text-[13px]" aria-hidden="true">
                    {{ peerService.isRemoteMuted(entry.key) ? 'mic' : 'mic_off' }}
                  </span>
                </button>
                <button
                  class="w-10 h-8 rounded-lg bg-amber-700/90 hover:bg-amber-600 text-white flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  (click)="reconnectFrozen(entry.key); $event.stopPropagation()"
                  [attr.aria-label]="'Reconectar a ' + getDisplayName(entry.key)">
                  <span class="material-symbols-outlined text-[13px]" aria-hidden="true">refresh</span>
                </button>
                <button
                  class="w-10 h-8 rounded-lg bg-slate-700/90 hover:bg-slate-600 text-white flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  (click)="kickFromCall(entry.key); $event.stopPropagation()"
                  [attr.aria-label]="'Expulsar a ' + getDisplayName(entry.key) + ' de la llamada'">
                  <span class="material-symbols-outlined text-[13px]" aria-hidden="true">person_remove</span>
                </button>
              </div>
            }

            <!-- Nombre -->
            <div class="absolute bottom-0 inset-x-0 pb-2 px-1.5 text-center z-40 pointer-events-none" aria-hidden="true">
              <span class="text-[10px] font-bold leading-tight truncate block"
                [class]="isDmPeer(entry.key) ? 'text-amber-300' : 'text-violet-300'">{{ getDisplayName(entry.key) }}</span>
            </div>
          </div>
        }
      </div>

      <!-- ── Controles de llamada (derecha) ── -->
      <div class="shrink-0 flex flex-col items-center justify-center gap-2 px-4 border-l border-white/8"
        style="background: rgba(8,7,15,0.5);"
        role="toolbar" aria-label="Controles de videollamada">

        <!-- Unirse / Salir -->
        <button
          class="flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold tracking-wide transition-all whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-500"
          [class]="isCallActive()
            ? 'bg-rose-700/80 hover:bg-rose-700 text-white border border-rose-600/30'
            : 'bg-[var(--vtt-accent)]/80 hover:bg-[var(--vtt-accent)] text-white border border-[var(--vtt-accent)]/40 shadow-[0_0_12px_var(--vtt-accent-glow)]'"
          (click)="toggleCall()"
          [disabled]="isLoading()"
          [attr.aria-label]="isCallActive() ? 'Salir de la llamada' : 'Unirse a la llamada'">
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true"
            [class.animate-spin]="isLoading() && !isCallActive()">
            {{ isLoading() && !isCallActive() ? 'progress_activity' : isCallActive() ? 'call_end' : 'videocam' }}
          </span>
          <span>{{ isCallActive() ? 'Salir' : (isLoading() ? '' : 'Unirse') }}</span>
        </button>

        @if (isCallActive()) {
          <div class="flex items-center gap-1.5">
            <!-- Mic -->
            <button
              class="w-9 h-9 rounded-xl flex items-center justify-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-500"
              [class]="peerService.isAudioMuted()
                ? 'bg-rose-500/25 text-rose-400 hover:bg-rose-500/35 border border-rose-500/20'
                : 'bg-white/8 text-slate-300 hover:bg-white/15 hover:text-white border border-white/8'"
              (click)="peerService.toggleAudio()"
              [attr.aria-label]="peerService.isAudioMuted() ? 'Activar micrófono' : 'Silenciar micrófono'"
              [attr.aria-pressed]="peerService.isAudioMuted()">
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">
                {{ peerService.isAudioMuted() ? 'mic_off' : 'mic' }}
              </span>
            </button>
            <!-- Cam -->
            <button
              class="w-9 h-9 rounded-xl flex items-center justify-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-500"
              [class]="peerService.isVideoMuted()
                ? 'bg-rose-500/25 text-rose-400 hover:bg-rose-500/35 border border-rose-500/20'
                : 'bg-white/8 text-slate-300 hover:bg-white/15 hover:text-white border border-white/8'"
              (click)="peerService.toggleVideo()"
              [attr.aria-label]="peerService.isVideoMuted() ? 'Encender cámara' : 'Apagar cámara'"
              [attr.aria-pressed]="peerService.isVideoMuted()">
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">
                {{ peerService.isVideoMuted() ? 'videocam_off' : 'videocam' }}
              </span>
            </button>
            <!-- Settings -->
            <button
              class="w-9 h-9 rounded-xl flex items-center justify-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-500"
              [class]="showSettings()
                ? 'bg-purple-500/25 text-purple-300 border border-purple-500/30'
                : 'bg-white/8 text-slate-400 hover:bg-white/15 hover:text-slate-200 border border-white/8'"
              (click)="toggleSettings()"
              aria-label="Ajustes de dispositivos"
              [attr.aria-expanded]="showSettings()">
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">settings</span>
            </button>
          </div>
        }
      </div>

      <!-- ── Toast de error ── -->
      @if (peerService.error()) {
        <div class="absolute top-full right-4 mt-1.5 bg-rose-950/95 border border-rose-700/50 text-rose-300 px-3 py-2 rounded-xl text-[11px] flex items-center gap-2 shadow-xl z-50"
          role="alert" aria-live="assertive">
          <span class="material-symbols-outlined text-[14px]" aria-hidden="true">error_outline</span>
          <span>{{ peerService.error() }}</span>
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
  readonly showSettings = signal(false);

  readonly remoteStreamEntries = computed(() => {
    const streams = this.peerService.remoteStreams();
    return Array.from(streams.entries()).map(([key, stream]) => ({ key, value: stream }));
  });

  readonly isDm = computed(() => this.roomState.sessionState()?.role === 'dm');

  readonly myInitial = computed(() => this.getMyDisplayName().charAt(0).toUpperCase());

  // ── Border classes ──────────────────────────────────────────────────

  localBorderClass(): string {
    if (this.peerService.speakingPeers().has('local') && !this.peerService.isAudioMuted()) {
      return 'border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.55)]';
    }
    if (this.peerService.isAudioMuted()) {
      return 'border-rose-800/60';
    }
    return this.isDm() ? 'border-amber-700/50' : 'border-purple-700/40';
  }

  remoteBorderClass(peerId: string): string {
    if (this.peerService.speakingPeers().has(peerId)) {
      return 'border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.55)]';
    }
    return this.isDmPeer(peerId) ? 'border-amber-700/50' : 'border-purple-700/40';
  }

  // ── Peer helpers ────────────────────────────────────────────────────

  isDmPeer(peerId: string): boolean {
    return peerId.startsWith('dm-');
  }

  getPeerInitial(peerId: string): string {
    return this.getDisplayName(peerId).charAt(0).toUpperCase();
  }

  getDisplayName(peerId: string): string {
    const parts = peerId.split('-');
    if (parts.length < 2) return 'Jugador';
    if (parts[0] === 'dm') return 'DM';
    // safeName is everything between role prefix and 4-char random suffix
    const safeName = parts.slice(1, parts.length - 1).join('-');
    // Try to resolve against current room tokens
    const tokens = this.roomState.roomState()?.tokens ?? [];
    const match = tokens.find(
      (t) => t.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 15) === safeName,
    );
    if (match) return match.name;
    return safeName.replace(/_/g, ' ') || 'Jugador';
  }

  getMyDisplayName(): string {
    const role = this.roomState.sessionState()?.role;
    if (role === 'dm') return 'DM';
    const claimedId = this.roomState.sessionState()?.claimedTokenId;
    if (claimedId) {
      const token = this.roomState.roomState()?.tokens.find((t) => t.id === claimedId);
      if (token?.name) return token.name;
    }
    return 'Jugador';
  }

  // ── Actions ─────────────────────────────────────────────────────────

  kickFromCall(peerId: string): void {
    this.peerService.kickPeer(peerId);
  }

  reconnectFrozen(peerId: string): void {
    this.peerService.reconnectPeer(peerId).catch(console.error);
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
    this.peerService.setRemoteVolume(peerId, parseFloat(input.value));
  }

  ngOnDestroy(): void {
    this.endCall();
  }

  // ── Private ─────────────────────────────────────────────────────────

  private async startCall(): Promise<void> {
    try {
      this.peerService.error.set(null);
      this.isLoading.set(true);

      const role = this.roomState.sessionState()?.role;
      let displayName = role === 'dm' ? 'DM' : 'Jugador';

      const claimedId = this.roomState.sessionState()?.claimedTokenId;
      if (role === 'player' && claimedId) {
        const token = this.roomState.roomState()?.tokens.find((t) => t.id === claimedId);
        if (token?.name) displayName = token.name;
      }

      const safeName = displayName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 15);
      const uniqueId = `${role}-${safeName}-${Math.random().toString(36).substring(2, 6)}`;

      await this.peerService.initialize(uniqueId);
      await this.peerService.getLocalStream();
      this.peerService.emitCallSignal();

      this.isCallActive.set(true);
    } catch (err) {
      this.peerService.error.set(
        err instanceof Error ? err.message : 'Error al iniciar la llamada',
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
