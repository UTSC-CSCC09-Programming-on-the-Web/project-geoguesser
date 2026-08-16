import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  AiMode,
  AiResponse,
  Coordinates,
  GuessSubmissionResponse,
  RoundState,
  ScoreResponse,
} from '../models/game.models';

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

  setRound(round: RoundState): void {
    this.round.set({
      ...round,
      imageId: String(round.imageId),
    });
    this.error.set(null);
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

      this.setRound(response);
    } catch (error: unknown) {
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  async submitGuess(round: RoundState, guess: Coordinates): Promise<GuessSubmissionResponse> {
    try {
      const response = await firstValueFrom(
        this.http.post<GuessSubmissionResponse>(
          `/games/${round.gameId}/rounds/${round.roundId}/guess`,
          {
            guessLat: guess.lat,
            guessLng: guess.lng,
          },
        ),
      );

      if (
        !Number.isFinite(response.distance) ||
        !response.guessLocation ||
        !response.actualLocation
      ) {
        throw new Error('The server returned incomplete guess results');
      }

      return response;
    } catch (error: unknown) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async requestAi(imageId: string, mode: AiMode): Promise<AiResponse> {
    try {
      const response = await firstValueFrom(
        this.http.post<AiResponse>('/streetview/ai-review', {
          imageId: String(imageId),
          mode,
        }),
      );

      if (!response.text) {
        throw new Error('The AI returned an empty response');
      }

      return response;
    } catch (error: unknown) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  async getScore(gameId: number): Promise<number> {
    try {
      const response = await firstValueFrom(this.http.get<ScoreResponse>(`/games/${gameId}/score`));

      if (!Number.isFinite(response.totalDistance)) {
        throw new Error('The server returned an invalid final score');
      }

      return response.totalDistance;
    } catch (error: unknown) {
      throw new Error(this.getErrorMessage(error));
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
