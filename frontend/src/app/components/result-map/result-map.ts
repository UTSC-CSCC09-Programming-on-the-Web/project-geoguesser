import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import * as L from 'leaflet';

import { ActualLocation, Coordinates } from '../../models/game.models';

@Component({
  selector: 'app-result-map',
  standalone: true,
  templateUrl: './result-map.html',
  styleUrl: './result-map.css',
})
export class ResultMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) guessLocation!: Coordinates;
  @Input({ required: true }) actualLocation!: ActualLocation;

  @ViewChild('mapContainer', { static: true })
  private readonly mapContainer!: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  private initialized = false;

  ngAfterViewInit(): void {
    this.initialized = true;
    this.renderMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.initialized && (changes['guessLocation'] || changes['actualLocation'])) {
      this.renderMap();
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private renderMap(): void {
    if (!this.initialized) {
      return;
    }

    this.map?.remove();

    const guess = L.latLng(this.guessLocation.lat, this.guessLocation.lng);

    const actual = L.latLng(this.actualLocation.lat, this.actualLocation.lng);

    this.map = L.map(this.mapContainer.nativeElement, {
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.map);

    L.polyline([guess, actual], {
      color: '#3b82f6',
      weight: 3,
      opacity: 0.8,
    }).addTo(this.map);

    L.circleMarker(guess, {
      radius: 8,
      color: '#c93b45',
      fillColor: '#c93b45',
      fillOpacity: 0.95,
    })
      .bindTooltip('Your guess')
      .addTo(this.map);

    L.circleMarker(actual, {
      radius: 8,
      color: '#10b981',
      fillColor: '#10b981',
      fillOpacity: 0.95,
    })
      .bindTooltip('Actual location')
      .addTo(this.map);

    if (guess.equals(actual)) {
      this.map.setView(guess, 5);
    } else {
      this.map.fitBounds(L.latLngBounds([guess, actual]), {
        padding: [40, 40],
        maxZoom: 3,
      });
    }

    requestAnimationFrame(() => this.map?.invalidateSize());
  }
}
