import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import { DiceEntry, Role } from '../../types/room';

export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';
export type RollMode = 'normal' | 'advantage' | 'disadvantage';

@Component({
  selector: 'app-dice-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dice-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DicePanelComponent {
  readonly diceLog = input<DiceEntry[]>([]);
  readonly role = input<Role | null>(null);

  readonly roll = output<{ dieType: DieType; mode: RollMode; count?: number }>();
  readonly resetLog = output<void>();

  readonly selectedDie = signal<DieType>('d20');
  readonly selectedMode = signal<RollMode>('normal');
  readonly selectedCount = signal<number>(1);
  readonly isRolling = signal(false);

  submitRoll(): void {
    this.isRolling.set(true);
    this.roll.emit({
      dieType: this.selectedDie(),
      mode: this.selectedMode(),
      count: this.selectedCount(),
    });

    window.setTimeout(() => this.isRolling.set(false), 850);
  }
}
