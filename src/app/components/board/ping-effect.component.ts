import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-ping-effect',
  standalone: true,
  template: `
    <div
      class="absolute pointer-events-none"
      [style.left.%]="(x() / 1600) * 100"
      [style.top.%]="(y() / 900) * 100"
    >
      <div class="animate-ping-expand">
        <div
          class="h-6 w-6 rounded-full border-2 border-amber-400 -translate-x-1/2 -translate-y-1/2 shadow-lg shadow-amber-500/50"
        ></div>
      </div>
      <div class="absolute animate-ping-pulse">
        <div
          class="h-6 w-6 rounded-full border-2 border-amber-400/60 -translate-x-1/2 -translate-y-1/2"
        ></div>
      </div>
    </div>
  `,
  styles: `
    @keyframes pingExpand {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      100% {
        transform: scale(3);
        opacity: 0;
      }
    }

    @keyframes pingPulse {
      75% {
        transform: scale(2.5);
        opacity: 0.1;
      }
      100% {
        transform: scale(3.5);
        opacity: 0;
      }
    }

    :host ::ng-deep .animate-ping-expand {
      animation: pingExpand 1s ease-out forwards;
    }

    :host ::ng-deep .animate-ping-pulse {
      animation: pingPulse 1s ease-out forwards;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PingEffectComponent {
  readonly x = input<number>(0);
  readonly y = input<number>(0);
}
