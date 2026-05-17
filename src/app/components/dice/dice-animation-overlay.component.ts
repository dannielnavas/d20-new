import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DiceEntry } from '../../types/room';

@Component({
  selector: 'app-dice-animation-overlay',
  standalone: true,
  template: `
    <div class="pointer-events-none fixed inset-0 z-[100] flex flex-col-reverse items-center justify-center gap-8 p-4 pb-20">
      @for (roll of rolls(); track roll.id) {
        <div class="dice-roll-toast flex flex-col items-center">
          <div class="text-white text-lg md:text-xl font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] mb-4 bg-slate-900/90 px-6 py-2 rounded-full backdrop-blur-md border border-slate-600/50 flex items-center gap-2 shadow-xl">
            <span class="material-symbols-outlined text-emerald-400">casino</span>
            <span>{{ roll.by }} lanzó</span>
            @if (roll.mode === 'advantage') {
              <span class="text-emerald-400 uppercase text-sm tracking-widest bg-emerald-500/20 px-2 py-0.5 rounded-md ml-1 border border-emerald-500/30">Ventaja</span>
            }
            @if (roll.mode === 'disadvantage') {
              <span class="text-rose-400 uppercase text-sm tracking-widest bg-rose-500/20 px-2 py-0.5 rounded-md ml-1 border border-rose-500/30">Desventaja</span>
            }
          </div>
          
          <div class="relative flex items-center justify-center group">
            <div class="h-28 w-28 md:h-36 md:w-36 rounded-3xl bg-gradient-to-br from-emerald-400 via-emerald-600 to-emerald-900 border-4 border-emerald-300 shadow-[0_0_60px_rgba(16,185,129,0.8)] flex items-center justify-center transform rotate-3 relative overflow-hidden">
              <!-- Glossy reflection -->
              <div class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-white/70 opacity-60"></div>
              <div class="absolute -inset-1 bg-gradient-to-b from-white/30 to-transparent blur-sm"></div>
              
              <span class="text-6xl md:text-7xl font-display font-black text-white drop-shadow-[0_5px_10px_rgba(0,0,0,0.7)] relative z-10">
                {{ roll.total }}
              </span>
            </div>
            
            <div class="absolute -bottom-5 bg-black text-emerald-400 text-sm md:text-base font-black px-5 py-2 rounded-xl border-2 border-emerald-500 shadow-2xl uppercase tracking-widest z-20">
              {{ roll.dieType }}
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
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
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiceAnimationOverlayComponent {
  readonly rolls = input<DiceEntry[]>([]);
}
