export interface CountryProfile {
  country: string;
  defense_composite?: number;
  military_strength?: number;
  conflict_risk?: number;
  defense_spending?: number;
  arms_export?: number;
  defense_burden?: number;
  live_risk?: number;
  diplomatic_centrality?: number;
  bloc?: number;
  nuclear?: "confirmed" | "undeclared" | null;
  p5?: boolean | null;
  regional_power?: boolean | null;
  alliances?: string[];
  region?: string | null;
  conflict_trend?: "increasing" | "decreasing" | "stable" | null;
}

export interface ProfilesResponse {
  total: number;
  profiles: CountryProfile[];
}

export type MapMode = "flat" | "transitioning" | "globe" | "globe-3d";

export type ActiveModule =
  | "overview"
  | "defence"
  | "economy"
  | "geopolitics"
  | "climate";

export interface RelationEdge {
  fromCountry: string;
  toCountry: string;
  weight: number; // 0-1, controls line opacity/thickness
  moduleColor: string; // hex string
}

export interface HoverPosition {
  x: number;
  y: number;
}

export interface ModuleConfig {
  accent: string;
  bgTint: string;
  label: string;
}
