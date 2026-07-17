import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";

import { SessionsService } from "./sessions.service";
import { DmAuthService } from "./dm-auth.service";
import { RuntimeEndpointsService } from "./runtime-endpoints.service";

describe("SessionsService", () => {
  let service: SessionsService;
  let http: HttpTestingController;
  const API_BASE = "http://localhost:3000";

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        {
          provide: DmAuthService,
          useValue: { getToken: () => "test-dm-token" },
        },
        {
          provide: RuntimeEndpointsService,
          useValue: { apiBaseUrl: () => API_BASE },
        },
      ],
    });

    service = TestBed.inject(SessionsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it("create() envía POST con nombre y Authorization header", () => {
    let result: unknown;
    service.create("Mi campaña").subscribe((r) => (result = r));

    const req = http.expectOne(`${API_BASE}/sessions`);
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toEqual({ name: "Mi campaña" });
    expect(req.request.headers.get("Authorization")).toBe("Bearer test-dm-token");

    req.flush({ sessionId: "abc", name: "Mi campaña", accessToken: "tok", sessionUrl: "/play/abc?token=tok" });

    expect((result as { sessionId: string }).sessionId).toBe("abc");
  });

  it("list() envía GET con Authorization header", () => {
    let result: unknown;
    service.list().subscribe((r) => (result = r));

    const req = http.expectOne(`${API_BASE}/sessions`);
    expect(req.request.method).toBe("GET");
    expect(req.request.headers.get("Authorization")).toBe("Bearer test-dm-token");

    const sessions = [{ sessionId: "s1", name: "Campaña 1", createdAt: 0, playerCount: 2, sessionUrl: "/play/s1?token=__redacted__" }];
    req.flush({ sessions });

    expect((result as { sessions: unknown[] }).sessions).toHaveLength(1);
  });

  it("delete() envía DELETE con Authorization header", () => {
    let result: unknown;
    service.delete("session-id-1").subscribe((r) => (result = r));

    const req = http.expectOne(`${API_BASE}/sessions/session-id-1`);
    expect(req.request.method).toBe("DELETE");
    expect(req.request.headers.get("Authorization")).toBe("Bearer test-dm-token");

    req.flush({ ok: true });

    expect((result as { ok: boolean }).ok).toBe(true);
  });

  it("create() sin token DM usa Bearer con string vacío", () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        {
          provide: DmAuthService,
          useValue: { getToken: () => null },
        },
        {
          provide: RuntimeEndpointsService,
          useValue: { apiBaseUrl: () => API_BASE },
        },
      ],
    });
    const s2 = TestBed.inject(SessionsService);
    const ctrl = TestBed.inject(HttpTestingController);

    s2.create("X").subscribe();
    const req = ctrl.expectOne(`${API_BASE}/sessions`);
    expect(req.request.headers.get("Authorization")).toBe("Bearer ");
    req.flush({ sessionId: "y", name: "X", accessToken: "t", sessionUrl: "" });
    ctrl.verify();
  });
});
