import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';

import { GuessSubmissionResponse, RoundState } from '../models/game.models';

export interface GameStateEvent {
  type: 'game.state';
  payload: {
    gameId: number;
    round: RoundState;
  };
}

export interface GameGuessSubmittedEvent {
  type: 'game.guess-submitted';
  payload: {
    gameId: number;
    roundId: number;
    result: GuessSubmissionResponse;
  };
}

export interface GameRoundAdvancedEvent {
  type: 'game.round-advanced';
  payload: {
    gameId: number;
    round: RoundState;
  };
}

export interface GameCompletedEvent {
  type: 'game.completed';
  payload: {
    gameId: number;
    totalDistance: number;
  };
}

export type GameRealtimeEvent =
  GameStateEvent | GameGuessSubmittedEvent | GameRoundAdvancedEvent | GameCompletedEvent;

@Injectable({
  providedIn: 'root',
})
export class RealtimeService {
  private readonly zone = inject(NgZone);
  private readonly eventSubject = new Subject<GameRealtimeEvent>();

  readonly events = this.eventSubject.asObservable();
  readonly connected = signal(false);

  private source: EventSource | null = null;

  connect(): void {
    if (this.source) {
      return;
    }

    const source = new EventSource('/api/realtime');
    this.source = source;

    source.onopen = () => {
      this.zone.run(() => {
        this.connected.set(true);
      });
    };

    source.onerror = () => {
      this.zone.run(() => {
        this.connected.set(false);
      });
    };

    this.listen('game.state');
    this.listen('game.guess-submitted');
    this.listen('game.round-advanced');
    this.listen('game.completed');
  }

  disconnect(): void {
    this.source?.close();
    this.source = null;
    this.connected.set(false);
  }

  private listen(eventType: GameRealtimeEvent['type']): void {
    this.source?.addEventListener(eventType, (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);

        this.zone.run(() => {
          this.eventSubject.next({
            type: eventType,
            payload,
          } as GameRealtimeEvent);
        });
      } catch {
        // Ignore malformed events.
      }
    });
  }
}
