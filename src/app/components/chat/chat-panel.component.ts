import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { ActivityEntry, ChatEntry, Role } from '../../types/room';

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  templateUrl: './chat-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPanelComponent {
  readonly chatLog = input<ChatEntry[]>([]);
  readonly activityLog = input<ActivityEntry[]>([]);
  readonly role = input<Role | null>(null);

  readonly sendMessage = output<string>();
  readonly messageDraft = signal('');

  readonly mergedFeed = computed(() => {
    return this.chatLog()
      .map((entry) => ({
        id: entry.id,
        ts: entry.ts,
        text: `${entry.by}: ${entry.text}`,
      }))
      .sort((a, b) => a.ts - b.ts)
      .slice(-80);
  });

  submit(): void {
    const text = this.messageDraft().trim();
    if (!text) {
      return;
    }
    this.sendMessage.emit(text);
    this.messageDraft.set('');
  }
}
