import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { DmAuthService } from './dm-auth.service';
import { RuntimeEndpointsService } from './runtime-endpoints.service';

export interface CreateSessionResponse {
  sessionId: string;
  name: string;
  accessToken: string;
  sessionUrl: string;
}

export interface SessionListItem {
  sessionId: string;
  name: string;
  createdAt: number;
  playerCount: number;
  sessionUrl: string;
}

@Injectable({ providedIn: 'root' })
export class SessionsService {
  private readonly http = inject(HttpClient);
  private readonly dmAuth = inject(DmAuthService);
  private readonly runtimeEndpoints = inject(RuntimeEndpointsService);

  private get headers(): HttpHeaders {
    const token = this.dmAuth.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` });
  }

  private get baseUrl(): string {
    return `${this.runtimeEndpoints.apiBaseUrl()}/sessions`;
  }

  create(name: string): Observable<CreateSessionResponse> {
    return this.http.post<CreateSessionResponse>(this.baseUrl, { name }, { headers: this.headers });
  }

  list(): Observable<{ sessions: SessionListItem[] }> {
    return this.http.get<{ sessions: SessionListItem[] }>(this.baseUrl, { headers: this.headers });
  }

  delete(sessionId: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/${sessionId}`, {
      headers: this.headers,
    });
  }
}
