export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RoundState {
  gameId: number;
  // image id is string because the id is large (int may lose info)
  imageId: string;
  roundId: number;
  roundNumber: number;
}
