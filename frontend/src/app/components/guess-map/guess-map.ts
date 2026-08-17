import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  EventEmitter,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

import * as L from 'leaflet';
import { Coordinates } from '../../models/game.models';

@Component({
  selector: 'app-guess-map',
  standalone: true,
  templateUrl: './guess-map.html',
  styleUrl: './guess-map.css',
})
export class GuessMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() resetKey: number | string | null = null;

  @Output() readonly guessChange = new EventEmitter<Coordinates | null>();

  @ViewChild('mapContainer', { static: true })
  private readonly mapContainer!: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  private guessMarker: L.CircleMarker | null = null;

  ngAfterViewInit(): void {
    this.map = L.map(this.mapContainer.nativeElement).setView([20, 0], 2);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.map);

    this.map.on('click', (event: L.LeafletMouseEvent) => {
      const guess: Coordinates = {
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      };

      if (this.guessMarker) {
        this.guessMarker.setLatLng([guess.lat, guess.lng]);
      } else {
        this.guessMarker = L.circleMarker([guess.lat, guess.lng], {
          radius: 8,
          color: '#c93b45',
          fillColor: '#c93b45',
          fillOpacity: 0.95,
        }).addTo(this.map!);
      }

      this.guessChange.emit(guess);
    });

    window.addEventListener('resize', this.handleResize);

    requestAnimationFrame(() => {
      this.map?.invalidateSize({ pan: false });
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['resetKey'] && !changes['resetKey'].firstChange) {
      this.reset();
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.handleResize);
    this.map?.remove();
  }

  private reset(): void {
    this.guessMarker?.remove();
    this.guessMarker = null;
    this.guessChange.emit(null);
  }

  private readonly handleResize = (): void => {
    this.map?.invalidateSize({ pan: false });
  };
}
