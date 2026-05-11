import { Injectable, computed, signal } from "@angular/core";

import { RoomState, SessionStatePayload } from "../types/room";

@Injectable({ providedIn: "root" })
export class RoomStateService {
  private readonly roomStateSignal = signal<RoomState | null>(null);
  private readonly sessionStateSignal = signal<SessionStatePayload | null>(null);

  readonly roomState = computed(() => this.roomStateSignal());
  readonly sessionState = computed(() => this.sessionStateSignal());
  readonly isConnected = computed(() => this.roomStateSignal() !== null);

  setRoomState(state: RoomState): void {
    this.roomStateSignal.set(state);
  }

  setSessionState(state: SessionStatePayload): void {
    this.sessionStateSignal.set(state);
  }

  clear(): void {
    this.roomStateSignal.set(null);
    this.sessionStateSignal.set(null);
  }
}
