import { TestBed } from "@angular/core/testing";

import { DmHudComponent } from "./dm-hud.component";

describe("DmHudComponent", () => {
  it("should create", async () => {
    await TestBed.configureTestingModule({ imports: [DmHudComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DmHudComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
