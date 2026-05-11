import { TestBed } from "@angular/core/testing";

import { DicePanelComponent } from "./dice-panel.component";

describe("DicePanelComponent", () => {
  it("should create", async () => {
    await TestBed.configureTestingModule({ imports: [DicePanelComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DicePanelComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
