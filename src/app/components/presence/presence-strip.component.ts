import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { PresenceEntry, Token } from '../../types/room';

@Component({
  selector: 'app-presence-strip',
  standalone: true,
  templateUrl: './presence-strip.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresenceStripComponent {
  readonly presence = input<PresenceEntry[]>([]);
  readonly tokens = input<Token[]>([]);

  resolvePresenceLabel(entry: PresenceEntry): string {
    if (entry.role === 'dm') {
      return 'dm';
    }

    const token = this.tokens().find((item) => item.claimedBy === entry.sessionId);
    return token?.name ?? 'jugador';
  }
}
