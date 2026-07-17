import { TestBed } from "@angular/core/testing";

import { SocketService } from "./socket.service";
import { RuntimeEndpointsService } from "./runtime-endpoints.service";

describe("SocketService", () => {
  let service: SocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: RuntimeEndpointsService,
          useValue: {
            socketUrl: () => "http://localhost:3000",
            socketPath: () => "/socket.io",
          },
        },
      ],
    });
    service = TestBed.inject(SocketService);
  });

  it("emit() no lanza error si el socket no está inicializado", () => {
    expect(() => service.emit("test", { data: 1 })).not.toThrow();
  });

  it("on() emite error si el socket no está inicializado", () => {
    const errors: unknown[] = [];
    service.on("any-event").subscribe({ error: (e) => errors.push(e) });
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toMatch(/connect\(\)/);
  });

  it("disconnect() no lanza error si no hay socket activo", () => {
    expect(() => service.disconnect()).not.toThrow();
  });
});
