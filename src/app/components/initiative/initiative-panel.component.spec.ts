import { TestBed } from "@angular/core/testing";

import { InitiativePanelComponent } from "./initiative-panel.component";

describe("InitiativePanelComponent", () => {
  it("should create", async () => {
    await TestBed.configureTestingModule({ imports: [InitiativePanelComponent] }).compileComponents();
    const fixture = TestBed.createComponent(InitiativePanelComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
