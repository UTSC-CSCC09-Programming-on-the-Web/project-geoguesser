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

export interface ActualLocation extends Coordinates {
  location: string;
}

export interface GuessSubmissionResponse {
  distance: number;
  guessLocation: Coordinates;
  actualLocation: ActualLocation;
  newRoundData?: RoundState;
}

export interface ScoreResponse {
  totalDistance: number;
}

export type AiMode = 'hint' | 'review';

export interface AiResponse {
  text: string;
}
