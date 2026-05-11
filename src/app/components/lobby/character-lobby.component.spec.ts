import { TestBed } from "@angular/core/testing";

import { CharacterLobbyComponent } from "./character-lobby.component";

describe("CharacterLobbyComponent", () => {
  it("should create", async () => {
    await TestBed.configureTestingModule({ imports: [CharacterLobbyComponent] }).compileComponents();
    const fixture = TestBed.createComponent(CharacterLobbyComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
