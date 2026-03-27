export interface CountryProfile {
  country: string;
  // Composite / overview scores (0-1 normalised)
  defense_composite?: number;
  military_strength?: number;
  conflict_risk?: number;
  live_risk?: number;
  diplomatic_centrality?: number;
  // Economy
  defense_spending?: number; // raw USD millions (from API: spending_usd_millions)
  arms_export?: number; // normalised 0-1  (from API: avg_market_share_pct / 100)
  defense_burden?: number; // normalised 0-1  (from API: normalized_weight)
  gdp_usd?: number; // absolute USD    (from composite economic_power proxy — actual GDP stored on edge)
  // Flags / metadata
  nuclear?: "confirmed" | "undeclared" | null;
  p5?: boolean | null;
  regional_power?: boolean | null;
  alliances?: string[];
  region?: string | null;
  conflict_trend?: "increasing" | "decreasing" | "stable" | null;
  bloc?: number | null;
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
  | "climate"
  | "simulator";

export interface RelationEdge {
  fromCountry: string;
  toCountry: string;
  weight: number; // 0-1
  moduleColor: string; // hex colour string
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
