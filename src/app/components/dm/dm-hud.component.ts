import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { ImageUploadService } from '../../services/image-upload.service';
import { Role, RoomSettings, Token } from '../../types/room';

@Component({
  selector: 'app-dm-hud',
  standalone: true,
  templateUrl: './dm-hud.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmHudComponent {
  private readonly imageUploadService = inject(ImageUploadService);

  readonly role = input<Role | null>(null);
  readonly settings = input<RoomSettings | null>(null);
  readonly tokens = input<Token[]>([]);

  readonly updateSettings = output<Partial<RoomSettings>>();
  readonly spawnPc = output<{ names: string[]; imageUrl?: string }>();
  readonly spawnNpc = output<{ name?: string; imageUrl?: string }>();
  readonly removeToken = output<string>();
  readonly updateToken = output<{ tokenId: string; name: string; imageUrl?: string }>();
  readonly updateTokenStats = output<{ tokenId: string; hp?: number; maxHp?: number; ac?: number; frameColor?: string }>();
  readonly setTokenConditions = output<{ tokenId: string; conditions: string[] }>();
  readonly releasePc = output<string>();

  readonly pcNames = signal('Aelar, Brynn');
  readonly npcName = signal('Guardia');
  readonly pcImageUrl = signal('');
  readonly npcImageUrl = signal('');
  readonly pcImageUploadPending = signal(false);
  readonly npcImageUploadPending = signal(false);
  readonly pcImageUploadError = signal('');
  readonly npcImageUploadError = signal('');

  readonly npcTokens = computed(() => this.tokens().filter((token) => token.type === 'npc'));
  readonly pcTokens = computed(() => this.tokens().filter((token) => token.type === 'pc'));

  readonly editingTokenId = signal<string | null>(null);
  readonly editingName = signal('');
  readonly editingImageUrl = signal('');
  readonly editingHp = signal<number | undefined>(undefined);
  readonly editingMaxHp = signal<number | undefined>(undefined);
  readonly editingAc = signal<number | undefined>(undefined);
  readonly editingFrameColor = signal<string | undefined>(undefined);
  readonly editingConditions = signal<string[]>([]);

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

  private static readonly ASPECT_RATIO_PRESETS: Record<string, { w: number; h: number }> = {
    '16:9': { w: 1600, h: 900 },
    '4:3':  { w: 1200, h: 900 },
    '1:1':  { w: 1000, h: 1000 },
    '3:4':  { w: 900, h: 1200 },
    '9:16': { w: 900, h: 1600 },
  };

  readonly aspectRatioValue = computed(() => {
    const w = this.settings()?.boardWidth ?? 1600;
    const h = this.settings()?.boardHeight ?? 900;
    const found = Object.entries(DmHudComponent.ASPECT_RATIO_PRESETS).find(
      ([, dims]) => dims.w === w && dims.h === h,
    );
    return found ? found[0] : 'custom';
  });

  isDm(): boolean {
    return this.role() === 'dm';
  }

  savePingSetting(checked: boolean): void {
    this.updateSettings.emit({ playersCanPing: checked });
  }

  saveGrid(gridSize: number): void {
    this.updateSettings.emit({ gridSize });
  }

  saveBackgroundType(backgroundType: RoomSettings['backgroundType']): void {
    this.updateSettings.emit({ backgroundType });
  }

  saveBackgroundUrl(backgroundUrl: string): void {
    this.updateSettings.emit({ backgroundUrl: backgroundUrl.trim() });
  }

  saveSnapSetting(checked: boolean): void {
    this.updateSettings.emit({ snapToGrid: checked });
  }

  saveMapAudioEnabled(checked: boolean): void {
    this.updateSettings.emit({ mapAudioEnabled: checked });
  }

  saveMapVolume(mapVolume: number): void {
    this.updateSettings.emit({ mapVolume });
  }

  onAspectRatioChange(value: string): void {
    const preset = DmHudComponent.ASPECT_RATIO_PRESETS[value];
    if (preset) {
      this.updateSettings.emit({ boardWidth: preset.w, boardHeight: preset.h });
    }
    // 'custom' — wait for the user to type explicit values
  }

  saveBoardDimensions(w: number, h: number): void {
    const safeW = Math.max(200, Math.min(4000, Math.round(w) || 1600));
    const safeH = Math.max(200, Math.min(4000, Math.round(h) || 900));
    this.updateSettings.emit({ boardWidth: safeW, boardHeight: safeH });
  }

  createPcs(): void {
    const names = this.pcNames()
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    if (names.length === 0) {
      return;
    }

    this.spawnPc.emit({ names, imageUrl: this.pcImageUrl().trim() || undefined });
  }

  createNpc(): void {
    this.spawnNpc.emit({
      name: this.npcName().trim() || undefined,
      imageUrl: this.npcImageUrl().trim() || undefined,
    });
  }

  removeNpc(tokenId: string): void {
    this.removeToken.emit(tokenId);
  }

  removePc(tokenId: string): void {
    this.removeToken.emit(tokenId);
  }

  releasePcToken(tokenId: string): void {
    this.releasePc.emit(tokenId);
  }

  startEditingToken(token: Token): void {
    this.editingTokenId.set(token.id);
    this.editingName.set(token.name);
    this.editingImageUrl.set(token.imageUrl ?? '');
    this.editingHp.set(token.hp);
    this.editingMaxHp.set(token.maxHp);
    this.editingAc.set(token.ac);
    this.editingFrameColor.set(token.frameColor);
    this.editingConditions.set(token.conditions ?? []);
  }

  cancelEditingToken(): void {
    this.editingTokenId.set(null);
    this.editingName.set('');
    this.editingImageUrl.set('');
    this.editingHp.set(undefined);
    this.editingMaxHp.set(undefined);
    this.editingAc.set(undefined);
    this.editingFrameColor.set(undefined);
    this.editingConditions.set([]);
  }

  toggleCondition(condition: string): void {
    const current = this.editingConditions();
    if (current.includes(condition)) {
      this.editingConditions.set(current.filter((c) => c !== condition));
    } else {
      this.editingConditions.set([...current, condition]);
    }
  }

  saveEditingToken(): void {
    const tokenId = this.editingTokenId();
    const name = this.editingName().trim();
    if (!tokenId || !name) return;
    this.updateToken.emit({
      tokenId,
      name,
      imageUrl: this.editingImageUrl().trim() || undefined,
    });
    this.updateTokenStats.emit({
      tokenId,
      hp: this.editingHp(),
      maxHp: this.editingMaxHp(),
      ac: this.editingAc(),
      frameColor: this.editingFrameColor(),
    });
    this.setTokenConditions.emit({
      tokenId,
      conditions: this.editingConditions(),
    });
    this.cancelEditingToken();
  }

  async onPcImageFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    this.pcImageUploadPending.set(true);
    this.pcImageUploadError.set('');

    try {
      const imageUrl = await this.imageUploadService.uploadImage(file, 'pc');
      this.pcImageUrl.set(imageUrl);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No se pudo subir la imagen';
      this.pcImageUploadError.set(message);
    } finally {
      this.pcImageUploadPending.set(false);
      if (input) {
        input.value = '';
      }
    }
  }

  async onNpcImageFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    this.npcImageUploadPending.set(true);
    this.npcImageUploadError.set('');

    try {
      const imageUrl = await this.imageUploadService.uploadImage(file, 'npc');
      this.npcImageUrl.set(imageUrl);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No se pudo subir la imagen';
      this.npcImageUploadError.set(message);
    } finally {
      this.npcImageUploadPending.set(false);
      if (input) {
        input.value = '';
      }
    }
  }
}
