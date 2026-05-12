import { Injectable } from '@angular/core';

import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class RuntimeEndpointsService {
  private isDiscordActivityContext(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const params = new URL(window.location.href).searchParams;
    return params.has('frame_id');
  }

  apiBaseUrl(): string {
    if (this.isDiscordActivityContext()) {
      return '/api';
    }

    return environment.apiUrl;
  }

  socketUrl(): string {
    if (this.isDiscordActivityContext()) {
      return window.location.origin;
    }

    return environment.socketUrl;
  }

  socketPath(): string {
    return '/socketio';
  }
}
