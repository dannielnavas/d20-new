import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { DmAuthError, DmAuthService } from '../../services/dm-auth.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  private readonly themeService = inject(ThemeService);
  private readonly dmAuthService = inject(DmAuthService);
  private readonly router = inject(Router);

  readonly theme = this.themeService.theme;
  readonly dmKey = signal('');
  readonly dmAuthError = signal('');
  readonly dmAuthPending = signal(false);
  readonly dmAuthenticated = signal(false);

  toggleTheme(): void {
    this.themeService.toggle();
  }

  async enterAsDm(): Promise<void> {
    const dmKey = this.dmKey().trim();
    if (!dmKey) {
      this.dmAuthError.set('Ingresa la llave secreta del DM');
      return;
    }

    this.dmAuthError.set('');
    this.dmAuthPending.set(true);

    try {
      await this.dmAuthService.authenticate(dmKey);
      this.dmAuthenticated.set(true);
    } catch (error: unknown) {
      console.error('Error de autenticación DM', error);

      if (error instanceof DmAuthError) {
        const suffix = error.code ? ` (${error.code})` : '';
        this.dmAuthError.set(`${error.message}${suffix}`);
      } else {
        this.dmAuthError.set('No se pudo autenticar al DM');
      }
    } finally {
      this.dmAuthPending.set(false);
    }
  }
}
