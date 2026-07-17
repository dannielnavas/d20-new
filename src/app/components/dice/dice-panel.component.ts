import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { DiceEntry, Role } from '../../types/room';

export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';
export type RollMode = 'normal' | 'advantage' | 'disadvantage';

interface DieOption {
  type: DieType;
  label: string;
  /** Escuela de magia D&D — se muestra como tooltip */
  school: string;
  /** Clases Tailwind cuando el dado está activo/seleccionado */
  activeClass: string;
  /** Clases del borde del botón cuando está seleccionado */
  activeBorder: string;
  /** Clases base cuando no está seleccionado */
  idleClass: string;
}

@Component({
  selector: 'app-dice-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dice-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DicePanelComponent {
  readonly Math = Math;
  readonly diceLog = input<DiceEntry[]>([]);
  readonly role = input<Role | null>(null);

  readonly roll = output<{ dieType: DieType; mode: RollMode; count?: number; secret?: boolean }>();
  readonly resetLog = output<void>();

  readonly selectedDie = signal<DieType>('d20');
  readonly selectedMode = signal<RollMode>('normal');
  readonly selectedCount = signal<number>(1);
  readonly secretRoll = signal<boolean>(false);
  readonly isRolling = signal(false);
  readonly recentLog = computed(() => this.diceLog().slice(-12).reverse());

  /**
   * Todos los dados comparten la silueta del d20 (el dado icónico de D&D).
   * Cada uno tiene un color único que evoca una escuela de magia.
   */
  readonly diceOptions: DieOption[] = [
    {
      type: 'd4',
      label: 'd4',
      school: 'Evocación · Fuego',
      activeClass:
        'bg-red-950 text-red-200 shadow-[0_0_22px_rgba(239,68,68,0.60),inset_0_0_30px_rgba(239,68,68,0.12)]',
      activeBorder: 'border-red-500/80',
      idleClass: 'text-red-500/50 hover:text-red-300/80',
    },
    {
      type: 'd6',
      label: 'd6',
      school: 'Conjuración · Arcano',
      activeClass:
        'bg-violet-950 text-violet-200 shadow-[0_0_22px_rgba(139,92,246,0.60),inset_0_0_30px_rgba(139,92,246,0.12)]',
      activeBorder: 'border-violet-500/80',
      idleClass: 'text-violet-500/50 hover:text-violet-300/80',
    },
    {
      type: 'd8',
      label: 'd8',
      school: 'Transmutación · Naturaleza',
      activeClass:
        'bg-emerald-950 text-emerald-200 shadow-[0_0_22px_rgba(16,185,129,0.60),inset_0_0_30px_rgba(16,185,129,0.12)]',
      activeBorder: 'border-emerald-500/80',
      idleClass: 'text-emerald-500/50 hover:text-emerald-300/80',
    },
    {
      type: 'd10',
      label: 'd10',
      school: 'Ilusión · Sombra',
      activeClass:
        'bg-purple-950 text-purple-200 shadow-[0_0_22px_rgba(168,85,247,0.60),inset_0_0_30px_rgba(168,85,247,0.12)]',
      activeBorder: 'border-purple-500/80',
      idleClass: 'text-purple-500/50 hover:text-purple-300/80',
    },
    {
      type: 'd12',
      label: 'd12',
      school: 'Adivinación · Sagrado',
      activeClass:
        'bg-amber-950 text-amber-200 shadow-[0_0_22px_rgba(245,158,11,0.60),inset_0_0_30px_rgba(245,158,11,0.12)]',
      activeBorder: 'border-amber-500/80',
      idleClass: 'text-amber-500/50 hover:text-amber-300/80',
    },
    {
      type: 'd20',
      label: 'd20',
      school: '★ El dado legendario',
      activeClass:
        'bg-yellow-950 text-yellow-100 shadow-[0_0_30px_rgba(250,204,21,0.75),inset_0_0_40px_rgba(250,204,21,0.18)]',
      activeBorder: 'border-yellow-400',
      idleClass: 'text-yellow-500/60 hover:text-yellow-300/90',
    },
    {
      type: 'd100',
      label: 'd%',
      school: 'Magia Salvaje · Caos',
      activeClass:
        'bg-fuchsia-950 text-fuchsia-200 shadow-[0_0_22px_rgba(232,121,249,0.60),inset_0_0_30px_rgba(232,121,249,0.12)]',
      activeBorder: 'border-fuchsia-500/80',
      idleClass: 'text-fuchsia-500/50 hover:text-fuchsia-300/80',
    },
  ];

  submitRoll(): void {
    this.isRolling.set(true);
    this.roll.emit({
      dieType: this.selectedDie(),
      mode: this.selectedMode(),
      count: this.selectedCount(),
      secret: this.secretRoll(),
    });

    window.setTimeout(() => this.isRolling.set(false), 850);
  }

  getSelectedOption(): DieOption | undefined {
    return this.diceOptions.find((d) => d.type === this.selectedDie());
  }
}
