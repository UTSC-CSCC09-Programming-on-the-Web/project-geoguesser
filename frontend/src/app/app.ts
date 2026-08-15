import { Component, inject, OnInit } from '@angular/core';

import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly auth = inject(AuthService);

  ngOnInit(): void {
    void this.auth.initialize();
  }

  async subscribe(): Promise<void> {
    await this.auth.startCheckout();
  }

  async logout(): Promise<void> {
    await this.auth.logout();
  }
}
