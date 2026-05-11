import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";

import { environment } from "../../environments/environment";
import { DmAuthService } from "./dm-auth.service";

describe("DmAuthService", () => {
  it("autentica y guarda token en sessionStorage", async () => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    const service = TestBed.inject(DmAuthService);
    const http = TestBed.inject(HttpTestingController);

    const authPromise = service.authenticate("my-secret");

    const req = http.expectOne(`${environment.apiUrl}/auth/dm`);
    expect(req.request.method).toBe("POST");
    req.flush({ token: "jwt-token", expiresIn: "12h" });

    await authPromise;

    expect(service.getToken()).toBe("jwt-token");
    http.verify();
  });
});
