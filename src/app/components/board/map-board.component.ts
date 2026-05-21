import { CommonModule, NgStyle } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { Role, RoomSettings, Token } from '../../types/room';
import { PingEffectComponent } from './ping-effect.component';

@Component({
  selector: 'app-map-board',
  standalone: true,
  imports: [CommonModule, NgStyle, PingEffectComponent],
  templateUrl: './map-board.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapBoardComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly mapVideoRef = viewChild<ElementRef<HTMLVideoElement>>('mapVideo');
  private readonly mapYoutubeRef = viewChild<ElementRef<HTMLIFrameElement>>('mapYoutube');

  readonly tokens = input<Token[]>([]);
  readonly settings = input<RoomSettings | null>(null);
  readonly role = input<Role | null>(null);
  readonly claimedTokenId = input<string | undefined>(undefined);

  readonly tokenMove = output<{ tokenId: string; x: number; y: number }>();
  readonly tokenMoveEnd = output<{ tokenId: string; x: number; y: number }>();
  readonly mapPing = output<{ x: number; y: number }>();
  readonly tokenRotate = output<{ tokenId: string; rotation: number }>();
  readonly updateTokenStats = output<{
    tokenId: string;
    hp?: number;
    maxHp?: number;
    ac?: number;
    frameColor?: string;
    size?: number;
  }>();
  readonly setTokenConditions = output<{ tokenId: string; conditions: string[] }>();
  readonly mapViewChange = output<{ zoom: number; panX: number; panY: number }>();

  readonly boardWidth = 1600;
  readonly boardHeight = 900;
  readonly Math = Math;

  // Zoom & Pan signals
  readonly zoom = signal<number>(1);
  readonly panX = signal<number>(0);
  readonly panY = signal<number>(0);
  readonly isPanning = signal<boolean>(false);
  readonly panStart = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  // Quick edit menu signals
  readonly activeMenuTokenId = signal<string | null>(null);
  readonly activeMenuPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  // Rotation signals
  readonly rotatingTokenId = signal<string | null>(null);
  private rotationStartAngle = 0;
  private tokenCenter = { x: 0, y: 0 };

  readonly backgroundType = computed(() => this.settings()?.backgroundType ?? 'image');

  readonly backgroundUrl = computed(() => this.settings()?.backgroundUrl?.trim() ?? '');

  readonly youtubeVideoId = computed(() => this.extractYoutubeId(this.backgroundUrl()));

  readonly useYoutubeEmbed = computed(() => {
    const type = this.backgroundType();
    return type === 'youtube' || (type === 'video' && !!this.youtubeVideoId());
  });

  readonly mapAudioEnabled = computed(() => this.settings()?.mapAudioEnabled ?? false);

  readonly mapVolume = computed(() =>
    Math.max(0, Math.min(1, (this.settings()?.mapVolume ?? 50) / 100)),
  );

  readonly videoUrl = computed(() => {
    if (this.backgroundType() !== 'video') {
      return '';
    }

    return this.youtubeVideoId() ? '' : this.backgroundUrl();
  });

  readonly youtubeEmbedUrl = computed<SafeResourceUrl | null>(() => {
    const id = this.youtubeVideoId();
    if (!this.useYoutubeEmbed() || !id) {
      return null;
    }

    const origin = typeof location !== 'undefined' ? encodeURIComponent(location.origin) : '';

    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${id}?autoplay=1&mute=${this.mapAudioEnabled() ? 0 : 1}&loop=1&playlist=${id}&controls=0&rel=0&modestbranding=1&enablejsapi=1&origin=${origin}`,
    );
  });

  readonly boardStyle = computed(() => {
    const background = this.settings()?.backgroundUrl?.trim();
    if (background && this.backgroundType() === 'image') {
      return {
        backgroundImage: `url('${background}')`,
      };
    }

    return {
      backgroundImage:
        'linear-gradient(45deg, rgba(15,23,42,0.95), rgba(30,41,59,0.95)), repeating-linear-gradient(0deg, rgba(148,163,184,0.08), rgba(148,163,184,0.08) 1px, transparent 1px, transparent 50px), repeating-linear-gradient(90deg, rgba(148,163,184,0.08), rgba(148,163,184,0.08) 1px, transparent 1px, transparent 50px)',
    };
  });

  private readonly draggingTokenId = signal<string | null>(null);
  private readonly draggingPointerId = signal<number | null>(null);
  private readonly dragOffset = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  private readonly pings = signal<Array<{ id: string; x: number; y: number }>>([]);
  readonly activePings = computed(() => this.pings());

  constructor() {
    effect(() => {
      const zoomVal = this.zoom();
      const panXVal = this.panX();
      const panYVal = this.panY();
      if (this.role() === 'dm') {
        this.mapViewChange.emit({ zoom: zoomVal, panX: panXVal, panY: panYVal });
      }
    });

    effect(() => {
      const video = this.mapVideoRef()?.nativeElement;
      if (!video) {
        return;
      }

      video.volume = this.mapVolume();

      if (!this.mapAudioEnabled()) {
        video.muted = true;
        return;
      }

      video.muted = false;
      void video.play().catch(() => {
        // Browsers may still require a user gesture; handled again on pointer events.
      });
    });

    effect(() => {
      if (!this.useYoutubeEmbed() || !this.youtubeVideoId()) {
        return;
      }

      // Keep YouTube player volume/mute in sync with DM controls.
      this.syncYoutubeAudio();
    });
  }

  private extractYoutubeId(value: string): string {
    try {
      const url = new URL(value);

      if (url.hostname.includes('youtu.be')) {
        return url.pathname.replace('/', '').trim();
      }

      if (url.hostname.includes('youtube.com')) {
        const candidate = url.searchParams.get('v')?.trim();
        if (candidate) {
          return candidate;
        }

        const pathParts = url.pathname.split('/').filter(Boolean);
        const embedIndex = pathParts.findIndex((part) => part === 'embed' || part === 'shorts');
        return embedIndex >= 0 ? (pathParts[embedIndex + 1]?.trim() ?? '') : '';
      }
    } catch {
      return '';
    }

    return '';
  }

  onBoardPointerDown(event: PointerEvent): void {
    this.tryEnableMapAudioFromGesture();

    // Right Click or Middle Click: start panning
    if (event.button === 2 || event.button === 1) {
      this.isPanning.set(true);
      this.panStart.set({
        x: event.clientX - this.panX(),
        y: event.clientY - this.panY(),
      });
      event.preventDefault();
      event.stopPropagation();
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      return;
    }

    // Ping: Shift + left click
    if (event.shiftKey && event.button === 0) {
      const target = event.currentTarget as HTMLElement;
      const coords = this.getBoardCoordinates(event, target);
      this.mapPing.emit({ x: Math.round(coords.x), y: Math.round(coords.y) });
      this.showPingEffect(coords.x, coords.y);
      return;
    }

    // Left click on board empties active popovers
    if (event.button === 0) {
      this.closeQuickMenu();
    }
  }

  onBoardPointerMove(event: PointerEvent): void {
    if (this.isPanning()) {
      const dx = event.clientX - this.panStart().x;
      const dy = event.clientY - this.panStart().y;
      this.panX.set(dx);
      this.panY.set(dy);
    }
  }

  onBoardPointerUp(event: PointerEvent): void {
    if (this.isPanning()) {
      this.isPanning.set(false);
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    }
  }

  onBoardPointerCancel(event: PointerEvent): void {
    if (this.isPanning()) {
      this.isPanning.set(false);
    }
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const zoomIntensity = 0.08;
    const oldZoom = this.zoom();
    let newZoom = oldZoom;
    if (event.deltaY < 0) {
      newZoom = Math.min(3, oldZoom + zoomIntensity);
    } else {
      newZoom = Math.max(0.2, oldZoom - zoomIntensity);
    }

    const board = event.currentTarget as HTMLElement;
    const rect = board.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const boardX = (mouseX - this.panX()) / oldZoom;
    const boardY = (mouseY - this.panY()) / oldZoom;

    this.zoom.set(newZoom);
    this.panX.set(mouseX - boardX * newZoom);
    this.panY.set(mouseY - boardY * newZoom);
  }

  resetZoom(): void {
    this.zoom.set(1);
    this.panX.set(0);
    this.panY.set(0);
  }

  updateView(zoom: number, panX: number, panY: number): void {
    this.zoom.set(zoom);
    this.panX.set(panX);
    this.panY.set(panY);
  }

  private tryEnableMapAudioFromGesture(): void {
    const video = this.mapVideoRef()?.nativeElement;
    if (!video && !this.useYoutubeEmbed()) {
      return;
    }

    if (video) {
      if (!this.mapAudioEnabled()) {
        video.muted = true;
      } else {
        video.muted = false;
        video.volume = this.mapVolume();
      }

      void video.play().catch(() => {
        // Ignore browser autoplay restrictions when no user activation is available.
      });
    }

    if (this.useYoutubeEmbed()) {
      this.syncYoutubeAudio();
    }
  }

  onYoutubeIframeLoad(): void {
    this.syncYoutubeAudio();
  }

  private syncYoutubeAudio(): void {
    const iframe = this.mapYoutubeRef()?.nativeElement;
    if (!iframe || !this.youtubeVideoId()) {
      return;
    }

    this.postYoutubeCommand('playVideo');
    this.postYoutubeCommand('setVolume', [Math.round(this.mapVolume() * 100)]);

    if (this.mapAudioEnabled()) {
      this.postYoutubeCommand('unMute');
      return;
    }

    this.postYoutubeCommand('mute');
  }

  private postYoutubeCommand(func: string, args: unknown[] = []): void {
    const iframe = this.mapYoutubeRef()?.nativeElement;
    if (!iframe?.contentWindow) {
      return;
    }

    iframe.contentWindow.postMessage(
      JSON.stringify({
        event: 'command',
        func,
        args,
      }),
      'https://www.youtube.com',
    );
  }

  canControlToken(token: Token): boolean {
    if (this.role() === 'dm') {
      return true;
    }

    return this.role() === 'player' && this.claimedTokenId() === token.id;
  }

  onTokenPointerDown(event: PointerEvent, tokenId: string): void {
    this.tryEnableMapAudioFromGesture();

    if (event.button !== 0) {
      return;
    }

    const token = this.tokens().find((item) => item.id === tokenId);
    if (!token || !this.canControlToken(token)) {
      return;
    }

    const board = (event.currentTarget as HTMLElement).closest(
      '[data-vtt-board]',
    ) as HTMLElement | null;
    if (!board) {
      return;
    }

    const pointerPosition = this.getBoardCoordinates(event, board);
    this.dragOffset.set({
      x: pointerPosition.x - token.x,
      y: pointerPosition.y - token.y,
    });

    this.draggingTokenId.set(tokenId);
    this.draggingPointerId.set(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  onTokenPointerMove(event: PointerEvent, tokenId: string): void {
    if (this.draggingTokenId() !== tokenId || this.draggingPointerId() !== event.pointerId) {
      return;
    }

    const board = (event.currentTarget as HTMLElement).closest(
      '[data-vtt-board]',
    ) as HTMLElement | null;
    if (!board) {
      return;
    }

    const pointerPosition = this.getBoardCoordinates(event, board);
    let x = Math.max(0, Math.min(this.boardWidth, pointerPosition.x - this.dragOffset().x));
    let y = Math.max(0, Math.min(this.boardHeight, pointerPosition.y - this.dragOffset().y));

    if (this.settings()?.snapToGrid) {
      const gridSize = this.settings()?.gridSize ?? 50;
      x = Math.round(x / gridSize) * gridSize;
      y = Math.round(y / gridSize) * gridSize;
    }

    this.tokenMove.emit({ tokenId, x: Math.round(x), y: Math.round(y) });
  }

  onTokenPointerUp(event: PointerEvent, tokenId: string): void {
    if (this.draggingTokenId() !== tokenId || this.draggingPointerId() !== event.pointerId) {
      return;
    }

    const board = (event.currentTarget as HTMLElement).closest(
      '[data-vtt-board]',
    ) as HTMLElement | null;
    if (!board) {
      this.resetDragState();
      return;
    }

    const pointerPosition = this.getBoardCoordinates(event, board);
    let x = Math.max(0, Math.min(this.boardWidth, pointerPosition.x - this.dragOffset().x));
    let y = Math.max(0, Math.min(this.boardHeight, pointerPosition.y - this.dragOffset().y));

    if (this.settings()?.snapToGrid) {
      const gridSize = this.settings()?.gridSize ?? 50;
      x = Math.round(x / gridSize) * gridSize;
      y = Math.round(y / gridSize) * gridSize;
    }

    this.tokenMoveEnd.emit({ tokenId, x: Math.round(x), y: Math.round(y) });
    this.resetDragState();
  }

  onTokenPointerCancel(event: PointerEvent, tokenId: string): void {
    if (this.draggingTokenId() !== tokenId || this.draggingPointerId() !== event.pointerId) {
      return;
    }

    this.resetDragState();
  }

  tokenLeft(token: Token): string {
    return `${(token.x / this.boardWidth) * 100}%`;
  }

  tokenTop(token: Token): string {
    return `${(token.y / this.boardHeight) * 100}%`;
  }

  getTokenStyle(token: Token): Record<string, string> {
    const size = token.size || 1;
    const gridSize = this.settings()?.gridSize || 50;
    const finalSize = gridSize * size;
    return {
      left: this.tokenLeft(token),
      top: this.tokenTop(token),
      width: `${finalSize}px`,
      height: `${finalSize}px`,
      transform: 'translate(-50%, -50%)',
    };
  }

  getAvatarSize(token: Token): number {
    const size = token.size || 1;
    const gridSize = this.settings()?.gridSize || 50;
    const finalSize = gridSize * size;
    return Math.max(20, finalSize - 16);
  }

  readonly conditionEmojiMap: Record<string, string> = {
    'Envenenado': '🤢',
    'Derribado': '🛌',
    'Cegado': '🙈',
    'Ensordecido': '🙉',
    'Asustado': '😨',
    'Paralizado': '⚡',
    'Inconsciente': '💤',
    'Incapacitado': '✖️',
    'Invisible': '👻',
    'Hechizado': '💖',
  };

  getConditionEmoji(condition: string): string {
    return this.conditionEmojiMap[condition] ?? '❓';
  }

  getFrameColorClasses(token: Token): string {
    if (!token.frameColor) {
      return this.canControlToken(token)
        ? 'border-emerald-400 bg-emerald-900/70 shadow-[0_0_8px_rgba(52,211,153,0.3)]'
        : 'border-slate-500 bg-slate-900/70';
    }

    switch (token.frameColor.toLowerCase()) {
      case 'red':
        return 'border-rose-500 bg-rose-950/80 shadow-[0_0_15px_#f43f5e] ring-1 ring-rose-500/50';
      case 'green':
        return 'border-emerald-500 bg-emerald-950/80 shadow-[0_0_15px_#10b981] ring-1 ring-emerald-500/50';
      case 'blue':
        return 'border-sky-500 bg-sky-950/80 shadow-[0_0_15px_#0ea5e9] ring-1 ring-sky-500/50';
      case 'yellow':
        return 'border-amber-500 bg-amber-950/80 shadow-[0_0_15px_#f59e0b] ring-1 ring-amber-500/50';
      case 'purple':
        return 'border-violet-500 bg-violet-950/80 shadow-[0_0_15px_#8b5cf6] ring-1 ring-violet-500/50';
      case 'orange':
        return 'border-orange-500 bg-orange-950/80 shadow-[0_0_15px_#f97316] ring-1 ring-orange-500/50';
      default:
        return 'border-slate-500 bg-slate-900/70';
    }
  }

  getHpPercentage(token: Token): number {
    if (token.hp === undefined || !token.maxHp) {
      return 100;
    }
    return Math.max(0, Math.min(100, (token.hp / token.maxHp) * 100));
  }

  onRotationPointerDown(event: PointerEvent, tokenId: string): void {
    const token = this.tokens().find((t) => t.id === tokenId);
    if (!token) return;

    const board = (event.currentTarget as HTMLElement).closest('[data-vtt-board]') as HTMLElement | null;
    if (!board) return;

    const tokenElement = (event.currentTarget as HTMLElement).closest('button');
    if (!tokenElement) return;

    const tokenRect = tokenElement.getBoundingClientRect();
    this.tokenCenter = {
      x: tokenRect.left + tokenRect.width / 2,
      y: tokenRect.top + tokenRect.height / 2,
    };

    const dx = event.clientX - this.tokenCenter.x;
    const dy = event.clientY - this.tokenCenter.y;
    this.rotationStartAngle = Math.atan2(dy, dx) * (180 / Math.PI) - (token.rotation || 0);

    this.rotatingTokenId.set(tokenId);
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  onRotationPointerMove(event: PointerEvent): void {
    const tokenId = this.rotatingTokenId();
    if (!tokenId) return;

    const dx = event.clientX - this.tokenCenter.x;
    const dy = event.clientY - this.tokenCenter.y;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) - this.rotationStartAngle;

    angle = (angle + 360) % 360;

    if (event.shiftKey) {
      angle = Math.round(angle / 15) * 15;
    }

    this.tokenRotate.emit({ tokenId, rotation: Math.round(angle) });
  }

  onRotationPointerUp(event: PointerEvent): void {
    const tokenId = this.rotatingTokenId();
    if (tokenId) {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
      this.rotatingTokenId.set(null);
    }
  }

  onTokenDoubleClick(event: MouseEvent, token: Token): void {
    if (!this.canControlToken(token)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget as HTMLElement;
    const boardElement = target.closest('[data-vtt-board]') as HTMLElement | null;
    if (!boardElement) return;

    const boardRect = boardElement.getBoundingClientRect();
    const clickX = event.clientX - boardRect.left;
    const clickY = event.clientY - boardRect.top;

    const menuWidth = 288;
    const menuHeight = 350;

    let posX = clickX + 15;
    let posY = clickY - 50;

    if (posX + menuWidth > boardRect.width) {
      posX = clickX - menuWidth - 15;
    }
    if (posY + menuHeight > boardRect.height) {
      posY = boardRect.height - menuHeight - 15;
    }
    if (posY < 10) {
      posY = 10;
    }

    this.activeMenuTokenId.set(token.id);
    this.activeMenuPosition.set({ x: posX, y: posY });
  }

  getActiveMenuToken(): Token | null {
    const id = this.activeMenuTokenId();
    if (!id) return null;
    return this.tokens().find((t) => t.id === id) || null;
  }

  closeQuickMenu(): void {
    this.activeMenuTokenId.set(null);
  }

  readonly availableConditions = [
    'Envenenado',
    'Derribado',
    'Cegado',
    'Ensordecido',
    'Asustado',
    'Paralizado',
    'Inconsciente',
    'Incapacitado',
    'Invisible',
    'Hechizado',
  ];

  isConditionActive(condition: string): boolean {
    const token = this.getActiveMenuToken();
    if (!token) return false;
    return token.conditions.includes(condition);
  }

  toggleCondition(condition: string): void {
    const token = this.getActiveMenuToken();
    if (!token) return;

    let newConditions = [...token.conditions];
    if (newConditions.includes(condition)) {
      newConditions = newConditions.filter((c) => c !== condition);
    } else {
      newConditions.push(condition);
    }

    this.setTokenConditions.emit({ tokenId: token.id, conditions: newConditions });
  }

  saveQuickMenuChanges(
    hpVal: number,
    maxHpVal: number,
    acVal: number,
    sizeVal: string,
    colorVal: string,
  ): void {
    const token = this.getActiveMenuToken();
    if (!token) return;

    this.updateTokenStats.emit({
      tokenId: token.id,
      hp: isNaN(hpVal) ? undefined : hpVal,
      maxHp: isNaN(maxHpVal) ? undefined : maxHpVal,
      ac: isNaN(acVal) ? undefined : acVal,
      frameColor: colorVal,
      size: Number(sizeVal),
    });

    this.closeQuickMenu();
  }

  private getBoardCoordinates(event: PointerEvent, board: HTMLElement): { x: number; y: number } {
    const rect = board.getBoundingClientRect();
    const clickXInParent = event.clientX - rect.left;
    const clickYInParent = event.clientY - rect.top;

    return {
      x: (clickXInParent - this.panX()) / this.zoom(),
      y: (clickYInParent - this.panY()) / this.zoom(),
    };
  }

  private resetDragState(): void {
    this.draggingTokenId.set(null);
    this.draggingPointerId.set(null);
    this.dragOffset.set({ x: 0, y: 0 });
  }

  showPingEffect(x: number, y: number): void {
    const pingId = `ping-${Date.now()}-${Math.random()}`;
    const newPings = [...this.pings(), { id: pingId, x, y }];
    this.pings.set(newPings);

    setTimeout(() => {
      this.pings.set(this.pings().filter((ping) => ping.id !== pingId));
    }, 1000);
  }

  onHpDirectChange(hpVal: number, token: Token): void {
    if (isNaN(hpVal)) return;
    this.updateTokenStats.emit({
      tokenId: token.id,
      hp: hpVal,
    });
  }
}
