import { Component, inject, OnInit } from '@angular/core';

import { AuthService } from './services/auth.service';
import { GameService } from './services/game.service';
import { GameBoardComponent } from './components/game-board/game-board';

@Component({
  selector: 'app-root',
  imports: [GameBoardComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly game = inject(GameService);

  ngOnInit(): void {
    void this.auth.initialize();
  }

  async subscribe(): Promise<void> {
    await this.auth.startCheckout();
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    sessionStorage.removeItem('geoguesser.game-state');
    this.game.clear();
  }
}
