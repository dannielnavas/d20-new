import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { DmAuthService } from '../../services/dm-auth.service';
import { SessionListItem, SessionsService } from '../../services/sessions.service';

interface SessionWithUrl extends SessionListItem {
  fullSessionUrl: string | null;
}

const TOKEN_STORAGE_PREFIX = 'd20.session.token.';

@Component({
  selector: 'app-sessions-page',
  imports: [RouterLink],
  templateUrl: './sessions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly dmAuth = inject(DmAuthService);
  private readonly sessionsService = inject(SessionsService);

  readonly sessions = signal<SessionWithUrl[]>([]);
  readonly newSessionName = signal('');
  readonly createPending = signal(false);
  readonly createError = signal('');
  readonly loadError = signal('');
  readonly copiedId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);

  ngOnInit(): void {
    if (!this.dmAuth.getToken()) {
      void this.router.navigate(['/login']);
      return;
    }
    void this.loadSessions();
  }

  async loadSessions(): Promise<void> {
    this.loadError.set('');
    try {
      const result = await firstValueFrom(this.sessionsService.list());
      const merged: SessionWithUrl[] = result.sessions.map((s) => ({
        ...s,
        fullSessionUrl: this.buildFullUrl(s.sessionId),
      }));
      this.sessions.set(merged);
    } catch {
      this.loadError.set('No se pudieron cargar las sesiones');
    }
  }

  async createSession(): Promise<void> {
    const name = this.newSessionName().trim();
    if (!name) {
      this.createError.set('Ingresa un nombre para la sesión');
      return;
    }

    this.createError.set('');
    this.createPending.set(true);

    try {
      const created = await firstValueFrom(this.sessionsService.create(name));
      localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${created.sessionId}`, created.accessToken);

      const newSession: SessionWithUrl = {
        sessionId: created.sessionId,
        name: created.name,
        createdAt: Date.now(),
        playerCount: 0,
        sessionUrl: created.sessionUrl,
        fullSessionUrl: this.buildFullUrl(created.sessionId),
      };

      this.sessions.update((list) => [newSession, ...list]);
      this.newSessionName.set('');
    } catch {
      this.createError.set('No se pudo crear la sesión');
    } finally {
      this.createPending.set(false);
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.deletingId.set(sessionId);
    try {
      await firstValueFrom(this.sessionsService.delete(sessionId));
      localStorage.removeItem(`${TOKEN_STORAGE_PREFIX}${sessionId}`);
      this.sessions.update((list) => list.filter((s) => s.sessionId !== sessionId));
    } catch {
      // keep session in list on error
    } finally {
      this.deletingId.set(null);
    }
  }

  async copyUrl(session: SessionWithUrl): Promise<void> {
    const url = session.fullSessionUrl;
    if (!url) return;
    await navigator.clipboard.writeText(window.location.origin + url);
    this.copiedId.set(session.sessionId);
    setTimeout(() => this.copiedId.set(null), 2000);
  }

  joinAsGm(session: SessionWithUrl): void {
    void this.router.navigate(['/play', session.sessionId], {
      queryParams: { token: localStorage.getItem(`${TOKEN_STORAGE_PREFIX}${session.sessionId}`), role: 'dm' },
    });
  }

  private buildFullUrl(sessionId: string): string | null {
    const token = localStorage.getItem(`${TOKEN_STORAGE_PREFIX}${sessionId}`);
    if (!token) return null;
    return `/play/${sessionId}?token=${token}`;
  }
}
