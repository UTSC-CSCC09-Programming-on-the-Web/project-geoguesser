import { Component, inject, OnInit, signal } from '@angular/core';

import { Coordinates } from '../../models/game.models';
import { GameService } from '../../services/game.service';
import { GuessMapComponent } from '../guess-map/guess-map';
import { MapillaryViewerComponent } from '../mapillary-viewer/mapillary-viewer';

@Component({
  selector: 'app-game-board',
  standalone: true,
  imports: [MapillaryViewerComponent, GuessMapComponent],
  templateUrl: './game-board.html',
  styleUrl: './game-board.css',
})
export class GameBoardComponent implements OnInit {
  protected readonly game = inject(GameService);
  protected readonly selectedGuess = signal<Coordinates | null>(null);

  ngOnInit(): void {
    void this.game.startGame();
  }

  protected onGuessChange(guess: Coordinates | null): void {
    this.selectedGuess.set(guess);
  }

  protected retry(): void {
    void this.game.startGame();
  }
}
