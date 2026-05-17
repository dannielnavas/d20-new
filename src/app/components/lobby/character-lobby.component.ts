import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { ImageUploadService } from '../../services/image-upload.service';
import { Role, SessionStatePayload, Token } from '../../types/room';

@Component({
  selector: 'app-character-lobby',
  standalone: true,
  templateUrl: './character-lobby.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharacterLobbyComponent {
  private readonly imageUploadService = inject(ImageUploadService);

  readonly tokens = input<Token[]>([]);
  readonly sessionState = input<SessionStatePayload | null>(null);
  readonly role = input<Role | null>(null);

  readonly claimPc = output<string>();
  readonly releasePc = output<string>();
  readonly updateToken = output<{ tokenId: string; name: string; imageUrl?: string }>();

  readonly availablePcs = computed(() => this.tokens().filter((token) => token.type === 'pc'));

  readonly selectedToken = computed(() => {
    const tokenId = this.sessionState()?.claimedTokenId;
    return this.tokens().find((token) => token.id === tokenId) ?? null;
  });

  readonly editableName = signal('');
  readonly editableImageUrl = signal('');
  readonly selectedInitial = computed(
    () => this.selectedToken()?.name?.slice(0, 1).toUpperCase() ?? '?',
  );
  readonly collapsed = signal(false);
  readonly isEditing = signal(false);
  readonly imageUploadPending = signal(false);
  readonly imageUploadError = signal('');

  constructor() {
    effect(() => {
      const token = this.selectedToken();
      this.editableName.set(token?.name ?? '');
      this.editableImageUrl.set(token?.imageUrl ?? '');
    });
  }

  isPlayer(): boolean {
    return this.role() === 'player';
  }

  hasSelectedToken(): boolean {
    return this.selectedToken() !== null;
  }

  isClaimedByCurrentPlayer(token: Token): boolean {
    return this.sessionState()?.claimedTokenId === token.id;
  }

  canClaim(token: Token): boolean {
    return !token.claimedBy || this.isClaimedByCurrentPlayer(token) || !this.hasSelectedToken();
  }

  selectPc(token: Token): void {
    if (!this.canClaim(token)) {
      return;
    }
    // Persistir en localStorage para sobrevivir recargas
    localStorage.setItem('d20.claimedTokenId', token.id);
    this.claimPc.emit(token.id);
  }

  releaseToken(): void {
    const token = this.selectedToken();
    if (!token) return;
    localStorage.removeItem('d20.claimedTokenId');
    this.releasePc.emit(token.id);
  }

  toggleEdit(): void {
    this.isEditing.set(!this.isEditing());
  }

  saveSelectedToken(): void {
    const token = this.selectedToken();
    const name = this.editableName().trim();

    if (!token || !name) {
      return;
    }

    this.updateToken.emit({
      tokenId: token.id,
      name,
      imageUrl: this.editableImageUrl().trim() || undefined,
    });
  }

  async onImageFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    this.imageUploadPending.set(true);
    this.imageUploadError.set('');

    try {
      const imageUrl = await this.imageUploadService.uploadImage(file, 'pc');
      this.editableImageUrl.set(imageUrl);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No se pudo subir la imagen';
      this.imageUploadError.set(message);
    } finally {
      this.imageUploadPending.set(false);
      if (input) {
        input.value = '';
      }
    }
  }

  toggleCollapsed(): void {
    this.collapsed.set(!this.collapsed());
  }
}
