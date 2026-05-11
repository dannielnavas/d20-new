import { NgStyle } from '@angular/common';
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

@Component({
  selector: 'app-map-board',
  standalone: true,
  imports: [NgStyle],
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

  readonly boardWidth = 1600;
  readonly boardHeight = 900;

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

  constructor() {
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

    if (!event.shiftKey) {
      return;
    }

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * this.boardWidth;
    const y = ((event.clientY - rect.top) / rect.height) * this.boardHeight;
    this.mapPing.emit({ x: Math.round(x), y: Math.round(y) });
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

    const token = this.tokens().find((item) => item.id === tokenId);
    if (!token || !this.canControlToken(token)) {
      return;
    }

    this.draggingTokenId.set(tokenId);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  onTokenPointerMove(event: PointerEvent, tokenId: string): void {
    if (this.draggingTokenId() !== tokenId) {
      return;
    }

    const board = (event.currentTarget as HTMLElement).closest(
      '[data-vtt-board]',
    ) as HTMLElement | null;
    if (!board) {
      return;
    }

    const rect = board.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(this.boardWidth, ((event.clientX - rect.left) / rect.width) * this.boardWidth),
    );
    const y = Math.max(
      0,
      Math.min(this.boardHeight, ((event.clientY - rect.top) / rect.height) * this.boardHeight),
    );

    this.tokenMove.emit({ tokenId, x: Math.round(x), y: Math.round(y) });
  }

  onTokenPointerUp(event: PointerEvent, tokenId: string): void {
    if (this.draggingTokenId() !== tokenId) {
      return;
    }

    const board = (event.currentTarget as HTMLElement).closest(
      '[data-vtt-board]',
    ) as HTMLElement | null;
    if (!board) {
      this.draggingTokenId.set(null);
      return;
    }

    const rect = board.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(this.boardWidth, ((event.clientX - rect.left) / rect.width) * this.boardWidth),
    );
    const y = Math.max(
      0,
      Math.min(this.boardHeight, ((event.clientY - rect.top) / rect.height) * this.boardHeight),
    );

    this.tokenMoveEnd.emit({ tokenId, x: Math.round(x), y: Math.round(y) });
    this.draggingTokenId.set(null);
  }

  tokenLeft(token: Token): string {
    return `${(token.x / this.boardWidth) * 100}%`;
  }

  tokenTop(token: Token): string {
    return `${(token.y / this.boardHeight) * 100}%`;
  }
}
