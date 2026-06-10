import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DiceEntry } from '../../types/room';

import { Dice3dComponent } from './dice-3d.component';

@Component({
  selector: 'app-dice-animation-overlay',
  standalone: true,
  imports: [Dice3dComponent],
  template: `
    <div
      class="pointer-events-none fixed inset-0 z-50 flex flex-col-reverse items-center justify-center gap-6 p-4 pb-12 md:pb-16"
    >
      @for (roll of rolls(); track roll.id) {
        <div class="dice-roll-toast flex min-h-full w-full flex-col items-center justify-center">
          <div
            class="text-white text-lg md:text-xl font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] mb-4 bg-slate-900/90 px-6 py-2 rounded-full backdrop-blur-md border border-slate-600/50 flex items-center gap-2 shadow-xl flex-wrap justify-center text-center"
          >
            <span class="material-symbols-outlined text-emerald-400">casino</span>
            <span>
              {{ roll.by }} lanzó
              @if (roll.rolls.length > 1 && roll.mode === 'normal') {
                {{ roll.rolls.length }}{{ roll.dieType }}
              } @else {
                {{ roll.dieType }}
              }
            </span>
            @if (roll.rolls.length > 1 && roll.mode === 'normal') {
              <span
                class="text-emerald-300 font-mono text-sm ml-1 bg-slate-950/50 px-2.5 py-0.5 rounded-md border border-emerald-500/20"
              >
                ({{ roll.rolls.join(' + ') }})
              </span>
            }
            @if (roll.mode === 'advantage') {
              <span
                class="text-emerald-400 uppercase text-sm tracking-widest bg-emerald-500/20 px-2 py-0.5 rounded-md ml-1 border border-emerald-500/30"
                >Ventaja</span
              >
              <span
                class="text-slate-400 font-mono text-xs ml-1 bg-slate-950/50 px-2 py-0.5 rounded-md"
                >({{ roll.rolls[0] }} y {{ roll.rolls[1] }})</span
              >
            }
            @if (roll.mode === 'disadvantage') {
              <span
                class="text-rose-400 uppercase text-sm tracking-widest bg-rose-500/20 px-2 py-0.5 rounded-md ml-1 border border-rose-500/30"
                >Desventaja</span
              >
              <span
                class="text-slate-400 font-mono text-xs ml-1 bg-slate-950/50 px-2 py-0.5 rounded-md"
                >({{ roll.rolls[0] }} y {{ roll.rolls[1] }})</span
              >
            }
          </div>

          <div class="relative flex w-full flex-col items-center justify-center gap-6 group">
            <!-- Row of dice results (if multiple dice rolled normally) -->
            @if (roll.rolls.length > 1 && roll.mode === 'normal') {
              <div class="flex items-center justify-center gap-3 flex-wrap max-w-lg md:max-w-xl">
                @for (subRoll of roll.rolls; track $index) {
                  <div
                    class="h-20 w-20 md:h-24 md:w-24 rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-600 to-emerald-900 border-2 border-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.6)] flex items-center justify-center relative overflow-hidden transform hover:scale-105 transition-all"
                  >
                    <div
                      class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-white/50 opacity-40"
                    ></div>
                    <span
                      class="text-3xl md:text-4xl font-display font-black text-white drop-shadow-[0_3px_6px_rgba(0,0,0,0.7)] relative z-10"
                    >
                      {{ subRoll }}
                    </span>
                  </div>
                }
              </div>
            } @else {
              <!-- Single big die result (or advantage/disadvantage d20) -->
              <div
                class="relative flex min-h-[52vh] w-full items-center justify-center md:min-h-[62vh]"
              >
                <div class="transform rotate-3 relative">
                  <app-dice-3d
                    [value]="roll.total"
                    [dieType]="roll.dieType"
                    [fullscreen]="true"
                  ></app-dice-3d>
                </div>
              </div>
            }

            <!-- Die type badge & Sum total badge -->
            <div class="flex items-center gap-2 z-20">
              <div
                class="bg-black text-emerald-400 text-xs md:text-sm font-black px-4 py-1.5 rounded-lg border border-emerald-500 shadow-2xl uppercase tracking-widest"
              >
                @if (roll.rolls.length > 1 && roll.mode === 'normal') {
                  {{ roll.rolls.length }}{{ roll.dieType }}
                } @else {
                  {{ roll.dieType }}
                }
              </div>

              @if (roll.rolls.length > 1 && roll.mode === 'normal' && roll.dieType !== 'd20') {
                <div
                  class="bg-emerald-500 text-slate-950 text-xs md:text-sm font-black px-4 py-1.5 rounded-lg border border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.5)] uppercase tracking-widest animate-pulse"
                >
                  Total: {{ roll.total }}
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .dice-roll-toast {
        animation: rollEntrance 5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
      }

      @keyframes rollEntrance {
        0% {
          opacity: 0;
          transform: scale(0.3) translateY(150px) rotate(-45deg);
        }
        8% {
          opacity: 1;
          transform: scale(1.1) translateY(0) rotate(15deg);
        }
        12% {
          transform: scale(1) translateY(0) rotate(0deg);
        }
        85% {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
        95% {
          opacity: 0;
          transform: scale(1.3) translateY(-50px);
        }
        100% {
          opacity: 0;
          transform: scale(1.3) translateY(-50px);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .dice-roll-toast {
          animation: none !important;
          opacity: 1 !important;
          transform: none !important;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiceAnimationOverlayComponent {
  readonly rolls = input<DiceEntry[]>([]);
}
