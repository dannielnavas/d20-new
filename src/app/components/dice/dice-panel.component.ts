import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import { DiceEntry, Role } from '../../types/room';

export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';
export type RollMode = 'normal' | 'advantage' | 'disadvantage';

@Component({
  selector: 'app-dice-panel',
  standalone: true,
  templateUrl: './dice-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DicePanelComponent {
  readonly diceLog = input<DiceEntry[]>([]);
  readonly role = input<Role | null>(null);

  readonly roll = output<{ dieType: DieType; mode: RollMode }>();
  readonly resetLog = output<void>();

  readonly selectedDie = signal<DieType>('d20');
  readonly selectedMode = signal<RollMode>('normal');
  readonly isRolling = signal(false);

  submitRoll(): void {
    this.isRolling.set(true);
    this.roll.emit({
      dieType: this.selectedDie(),
      mode: this.selectedMode(),
    });

    window.setTimeout(() => this.isRolling.set(false), 850);
  }
}
