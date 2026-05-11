import { TestBed } from "@angular/core/testing";

import { DiscordActivityDockComponent } from "./discord-activity-dock.component";

describe("DiscordActivityDockComponent", () => {
  it("should create", async () => {
    await TestBed.configureTestingModule({ imports: [DiscordActivityDockComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DiscordActivityDockComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
