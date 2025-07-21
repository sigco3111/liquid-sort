export type Color = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink';

export type Tube = Color[];

export interface Level {
  tubes: Tube[];
}

export interface Particle {
    id: number;
    color: Color;
}

export interface LevelStats {
  level: number;
  moves: number;
  duration: number; // in milliseconds
  score: number;
}