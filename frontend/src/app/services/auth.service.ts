import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { CheckoutResponse, CurrentUser, CurrentUserResponse } from '../models/auth.models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly user = signal<CurrentUser | null>(null);
  readonly ready = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly canPlay = computed(() => this.user()?.subscriptionStatus === 'active');

  readonly statusText = computed(() => {
    if (!this.ready()) {
      return 'Checking login ...';
    }

    const currentUser = this.user();

    if (!currentUser) {
      return 'Not logged in';
    }

    return this.canPlay()
      ? `Logged in as ${currentUser.username} (subscription active)`
      : `Logged in as ${currentUser.username} (subscription required)`;
  });

  async initialize(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await this.handleUrlState();

      const response = await firstValueFrom(this.http.get<CurrentUserResponse>('/api/me'));

      this.user.set(response.user);
    } catch (error: unknown) {
      this.user.set(null);

      if (!(error instanceof HttpErrorResponse) || ![401, 403].includes(error.status)) {
        this.error.set(this.getErrorMessage(error));
      }
    } finally {
      this.ready.set(true);
      this.loading.set(false);
    }
  }

  login(): void {
    window.location.assign('/auth/google');
  }

  async logout(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await firstValueFrom(this.http.get('/auth/logout'));
    } catch (error: unknown) {
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.user.set(null);
      this.ready.set(true);
      this.loading.set(false);
    }
  }

  async startCheckout(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.http.post<CheckoutResponse>('/api/create-checkout-session', {}),
      );

      if (!response.url) {
        throw new Error('Checkout URL was not returned');
      }

      window.location.assign(response.url);
    } catch (error: unknown) {
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private async handleUrlState(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get('checkout');
    const sessionId = params.get('session_id');
    const loginStatus = params.get('login');

    if (checkoutStatus === 'success' && sessionId) {
      try {
        await firstValueFrom(
          this.http.get(`/api/checkout/confirm?session_id=${encodeURIComponent(sessionId)}`),
        );
      } catch (error: unknown) {
        this.error.set(this.getErrorMessage(error));
      }

      this.removeQueryParameters(['checkout', 'session_id']);
    } else if (checkoutStatus) {
      this.removeQueryParameters(['checkout']);
    }

    if (loginStatus === 'failed') {
      this.error.set('Google login failed');
      this.removeQueryParameters(['login']);
    } else if (loginStatus === 'unavailable') {
      this.error.set('Google login is not configured');
      this.removeQueryParameters(['login']);
    }
  }

  private removeQueryParameters(parameters: string[]): void {
    const url = new URL(window.location.href);

    for (const parameter of parameters) {
      url.searchParams.delete(parameter);
    }

    const query = url.searchParams.toString();
    const nextUrl = `${url.pathname}${query ? `?${query}` : ''}${url.hash}`;

    window.history.replaceState({}, document.title, nextUrl);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const payload = error.error as { error?: unknown; message?: unknown } | string | null;

      if (typeof payload === 'string') {
        return payload;
      }

      if (payload && typeof payload.error === 'string') {
        return payload.error;
      }

      if (payload && typeof payload.message === 'string') {
        return payload.message;
      }

      return error.message || 'Request failed';
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Request failed';
  }
}
