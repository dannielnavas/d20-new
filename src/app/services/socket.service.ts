import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { io, Socket } from "socket.io-client";

import { environment } from "../../environments/environment";

@Injectable({ providedIn: "root" })
export class SocketService {
  private socket: Socket | null = null;

  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(environment.socketUrl, {
      transports: ["websocket"],
      withCredentials: true,
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  emit<TPayload>(event: string, payload?: TPayload): void {
    this.socket?.emit(event, payload);
  }

  on<TPayload>(event: string): Observable<TPayload> {
    return new Observable<TPayload>((subscriber) => {
      if (!this.socket) {
        subscriber.error(new Error("Socket no inicializado. Llama connect() primero."));
        return;
      }

      const listener = (payload: TPayload) => {
        subscriber.next(payload);
      };

      this.socket.on(event, listener);
      return () => {
        this.socket?.off(event, listener);
      };
    });
  }
}
