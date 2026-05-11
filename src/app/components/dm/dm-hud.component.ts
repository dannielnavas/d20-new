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

  readonly pcNames = signal('Aelar, Brynn');
  readonly npcName = signal('Guardia');
  readonly pcImageUrl = signal('');
  readonly npcImageUrl = signal('');
  readonly pcImageUploadPending = signal(false);
  readonly npcImageUploadPending = signal(false);
  readonly pcImageUploadError = signal('');
  readonly npcImageUploadError = signal('');

  readonly npcTokens = computed(() => this.tokens().filter((token) => token.type === 'npc'));

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
