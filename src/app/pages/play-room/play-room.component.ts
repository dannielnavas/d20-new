import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  ChangeDetectorRef,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

import { environment } from '../../../environments/environment';
import { MapBoardComponent } from '../../components/board/map-board.component';
import { DicePanelComponent } from '../../components/dice/dice-panel.component';
import { DmHudComponent } from '../../components/dm/dm-hud.component';
import { InitiativePanelComponent } from '../../components/initiative/initiative-panel.component';
import { CharacterLobbyComponent } from '../../components/lobby/character-lobby.component';
import { VideoCallComponent } from '../../components/media/video-call.component';
import { ScreenReactionOverlayComponent } from '../../components/reactions/screen-reaction-overlay.component';
import { DiscordService } from '../../services/discord.service';
import { DmAuthService } from '../../services/dm-auth.service';
import { RoomStateService } from '../../services/room-state.service';
import { SocketService } from '../../services/socket.service';
import { DiceAnimationOverlayComponent } from '../../components/dice/dice-animation-overlay.component';
import { DiceEntry, RoomState, SessionStatePayload } from '../../types/room';

interface JoinRoomPayload {
  roomId: string;
  dmToken?: string;
  playerSessionId?: string;
  spectator?: boolean;
}

@Component({
  selector: 'app-play-room-page',
  standalone: true,
  imports: [
    MapBoardComponent,
    CharacterLobbyComponent,
    DicePanelComponent,
    InitiativePanelComponent,
    DmHudComponent,
    VideoCallComponent,
    ScreenReactionOverlayComponent,
    DiceAnimationOverlayComponent,
  ],
  templateUrl: './play-room.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayRoomComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly socketService = inject(SocketService);
  private readonly roomStateService = inject(RoomStateService);
  private readonly dmAuthService = inject(DmAuthService);
  private readonly discordService = inject(DiscordService);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly mapBoardRef = viewChild(MapBoardComponent);

  private readonly subscriptions = new Subscription();

  readonly roomState = this.roomStateService.roomState;
  readonly sessionState = this.roomStateService.sessionState;
  readonly roomId = signal<string>('');
  readonly connectionStatus = computed(() => (this.roomState() ? 'Conectado' : 'Conectando...'));
  readonly role = computed(() => this.sessionState()?.role ?? null);
  readonly reactions = signal<string[]>([]);
  readonly activeDiceRolls = signal<DiceEntry[]>([]);
  readonly discordIsActivity = this.discordService.isActivity;
  readonly discordParticipants = this.discordService.participants;

  ngOnInit(): void {
    const roomId = this.route.snapshot.paramMap.get('roomId') ?? 'demo';
    this.roomId.set(roomId);

    this.socketService.connect();

    this.subscriptions.add(
      this.socketService.on<RoomState>('roomState').subscribe((payload) => {
        this.roomStateService.setRoomState(payload);
      }),
    );

    this.subscriptions.add(
      this.socketService.on<SessionStatePayload>('sessionState').subscribe((payload) => {
        this.roomStateService.setSessionState(payload);
        // Restaurar personaje seleccionado tras recarga
        this.restoreClaimedToken(payload);
      }),
    );

    this.subscriptions.add(
      this.socketService.on<{ code: string; message: string }>('roomError').subscribe((payload) => {
        console.error('roomError', payload);
      }),
    );

    this.subscriptions.add(
      this.socketService
        .on<{
          instanceId?: string;
          channelId?: string;
          participants: string[];
        }>('discordActivityState')
        .subscribe((payload) => {
          this.discordService.setParticipants(payload.participants ?? []);
        }),
    );

    this.subscriptions.add(
      this.socketService
        .on<{ code: string; message: string }>('discordActivityError')
        .subscribe((payload) => {
          console.error('discordActivityError', payload);
        }),
    );

    this.subscriptions.add(
      this.socketService.on<{ x: number; y: number; by: string; ts: number }>('mapPing').subscribe((payload) => {
        this.mapBoardRef()?.showPingEffect(payload.x, payload.y);
      }),
    );

    this.subscriptions.add(
      this.socketService.on<DiceEntry>('diceRolled').subscribe((payload) => {
        this.activeDiceRolls.update((rolls) => [...rolls, payload]);
        this.cdr.markForCheck(); // Fuerza la actualización de la vista (moderno, zoneless-friendly)
        
        setTimeout(() => {
          this.activeDiceRolls.update((rolls) => rolls.filter((r) => r.id !== payload.id));
          this.cdr.markForCheck();
        }, 5000); // Remove after animation finishes
      }),
    );

    this.joinRoom();

    if (environment.discordActivityEnabled && environment.discordClientId) {
      const hasFrameId =
        typeof window !== 'undefined' && new URL(window.location.href).searchParams.has('frame_id');
      if (!hasFrameId) {
        return;
      }

      void this.discordService
        .init(environment.discordClientId)
        .then((context) => {
          if (!context) {
            return;
          }

          this.socketService.emit('discordActivityReady', {
            instanceId: context.instanceId,
            channelId: context.channelId,
            guildId: context.guildId,
          });
        })
        .catch((error: unknown) => {
          console.error('No se pudo inicializar Discord Activity', error);
        });
    }
  }

  ngOnDestroy(): void {
    if (this.discordIsActivity()) {
      this.socketService.emit('discordActivityLeave');
      this.discordService.leaveActivity();
    }

    this.subscriptions.unsubscribe();
    this.socketService.disconnect();
    this.roomStateService.clear();
  }

  private joinRoom(): void {
    const role = this.route.snapshot.queryParamMap.get('role');
    const spectator = this.route.snapshot.queryParamMap.get('spectator') === '1';

    const joinPayload: JoinRoomPayload = {
      roomId: this.roomId(),
      spectator,
      playerSessionId: this.getOrCreatePlayerSessionId(),
    };

    // En Activity (sin query params), intentar usar token guardado
    const dmToken = this.dmAuthService.getToken();
    if (dmToken || role === 'dm') {
      joinPayload.dmToken = dmToken || undefined;
    }

    this.socketService.emit('joinRoom', joinPayload);

    if (environment.discordActivityEnabled) {
      console.info('Discord Activity habilitada para esta build');
    }
  }

  onClaimPc(tokenId: string): void {
    this.socketService.emit('claimPc', { tokenId });
  }

  onReleasePc(tokenId: string): void {
    this.socketService.emit('releasePc', { tokenId });
  }

  onChatSend(text: string): void {
    this.socketService.emit('chatMessage', { text });
  }

  onDiceRoll(payload: {
    dieType: 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';
    mode: 'normal' | 'advantage' | 'disadvantage';
  }): void {
    this.socketService.emit('diceRoll', payload);
  }

  onDiceReset(): void {
    this.socketService.emit('diceLogReset');
  }

  onTokenMove(payload: { tokenId: string; x: number; y: number }): void {
    this.socketService.emit('tokenMove', payload);
  }

  onTokenMoveEnd(payload: { tokenId: string; x: number; y: number }): void {
    this.socketService.emit('tokenMoveEnd', payload);
  }

  onMapPing(payload: { x: number; y: number }): void {
    this.socketService.emit('mapPing', payload);
  }

  onInitiativeRollAll(): void {
    this.socketService.emit('initiativeRollAll');
  }

  onInitiativeNext(): void {
    this.socketService.emit('initiativeNext');
  }

  onInitiativeToggleVisibility(): void {
    this.socketService.emit('initiativeToggleVisibility');
  }

  onUpdateRoomSettings(payload: {
    backgroundUrl?: string;
    backgroundType?: 'image' | 'video' | 'youtube';
    gridSize?: number;
    snapToGrid?: boolean;
    playersCanPing?: boolean;
    mapAudioEnabled?: boolean;
    mapVolume?: number;
  }): void {
    this.socketService.emit('updateRoomSettings', payload);
  }

  onSpawnPc(payload: { names: string[]; imageUrl?: string }): void {
    this.socketService.emit('spawnPc', payload);
  }

  onSpawnNpc(payload: { name?: string; imageUrl?: string }): void {
    this.socketService.emit('spawnNpc', payload);
  }

  onUpdateTokenIdentity(payload: { tokenId: string; name: string; imageUrl?: string }): void {
    this.socketService.emit('tokenUpdateIdentity', payload);
  }

  onRemoveToken(tokenId: string): void {
    this.socketService.emit('tokenRemove', { tokenId });
  }

  private getOrCreatePlayerSessionId(): string {
    const storageKey = 'd20.playerSessionId';
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      return stored;
    }

    const newId = crypto.randomUUID();
    localStorage.setItem(storageKey, newId);
    return newId;
  }

  /**
   * Si el jugador ya tenía un personaje seleccionado antes de recargar,
   * lo reclama automáticamente (siempre que el server aún no le haya asignado uno).
   */
  private restoreClaimedToken(session: SessionStatePayload): void {
    if (session.claimedTokenId) {
      // El servidor ya tiene el claim, no hace falta restaurar
      return;
    }

    if (session.role !== 'player') {
      return;
    }

    const stored = localStorage.getItem('d20.claimedTokenId');
    if (stored) {
      console.log('[PlayRoom] Restaurando personaje desde localStorage:', stored);
      this.socketService.emit('claimPc', { tokenId: stored });
    }
  }
}
