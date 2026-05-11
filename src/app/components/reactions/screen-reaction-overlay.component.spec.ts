import { TestBed } from "@angular/core/testing";

import { ScreenReactionOverlayComponent } from "./screen-reaction-overlay.component";

describe("ScreenReactionOverlayComponent", () => {
  it("should create", async () => {
    await TestBed.configureTestingModule({ imports: [ScreenReactionOverlayComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ScreenReactionOverlayComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
