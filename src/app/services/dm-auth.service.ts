import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { RuntimeEndpointsService } from './runtime-endpoints.service';

interface DmAuthResponse {
  token: string;
  expiresIn: string;
}

interface DmAuthErrorResponse {
  code?: string;
  message?: string;
}

export class DmAuthError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'DmAuthError';
  }
}

@Injectable({ providedIn: 'root' })
export class DmAuthService {
  private readonly http = inject(HttpClient);
  private readonly runtimeEndpoints = inject(RuntimeEndpointsService);
  private readonly tokenStorageKey = 'd20.dm.token';

  async authenticate(dmKey: string): Promise<DmAuthResponse> {
    try {
      const response = await firstValueFrom(
        this.http.post<DmAuthResponse>(`${this.runtimeEndpoints.apiBaseUrl()}/auth/dm`, { dmKey }),
      );

      sessionStorage.setItem(this.tokenStorageKey, response.token);
      return response;
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 0) {
          throw new DmAuthError(
            'No se pudo conectar al backend (CORS, red o HTTPS). Verifica el deploy y CLIENT_ORIGIN',
            0,
            'NETWORK_OR_CORS',
          );
        }

        const payload = error.error as DmAuthErrorResponse | string | null;
        const message =
          typeof payload === 'string'
            ? payload
            : payload?.message || error.message || 'No se pudo autenticar al DM';
        const code = typeof payload === 'string' ? undefined : payload?.code;
        throw new DmAuthError(message, error.status, code);
      }

      throw new DmAuthError('No se pudo autenticar al DM');
    }
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.tokenStorageKey);
  }

  clearToken(): void {
    sessionStorage.removeItem(this.tokenStorageKey);
  }
}
