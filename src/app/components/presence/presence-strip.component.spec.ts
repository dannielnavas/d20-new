import { TestBed } from "@angular/core/testing";

import { PresenceStripComponent } from "./presence-strip.component";

describe("PresenceStripComponent", () => {
  it("should create", async () => {
    await TestBed.configureTestingModule({ imports: [PresenceStripComponent] }).compileComponents();
    const fixture = TestBed.createComponent(PresenceStripComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
