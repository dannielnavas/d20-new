import { ChangeDetectionStrategy, Component, inject, input, output } from "@angular/core";

import { DiscordService } from "../../services/discord.service";

@Component({
  selector: "app-discord-activity-dock",
  standalone: true,
  templateUrl: "./discord-activity-dock.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscordActivityDockComponent {
  protected readonly discordService = inject(DiscordService);

  readonly isActivity = input(false);
  readonly participants = input<string[]>([]);
  readonly activityError = input<{ code: string; message: string } | null>(null);
  readonly discordInviteUrl = input("");

  readonly dismissActivityError = output<void>();

  inviteHref(): string {
    return this.discordInviteUrl().trim();
  }
}
