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
  readonly updateTokenStats = output<{ tokenId: string; hp?: number; maxHp?: number; ac?: number; frameColor?: string }>();
  readonly setTokenConditions = output<{ tokenId: string; conditions: string[] }>();

  readonly availablePcs = computed(() => this.tokens().filter((token) => token.type === 'pc'));

  readonly selectedToken = computed(() => {
    const tokenId = this.sessionState()?.claimedTokenId;
    return this.tokens().find((token) => token.id === tokenId) ?? null;
  });

  readonly editableName = signal('');
  readonly editableImageUrl = signal('');
  readonly editableHp = signal<number | undefined>(undefined);
  readonly editableMaxHp = signal<number | undefined>(undefined);
  readonly editableAc = signal<number | undefined>(undefined);
  readonly editableFrameColor = signal<string | undefined>(undefined);
  readonly editableConditions = signal<string[]>([]);

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
    'Hechizado'
  ];

  readonly availableColors = [
    { name: 'Ninguno', value: '' },
    { name: 'Rojo (Hostil)', value: 'red' },
    { name: 'Verde (Aliado)', value: 'green' },
    { name: 'Azul (Neutro)', value: 'blue' },
    { name: 'Amarillo', value: 'yellow' },
    { name: 'Naranja', value: 'orange' },
    { name: 'Morado (Boss)', value: 'purple' }
  ];
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
      this.editableHp.set(token?.hp);
      this.editableMaxHp.set(token?.maxHp);
      this.editableAc.set(token?.ac);
      this.editableFrameColor.set(token?.frameColor);
      this.editableConditions.set(token?.conditions ?? []);
    });
  }

  toggleCondition(condition: string): void {
    const current = this.editableConditions();
    if (current.includes(condition)) {
      this.editableConditions.set(current.filter((c) => c !== condition));
    } else {
      this.editableConditions.set([...current, condition]);
    }
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
    
    this.updateTokenStats.emit({
      tokenId: token.id,
      hp: this.editableHp(),
      maxHp: this.editableMaxHp(),
      ac: this.editableAc(),
      frameColor: this.editableFrameColor(),
    });
    
    this.setTokenConditions.emit({
      tokenId: token.id,
      conditions: this.editableConditions(),
    });
    
    this.isEditing.set(false);
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
