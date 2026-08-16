import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AiMode, Coordinates, GuessSubmissionResponse, RoundState } from '../../models/game.models';
import { GameService } from '../../services/game.service';
import { GuessMapComponent } from '../guess-map/guess-map';
import { MapillaryViewerComponent } from '../mapillary-viewer/mapillary-viewer';
import { ResultMapComponent } from '../result-map/result-map';
import { GameRealtimeEvent, RealtimeService } from '../../services/realtime.service';

type GamePhase = 'playing' | 'result' | 'complete';

interface SavedGameState {
  round: RoundState;
  phase: 'result' | 'complete';
  result: GuessSubmissionResponse | null;
  finalScore: number | null;
}

@Component({
  selector: 'app-game-board',
  standalone: true,
  imports: [MapillaryViewerComponent, GuessMapComponent, ResultMapComponent],
  templateUrl: './game-board.html',
  styleUrl: './game-board.css',
})
export class GameBoardComponent implements OnInit {
  private readonly storageKey = 'geoguesser.game-state';

  protected readonly game = inject(GameService);

  protected readonly phase = signal<GamePhase>('playing');
  protected readonly selectedGuess = signal<Coordinates | null>(null);
  protected readonly result = signal<GuessSubmissionResponse | null>(null);
  protected readonly finalScore = signal<number | null>(null);

  protected readonly actionLoading = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly aiLoading = signal(false);
  protected readonly aiError = signal<string | null>(null);
  protected readonly hintText = signal<string | null>(null);
  protected readonly reviewText = signal<string | null>(null);
  protected readonly hintUsed = signal(false);

  protected readonly realtime = inject(RealtimeService);
  protected readonly liveUpdate = signal<string | null>(null);

  constructor() {
    this.realtime.events
      .pipe(takeUntilDestroyed())
      .subscribe((event) => this.handleRealtimeEvent(event));
  }

  ngOnInit(): void {
    this.realtime.connect();

    if (this.restoreSavedState()) {
      return;
    }

    void this.game.startGame();
  }

  protected onGuessChange(guess: Coordinates | null): void {
    if (this.phase() === 'playing') {
      this.selectedGuess.set(guess);
    }
  }

  protected async submitGuess(): Promise<void> {
    const round = this.game.round();
    const guess = this.selectedGuess();

    if (!round || !guess || this.actionLoading()) {
      return;
    }

    this.actionLoading.set(true);
    this.actionError.set(null);

    try {
      const response = await this.game.submitGuess(round, guess);

      this.result.set(response);
      this.phase.set('result');
      this.selectedGuess.set(null);
      this.saveState();
    } catch (error: unknown) {
      this.actionError.set(this.getErrorMessage(error));
    } finally {
      this.actionLoading.set(false);
    }
  }

  protected async requestAi(mode: AiMode): Promise<void> {
    const round = this.game.round();

    if (!round || this.aiLoading()) {
      return;
    }

    this.aiLoading.set(true);
    this.aiError.set(null);

    try {
      const response = await this.game.requestAi(round.imageId, mode);

      if (mode === 'hint') {
        this.hintText.set(response.text);
        this.hintUsed.set(true);
      } else {
        this.reviewText.set(response.text);
      }
    } catch (error: unknown) {
      this.aiError.set(this.getErrorMessage(error));
    } finally {
      this.aiLoading.set(false);
    }
  }

  protected async continueGame(): Promise<void> {
    const response = this.result();
    const currentRound = this.game.round();

    if (!response || !currentRound || this.actionLoading()) {
      return;
    }

    if (response.newRoundData) {
      this.actionLoading.set(true);
      this.actionError.set(null);

      try {
        const nextRound = await this.game.advanceRound(currentRound.gameId, currentRound.roundId);

        this.resetRoundUi();
        this.game.setRound(nextRound);
        this.phase.set('playing');
        this.clearSavedState();
      } catch (error: unknown) {
        this.actionError.set(this.getErrorMessage(error));
      } finally {
        this.actionLoading.set(false);
      }

      return;
    }

    await this.showFinalScore();
  }

  protected async playAgain(): Promise<void> {
    if (this.actionLoading()) {
      return;
    }

    this.actionLoading.set(true);
    this.actionError.set(null);
    this.finalScore.set(null);
    this.clearSavedState();
    this.game.clear();
    this.resetRoundUi();

    try {
      await this.game.startGame();

      if (this.game.round()) {
        this.phase.set('playing');
      }
    } finally {
      this.actionLoading.set(false);
    }
  }

  protected retry(): void {
    this.clearSavedState();
    this.game.clear();
    this.resetRoundUi();
    this.phase.set('playing');
    void this.game.startGame();
  }

  private async showFinalScore(): Promise<void> {
    const round = this.game.round();

    if (!round) {
      return;
    }

    this.actionLoading.set(true);
    this.actionError.set(null);

    try {
      const score = await this.game.getScore(round.gameId);
      this.finalScore.set(score);
      this.phase.set('complete');
      this.saveState();
    } catch (error: unknown) {
      this.actionError.set(this.getErrorMessage(error));
    } finally {
      this.actionLoading.set(false);
    }
  }

  private resetRoundUi(): void {
    this.result.set(null);
    this.selectedGuess.set(null);
    this.hintText.set(null);
    this.reviewText.set(null);
    this.aiError.set(null);
    this.hintUsed.set(false);
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Request failed';
  }

  private restoreSavedState(): boolean {
    const rawState = sessionStorage.getItem(this.storageKey);

    if (!rawState) {
      return false;
    }

    try {
      const savedState = JSON.parse(rawState) as SavedGameState;

      if (!savedState.round || (savedState.phase !== 'result' && savedState.phase !== 'complete')) {
        this.clearSavedState();
        return false;
      }

      this.game.setRound(savedState.round);
      this.phase.set(savedState.phase);
      this.result.set(savedState.result);
      this.finalScore.set(savedState.finalScore);

      return true;
    } catch {
      this.clearSavedState();
      return false;
    }
  }

  private saveState(): void {
    const round = this.game.round();

    if (!round) {
      return;
    }

    const savedState: SavedGameState = {
      round,
      phase: this.phase() as 'result' | 'complete',
      result: this.result(),
      finalScore: this.finalScore(),
    };

    sessionStorage.setItem(this.storageKey, JSON.stringify(savedState));
  }

  private clearSavedState(): void {
    sessionStorage.removeItem(this.storageKey);
  }

  private handleRealtimeEvent(event: GameRealtimeEvent): void {
    const currentRound = this.game.round();

    if (event.type === 'game.state') {
      if (currentRound && currentRound.gameId !== event.payload.gameId) {
        return;
      }

      this.liveUpdate.set('Game state updated live.');

      if (this.phase() === 'playing' && !this.actionLoading()) {
        this.game.setRound(event.payload.round);
      }

      return;
    }

    if (!currentRound || currentRound.gameId !== event.payload.gameId) {
      return;
    }

    if (event.type === 'game.guess-submitted') {
      this.liveUpdate.set('This game was updated live in another tab or device.');

      if (this.phase() !== 'playing' || this.actionLoading()) {
        return;
      }

      this.result.set(event.payload.result);
      this.selectedGuess.set(null);
      this.phase.set('result');
      this.saveState();

      return;
    }

    if (event.type === 'game.round-advanced') {
      this.liveUpdate.set('Next round opened live.');

      if (this.phase() !== 'result' || this.actionLoading()) {
        return;
      }

      this.resetRoundUi();
      this.game.setRound(event.payload.round);
      this.phase.set('playing');
      this.clearSavedState();

      return;
    }

    if (event.type === 'game.completed') {
      this.liveUpdate.set('Final score updated live.');

      if (this.phase() !== 'result' || this.actionLoading()) {
        return;
      }

      this.finalScore.set(event.payload.totalDistance);
      this.phase.set('complete');
      this.saveState();
    }
  }
}
