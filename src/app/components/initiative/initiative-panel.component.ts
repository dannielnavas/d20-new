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

  readonly rollAll = output<void>();
  readonly nextTurn = output<void>();
  readonly toggleVisibility = output<void>();

  readonly orderedNames = computed(() => {
    const initiative = this.initiative();
    if (!initiative) {
      return [];
    }

    return initiative.order.map((tokenId) => {
      const token = this.tokens().find((item) => item.id === tokenId);
      return token?.name ?? tokenId;
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
}
