import { TestBed } from "@angular/core/testing";

import { RoomStateService } from "./room-state.service";

describe("RoomStateService", () => {
  it("guarda y limpia room/session state", () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(RoomStateService);

    service.setSessionState({ role: "player" });
    service.setRoomState({
      roomId: "demo",
      roomVersion: 1,
      sessionPasswordConfigured: false,
      settings: {
        backgroundUrl: "",
        backgroundType: "image",
        gridSize: 50,
        snapToGrid: true,
        playersCanPing: true,
        mapAudioEnabled: false,
        mapVolume: 50,
        discordInviteUrl: "",
      },
      tokens: [],
      chatLog: [],
      activityLog: [],
      diceLog: [],
      initiative: { visible: false, order: [], currentIndex: 0 },
      presence: [],
    });

    expect(service.isConnected()).toBe(true);
    expect(service.sessionState()?.role).toBe("player");

    service.clear();
    expect(service.roomState()).toBeNull();
    expect(service.sessionState()).toBeNull();
  });
});
