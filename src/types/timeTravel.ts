export interface HistoricalEra {
  id: string;
  name: string;
  year: string;
  region: string;
  periodTag: string;
  shortDesc: string;
  fullDesc: string;
  roles: string[];
  defaultRole: string;
  colorTheme: {
    primary: string;
    accent: string;
    bgGradient: string;
    cardBorder: string;
  };
  filterProfile: {
    sepia: number;
    warmth: number; // -50 (cool) to +50 (warm)
    contrast: number; // 80 to 140
    brightness: number; // 80 to 130
    grainOpacity: number;
    vignetteIntensity: number;
  };
  accessoryOptions: {
    id: string;
    label: string;
    defaultEnabled: boolean;
  }[];
  sampleQuote: string;
}

export interface FaceAdjustments {
  scale: number; // 0.5 to 2.0
  offsetX: number; // -200 to 200
  offsetY: number; // -200 to 200
  rotation: number; // -30 to 30 deg
  brightness: number; // 70 to 140
  contrast: number; // 70 to 140
  warmth: number; // -50 to 50
  featherRadius: number; // 5 to 50
  selectedAccessoryId: string | null;
  frameStyle: 'ornate-gold' | 'wanted-poster' | 'vintage-polaroid' | 'archive-slate' | 'none';
}

export interface TimeTravelDossier {
  historicalName: string;
  location: string;
  eraYear: string;
  stationTitle: string;
  biography: string;
  temporalLog: string;
  temporalStability: string;
  historicalArtifact: string;
}

export interface SavedExcursion {
  id: string;
  timestamp: number;
  eraId: string;
  eraName: string;
  eraYear: string;
  role: string;
  imageDataUrl: string;
  dossier?: TimeTravelDossier;
}
