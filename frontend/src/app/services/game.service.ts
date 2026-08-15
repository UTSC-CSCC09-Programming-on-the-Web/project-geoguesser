import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { RoundState } from '../models/game.models';

@Injectable({
  providedIn: 'root',
})
export class GameService {
  private readonly http = inject(HttpClient);

  readonly round = signal<RoundState | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly roundLabel = computed(() => {
    const currentRound = this.round();
    return currentRound ? `${currentRound.roundNumber}/3` : '-/3';
  });

  clear(): void {
    this.round.set(null);
    this.error.set(null);
    this.loading.set(false);
  }

  async startGame(): Promise<void> {
    if (this.loading()) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(this.http.post<RoundState>('/games/start', {}));

      if (
        response.gameId === undefined ||
        response.roundId === undefined ||
        response.roundNumber === undefined ||
        !response.imageId
      ) {
        throw new Error('The server returned incomplete round data');
      }

      this.round.set({
        ...response,
        imageId: String(response.imageId),
      });
    } catch (error: unknown) {
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
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
