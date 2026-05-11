import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { environment } from "../../environments/environment";

interface DmAuthResponse {
  token: string;
  expiresIn: string;
}

@Injectable({ providedIn: "root" })
export class DmAuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenStorageKey = "d20.dm.token";

  async authenticate(dmKey: string): Promise<DmAuthResponse> {
    const response = await firstValueFrom(
      this.http.post<DmAuthResponse>(`${environment.apiUrl}/auth/dm`, { dmKey }),
    );

    sessionStorage.setItem(this.tokenStorageKey, response.token);
    return response;
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.tokenStorageKey);
  }

  clearToken(): void {
    sessionStorage.removeItem(this.tokenStorageKey);
  }
}
