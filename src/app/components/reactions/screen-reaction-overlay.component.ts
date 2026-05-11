import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "app-screen-reaction-overlay",
  standalone: true,
  templateUrl: "./screen-reaction-overlay.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScreenReactionOverlayComponent {
  readonly reactions = input<string[]>([]);
}
