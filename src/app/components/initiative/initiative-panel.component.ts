import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { InitiativeState, Role, Token } from '../../types/room';

@Component({
  selector: 'app-initiative-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './initiative-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InitiativePanelComponent {
  readonly initiative = input<InitiativeState | null>(null);
  readonly tokens = input<Token[]>([]);
  readonly role = input<Role | null>(null);
  readonly claimedTokenId = input<string | undefined>(undefined);

  readonly rollAll = output<void>();
  readonly nextTurn = output<void>();
  readonly toggleVisibility = output<void>();
  readonly moveInitiative = output<{ fromIndex: number; toIndex: number }>();
  readonly updateTokenStats = output<{ tokenId: string; hp?: number }>();

  readonly orderedTokens = computed(() => {
    const initiative = this.initiative();
    if (!initiative) {
      return [];
    }

    return initiative.order.map((tokenId) => {
      const token = this.tokens().find((item) => item.id === tokenId);
      return (
        token ??
        ({
          id: tokenId,
          name: tokenId,
          type: 'npc',
          conditions: [],
          x: 0,
          y: 0,
          size: 1,
        } as Token)
      );
    });
  });

  readonly canSeeOrder = computed(() => {
    if (this.isDm()) {
      return true;
    }

    return this.initiative()?.visible ?? false;
  });

  isDm(): boolean {
    return this.role() === 'dm';
  }

  moveTurn(fromIndex: number, toIndex: number): void {
    this.moveInitiative.emit({ fromIndex, toIndex });
  }

  getHpPercentage(token: Token): number {
    if (token.hp === undefined || !token.maxHp) {
      return 100;
    }
    return Math.max(0, Math.min(100, (token.hp / token.maxHp) * 100));
  }

  onInitHpChange(hpVal: number, tokenId: string): void {
    if (isNaN(hpVal)) return;
    this.updateTokenStats.emit({ tokenId, hp: hpVal });
  }
}
