import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DiceEntry } from '../../types/room';
import { Dice3dComponent } from './dice-3d.component';

@Component({
  selector: 'app-dice-animation-overlay',
  standalone: true,
  imports: [CommonModule, Dice3dComponent],
  host: {
    class: 'pointer-events-none',
    style: 'position:fixed;inset:0;z-index:200;',
  },
  template: `
    @for (roll of rolls(); track roll.id; let last = $last) {

      <!-- ══ ESCENA COMPLETA ══ -->
      <div class="dice-scene absolute inset-0 flex flex-col items-center justify-between py-10 px-6 overflow-hidden"
        [class.is-nat20]="roll.total === 20 && roll.dieType === 'd20'"
        [class.is-nat1]="roll.total === 1  && roll.dieType === 'd20'"
      >

        <!-- ── Fondo con blur y glow centrado ── -->
        <div class="absolute inset-0 dice-backdrop"></div>

        <!-- Glow radial para Nat 20 -->
        @if (roll.total === 20 && roll.dieType === 'd20') {
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="nat20-glow"></div>
          </div>
          <!-- Destellos decorativos -->
          <div class="absolute inset-0 stars-layer" aria-hidden="true"></div>
        }

        <!-- Glow radial para Nat 1 -->
        @if (roll.total === 1 && roll.dieType === 'd20') {
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="nat1-glow"></div>
          </div>
        }

        <!-- ── CABECERA: quién tiró y qué ── -->
        <div class="relative z-10 roller-header flex flex-col items-center gap-2 text-center">

          <!-- Nombre del jugador -->
          <div class="flex items-center gap-2 px-5 py-2 rounded-full backdrop-blur-md border"
            [ngClass]="roll.total === 20 && roll.dieType === 'd20'
              ? 'bg-amber-950/70 border-amber-600/50'
              : roll.total === 1 && roll.dieType === 'd20'
              ? 'bg-rose-950/70 border-rose-600/50'
              : 'bg-black/60 border-white/10'"
          >
            <span class="material-symbols-outlined text-[16px] text-slate-400">person</span>
            <span class="font-bold text-white text-lg leading-none">{{ roll.by }}</span>
          </div>

          <!-- Tipo de dado + modo -->
          <div class="flex items-center gap-2">
            <span class="text-slate-500 text-sm tracking-widest uppercase font-medium">
              lanzó&nbsp;
              @if (roll.rolls.length > 1 && roll.mode === 'normal') {
                {{ roll.rolls.length }}{{ roll.dieType }}
              } @else {
                {{ roll.dieType }}
              }
            </span>
            @if (roll.mode === 'advantage') {
              <span class="text-xs font-black text-emerald-300 bg-emerald-900/50 border border-emerald-600/40 px-2.5 py-0.5 rounded-full uppercase tracking-widest">↑ Ventaja</span>
            } @else if (roll.mode === 'disadvantage') {
              <span class="text-xs font-black text-rose-300 bg-rose-900/50 border border-rose-600/40 px-2.5 py-0.5 rounded-full uppercase tracking-widest">↓ Desventaja</span>
            }
            @if (roll.secret) {
              <span class="text-xs font-black text-indigo-300 bg-indigo-900/50 border border-indigo-600/40 px-2.5 py-0.5 rounded-full uppercase tracking-widest">Solo DM</span>
            }
          </div>
        </div>

        <!-- ── ÁREA CENTRAL: dado animado ── -->
        <div class="relative z-10 flex-1 flex items-center justify-center w-full">

          @if (roll.rolls.length > 1 && roll.mode === 'normal') {

            <!-- MÚLTIPLES DADOS: cuadrículas grandes -->
            <div class="multi-dice-grid flex flex-wrap items-center justify-center gap-4 max-w-lg">
              @for (v of roll.rolls; track $index) {
                <div
                  class="die-card"
                  [ngClass]="v === 20 && roll.dieType === 'd20'
                    ? 'bg-amber-950 border-amber-500 text-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.6)]'
                    : v === 1 && roll.dieType === 'd20'
                    ? 'bg-rose-950 border-rose-500 text-rose-300 shadow-[0_0_24px_rgba(239,68,68,0.5)]'
                    : 'bg-slate-900/90 border-slate-600/60 text-white shadow-[0_8px_32px_rgba(0,0,0,0.6)]'"
                  [style.animation-delay]="$index * 80 + 'ms'"
                >
                  <!-- Mini silueta d20 de fondo -->
                  <svg viewBox="0 0 100 100" class="absolute inset-0 w-full h-full opacity-10 pointer-events-none" aria-hidden="true">
                    <polygon points="50,4 96,88 4,88" fill="currentColor"/>
                    <polygon points="50,80 34,50 66,50" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round" opacity="0.7"/>
                  </svg>
                  <span class="relative z-10 font-black font-display text-5xl leading-none drop-shadow-lg">{{ v }}</span>
                </div>
              }
            </div>

          } @else {

            <!-- DADO ÚNICO: 3D en pantalla completa -->
            <div class="single-die-wrapper">
              <app-dice-3d
                [value]="roll.total"
                [dieType]="roll.dieType"
                [fullscreen]="true"
              />
            </div>

          }
        </div>

        <!-- ── RESULTADO FINAL ── -->
        <div class="relative z-10 result-area flex flex-col items-center gap-3 text-center">

          <!-- Etiqueta especial -->
          @if (roll.total === 20 && roll.dieType === 'd20') {
            <p class="nat20-label">¡Golpe Crítico!</p>
          } @else if (roll.total === 1 && roll.dieType === 'd20') {
            <p class="nat1-label">¡Pifia Total!</p>
          }

          <!-- Resultado numérico (solo para múltiples dados) -->
          @if (roll.rolls.length > 1 && roll.mode === 'normal') {
            <div class="flex items-center gap-3">
              <span class="text-slate-600 text-2xl font-bold">=</span>
              <span
                class="font-display font-black leading-none"
                style="font-size: clamp(5rem, 18vw, 10rem);"
                [ngClass]="roll.total === 20 && roll.dieType === 'd20'
                  ? 'text-amber-300 drop-shadow-[0_0_30px_rgba(251,191,36,1)]'
                  : roll.total === 1 && roll.dieType === 'd20'
                  ? 'text-rose-400 drop-shadow-[0_0_24px_rgba(239,68,68,0.9)]'
                  : 'text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]'"
              >{{ roll.total }}</span>
            </div>
            <p class="text-slate-600 text-sm font-mono">{{ roll.rolls.join(' + ') }}</p>
          }

          <!-- Dados adv/desadv: mostrar ambos valores -->
          @if ((roll.mode === 'advantage' || roll.mode === 'disadvantage') && roll.rolls.length > 1) {
            <p class="text-slate-500 text-sm font-mono tracking-wider">
              {{ roll.rolls[0] }} · {{ roll.rolls[1] }}
            </p>
          }

          <!-- Barra de cuenta regresiva -->
          <div class="countdown-bar-track">
            <div
              class="countdown-bar-fill"
              [ngClass]="roll.total === 20 && roll.dieType === 'd20'
                ? 'bg-amber-400'
                : roll.total === 1 && roll.dieType === 'd20'
                ? 'bg-rose-500'
                : 'bg-purple-500'"
            ></div>
          </div>

        </div>

      </div>
      <!-- /ESCENA -->

    }
  `,
  styles: [`

    /* ── Ciclo de vida de la escena: 5 segundos ── */
    .dice-scene {
      animation: sceneLifecycle 5s cubic-bezier(0.4, 0, 0.6, 1) forwards;
    }

    @keyframes sceneLifecycle {
      0%   { opacity: 0; }
      6%   { opacity: 1; }
      78%  { opacity: 1; }
      100% { opacity: 0; }
    }

    /* ── Fondo ── */
    .dice-backdrop {
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      background: rgba(6, 5, 14, 0.90);
    }

    .is-nat20 .dice-backdrop {
      background: radial-gradient(ellipse at 50% 50%, rgba(25, 15, 0, 0.92) 0%, rgba(6, 5, 14, 0.96) 70%);
    }

    .is-nat1 .dice-backdrop {
      background: radial-gradient(ellipse at 50% 50%, rgba(25, 0, 0, 0.92) 0%, rgba(6, 5, 14, 0.96) 70%);
    }

    /* ── Glow radial Nat 20 ── */
    .nat20-glow {
      width: min(90vw, 90vh);
      height: min(90vw, 90vh);
      border-radius: 50%;
      background: radial-gradient(circle, rgba(251,191,36,0.22) 0%, rgba(245,158,11,0.06) 50%, transparent 70%);
      animation: nat20Pulse 1.8s ease-in-out infinite alternate;
    }

    @keyframes nat20Pulse {
      from { transform: scale(0.85); opacity: 0.6; }
      to   { transform: scale(1.20); opacity: 1.0; }
    }

    /* ── Glow radial Nat 1 ── */
    .nat1-glow {
      width: min(90vw, 90vh);
      height: min(90vw, 90vh);
      border-radius: 50%;
      background: radial-gradient(circle, rgba(239,68,68,0.18) 0%, rgba(220,38,38,0.05) 50%, transparent 70%);
      animation: nat20Pulse 1.4s ease-in-out infinite alternate;
    }

    .stars-layer {
      background-image:
        radial-gradient(2px 2px at 20% 22%, rgba(251,191,36,0.75) 0%, transparent 100%),
        radial-gradient(1.5px 1.5px at 80% 16%, rgba(251,191,36,0.65) 0%, transparent 100%),
        radial-gradient(1.5px 1.5px at 85% 76%, rgba(251,191,36,0.65) 0%, transparent 100%);
      animation: twinkle 1.2s ease-in-out infinite alternate;
    }
    @keyframes twinkle {
      from { opacity: 0.4; } to { opacity: 1.0; }
    }

    /* ── Cabecera ── */
    .roller-header {
      animation: slideDown 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-30px) scale(0.9); }
      to   { opacity: 1; transform: translateY(0)    scale(1);   }
    }

    /* ── Dado único ── */
    .single-die-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      animation: dieAppear 0.5s ease-out both;
    }

    @keyframes dieAppear {
      from { opacity: 0; transform: scale(0.6); }
      to   { opacity: 1; transform: scale(1);   }
    }

    /* ── Cuadrícula de múltiples dados ── */
    .multi-dice-grid {
      animation: dieAppear 0.4s ease-out 0.1s both;
    }

    /* Carta individual en la cuadrícula */
    .die-card {
      position: relative;
      width: clamp(72px, 16vw, 120px);
      height: clamp(72px, 16vw, 120px);
      border-radius: 20px;
      border: 2px solid;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      animation: cardBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      animation-delay: inherit;
    }

    @keyframes cardBounce {
      from { opacity: 0; transform: translateY(40px) scale(0.6) rotate(-8deg); }
      to   { opacity: 1; transform: translateY(0)    scale(1)   rotate(0deg);  }
    }

    /* ── Resultado ── */
    .result-area {
      animation: resultReveal 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      animation-delay: 1.5s;
    }

    @keyframes resultReveal {
      from { opacity: 0; transform: scale(0.5) translateY(40px); filter: blur(8px); }
      to   { opacity: 1; transform: scale(1)   translateY(0);    filter: blur(0);   }
    }

    /* ── Etiquetas especiales ── */
    .nat20-label {
      font-size: clamp(1.5rem, 5vw, 2.5rem);
      font-weight: 900;
      font-family: var(--font-fantasy, serif);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #fbbf24;
      text-shadow: 0 0 30px rgba(251,191,36,0.9), 0 0 60px rgba(251,191,36,0.4);
      animation: nat20Flash 0.8s ease-in-out infinite alternate;
      animation-delay: 1.5s;
    }

    @keyframes nat20Flash {
      from { text-shadow: 0 0 20px rgba(251,191,36,0.8), 0 0 40px rgba(251,191,36,0.3); }
      to   { text-shadow: 0 0 40px rgba(251,191,36,1.0), 0 0 80px rgba(251,191,36,0.6), 0 0 120px rgba(251,191,36,0.2); }
    }

    .nat1-label {
      font-size: clamp(1.5rem, 5vw, 2.5rem);
      font-weight: 900;
      font-family: var(--font-fantasy, serif);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #f87171;
      text-shadow: 0 0 24px rgba(239,68,68,0.8), 0 0 48px rgba(239,68,68,0.3);
      animation: nat1Shake 0.15s ease-in-out infinite alternate;
      animation-delay: 1.5s;
    }

    @keyframes nat1Shake {
      from { transform: translateX(-3px); }
      to   { transform: translateX(3px);  }
    }

    /* ── Barra de cuenta regresiva ── */
    .countdown-bar-track {
      width: min(240px, 60vw);
      height: 3px;
      background: rgba(255,255,255,0.08);
      border-radius: 9999px;
      overflow: hidden;
    }

    .countdown-bar-fill {
      height: 100%;
      border-radius: 9999px;
      animation: countdown 5s linear forwards;
    }

    @keyframes countdown {
      from { width: 100%; }
      to   { width: 0%;   }
    }

    /* ── Reduced motion ── */
    @media (prefers-reduced-motion: reduce) {
      .dice-scene,
      .roller-header,
      .single-die-wrapper,
      .multi-dice-grid,
      .die-card,
      .result-area,
      .nat20-glow,
      .nat1-glow,
      .stars-layer,
      .nat20-label,
      .nat1-label,
      .countdown-bar-fill {
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
        filter: none !important;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiceAnimationOverlayComponent {
  readonly rolls = input<DiceEntry[]>([]);
}
