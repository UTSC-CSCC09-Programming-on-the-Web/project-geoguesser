import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Viewer } from 'mapillary-js';

interface AccessTokenResponse {
  accessToken: string;
}

@Component({
  selector: 'app-mapillary-viewer',
  standalone: true,
  templateUrl: './mapillary-viewer.html',
  styleUrl: './mapillary-viewer.css',
})
export class MapillaryViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) imageId = '';

  @ViewChild('container', { static: true })
  private readonly container!: ElementRef<HTMLDivElement>;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private readonly http = inject(HttpClient);

  private viewer: Viewer | null = null;
  private viewerPromise: Promise<Viewer> | null = null;
  private initialized = false;
  private requestNumber = 0;

  ngAfterViewInit(): void {
    this.initialized = true;
    void this.loadImage();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['imageId'] && this.initialized) {
      void this.loadImage();
    }
  }

  private async getViewer(): Promise<Viewer> {
    if (this.viewer) {
      return this.viewer;
    }

    if (!this.viewerPromise) {
      this.viewerPromise = this.createViewer();
    }

    try {
      return await this.viewerPromise;
    } catch (error) {
      this.viewerPromise = null;
      throw error;
    }
  }

  private async createViewer(): Promise<Viewer> {
    const tokenResponse = await firstValueFrom(
      this.http.get<AccessTokenResponse>('/streetview/access-token'),
    );

    if (!tokenResponse.accessToken) {
      throw new Error('Mapillary access token was not returned');
    }

    const viewer = new Viewer({
      accessToken: tokenResponse.accessToken,
      container: this.container.nativeElement,
      component: { cache: false },
    });

    this.viewer = viewer;
    return viewer;
  }

  private async loadImage(): Promise<void> {
    if (!this.imageId) {
      return;
    }

    const currentRequest = ++this.requestNumber;

    this.loading.set(true);
    this.error.set(null);

    try {
      const viewer = await this.getViewer();

      await viewer.moveTo(String(this.imageId));

      requestAnimationFrame(() => {
        viewer.resize();
      });
    } catch (error: unknown) {
      if (currentRequest === this.requestNumber) {
        this.error.set(error instanceof Error ? error.message : 'Unable to load Mapillar imagery');
      }
    } finally {
      if (currentRequest === this.requestNumber) {
        this.loading.set(false);
      }
    }
  }

  ngOnDestroy(): void {
    this.viewer?.remove();
  }
}
