"use client";

import { useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import {
  fetchGraphCountries,
  fetchGraphLayers,
  fetchGraphMetric,
  fetchGraphMetrics,
  fetchGraphRelations,
  type GraphLayerInfo,
  type GraphMetricInfo,
  type GraphMetricValues,
} from "@/lib/api";
import type { ActiveModule, RelationEdge } from "@/types";

// Which layers each tab opens with. Users can toggle any layer on any tab.
export const DEFAULT_LAYERS: Record<ActiveModule, string[]> = {
  overview: ["trade", "alignment", "sanctions"],
  economy: ["trade", "energy", "dependency"],
  defence: ["arms_transfers", "alliances", "sanctions"],
  geopolitics: ["alignment", "opposition", "diplomacy"],
  climate: ["climate_risk", "energy"],
  simulator: [],
};

export interface Legend {
  metric: GraphMetricInfo;
  lo: number;
  hi: number;
  colors: [string, string, string];
  count: number;
}

/**
 * Loads map lines (one request per active layer) and an optional choropleth
 * metric. Lines are positioned by ISO code, never by name matching.
 */
export function useMapLayers(opts: {
  activeLayers: string[];
  limit: number;
  focusCountry: string | null;
  colorMetric: string | null;
}) {
  const { activeLayers, limit, focusCountry, colorMetric } = opts;
  const [layers, setLayers] = useState<GraphLayerInfo[]>([]);
  const [metrics, setMetrics] = useState<GraphMetricInfo[]>([]);
  const [isoToName, setIsoToName] = useState<Map<string, string>>(new Map());
  const [edges, setEdges] = useState<RelationEdge[]>([]);
  const [loadingEdges, setLoadingEdges] = useState(false);
  const [metricValues, setMetricValues] = useState<GraphMetricValues | null>(null);

  useEffect(() => {
    fetchGraphLayers().then(setLayers);
    fetchGraphMetrics().then(setMetrics);
    fetchGraphCountries().then(setIsoToName);
  }, []);

  const layerKey = activeLayers.join(",");
  useEffect(() => {
    let cancelled = false;
    if (!activeLayers.length) {
      setEdges([]);
      return;
    }
    setLoadingEdges(true);
    // Focusing on one country: show all of its links, not just the global top N.
    const perLayer = focusCountry ? Math.max(limit, 300) : limit;
    Promise.all(activeLayers.map((l) => fetchGraphRelations(l, perLayer, focusCountry))).then((results) => {
      if (cancelled) return;
      const merged: RelationEdge[] = [];
      for (const r of results) {
        if (!r) continue;
        for (const e of r.edges) {
          merged.push({
            fromCountry: e.from,
            toCountry: e.to,
            fromIso: e.from_iso ? String(e.from_iso).padStart(3, "0") : null,
            toIso: e.to_iso ? String(e.to_iso).padStart(3, "0") : null,
            weight: e.weight,
            moduleColor: r.color,
            label: e.label,
            layer: r.layer,
          });
        }
      }
      setEdges(merged);
      setLoadingEdges(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layerKey stands in for activeLayers
  }, [layerKey, limit, focusCountry]);

  useEffect(() => {
    if (!colorMetric) {
      setMetricValues(null);
      return;
    }
    fetchGraphMetric(colorMetric).then(setMetricValues);
  }, [colorMetric]);

  // Choropleth: percentile-clamped scale so one outlier does not wash out the map.
  // "up" metrics (risk) run green→red, "down" metrics red→green, neutral ones blue.
  const { fillByIso, legend } = useMemo(() => {
    const fill = new Map<string, string>();
    const info = metrics.find((m) => m.key === colorMetric);
    if (!metricValues || !info || metricValues.p05 === null || metricValues.p95 === null) {
      return { fillByIso: fill, legend: null as Legend | null };
    }
    const lo = metricValues.p05;
    const hi = metricValues.p95 === lo ? lo + 1 : metricValues.p95;
    const colors: [string, string, string] =
      info.direction === "up"
        ? ["#22c55e", "#facc15", "#dc2626"]
        : info.direction === "down"
          ? ["#dc2626", "#facc15", "#22c55e"]
          : ["#dbeafe", "#60a5fa", "#1e3a8a"];
    const scale = d3
      .scaleLinear<string>()
      .domain([lo, (lo + hi) / 2, hi])
      .range(colors)
      .clamp(true);
    for (const v of metricValues.values) {
      if (v.iso) fill.set(String(v.iso).padStart(3, "0"), scale(v.value));
    }
    return { fillByIso: fill, legend: { metric: info, lo, hi, colors, count: metricValues.count } };
  }, [metricValues, metrics, colorMetric]);

  return { layers, metrics, isoToName, edges, loadingEdges, fillByIso, legend };
}
