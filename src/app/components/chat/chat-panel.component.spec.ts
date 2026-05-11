import { TestBed } from "@angular/core/testing";

import { ChatPanelComponent } from "./chat-panel.component";

describe("ChatPanelComponent", () => {
  it("should create", async () => {
    await TestBed.configureTestingModule({ imports: [ChatPanelComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ChatPanelComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
