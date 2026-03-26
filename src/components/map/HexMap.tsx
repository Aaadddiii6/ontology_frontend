import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { CountryProfile, ActiveModule, HoverPosition } from '../../types';
import { normalizeCountryName, getModuleColor } from '../../lib/countryData';

interface HexMapProps {
  profiles: CountryProfile[];
  profileMap: Map<string, CountryProfile>;
  activeModule: ActiveModule;
  onCountryHover: (name: string | null, position: HoverPosition | null) => void;
  onCountryClick: (name: string) => void;
}

const HexMap: React.FC<HexMapProps> = ({
  profileMap,
  activeModule,
  onCountryHover,
  onCountryClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // Use a ref to keep track of the last hovered element across re-renders
  const lastHoveredRef = useRef<SVGPathElement | null>(null);

  // Effect for drawing the map geometry, handling resizes, and setting up events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const svg = d3
      .select(container)
      .append('svg')
      .style('width', '100%')
      .style('height', '100%');

    const background = svg
      .append('rect')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('fill', '#f0eef8');

    let countryPaths: d3.Selection<
      SVGPathElement,
      any,
      SVGGElement,
      unknown
    >;

    d3.json<topojson.Topology>('/data/countries-110m.json').then(worldData => {
      if (!worldData) {
        console.error('Failed to load map data');
        return;
      }

      const countries = topojson.feature(
        worldData,
        worldData.objects.countries as any,
      );

      const projection = d3.geoNaturalEarth1();
      const pathGenerator = d3.geoPath().projection(projection);

      const g = svg.append('g');

      countryPaths = g
        .selectAll('path')
        .data(countries.features)
        .join('path')
        .attr('fill', '#d1d5db') // Start with a neutral color
        .attr('stroke', 'white')
        .attr('stroke-width', 0.5)
        .style('cursor', 'pointer')
        .attr('data-country', d => (d.properties as any).name);

      // --- Event Handlers ---
      countryPaths
        .on('mouseenter', function (event, d) {
          const el = this;
          const countryName = (d.properties as any).name;
          const apiName = normalizeCountryName(countryName);

          // Reset previously hovered element
          if (lastHoveredRef.current && lastHoveredRef.current !== el) {
            d3.select(lastHoveredRef.current)
              .style('fill', (lastHoveredRef.current as any).__originalFill)
              .style('transform', 'translateY(0)');
          }

          // Apply highlight
          const originalFill = (el as any).__originalFill || d3.select(el).style('fill');
          d3.select(el)
            .style('fill', d3.color(originalFill)!.darker(0.4).toString())
            .style('transform', 'translateY(-1px)');

          lastHoveredRef.current = el;

          if (apiName) {
            onCountryHover(apiName, { x: event.clientX, y: event.clientY });
          }
        })
        .on('click', (event, d) => {
          const countryName = (d.properties as any).name;
          const apiName = normalizeCountryName(countryName);
          if (apiName) {
            onCountryClick(apiName);
          }
        });

      svg.on('mouseleave', () => {
        if (lastHoveredRef.current) {
          d3.select(lastHoveredRef.current)
            .style('fill', (lastHoveredRef.current as any).__originalFill)
            .style('transform', 'translateY(0)');
        }
        lastHoveredRef.current = null;
        onCountryHover(null, null);
      });

      // --- Resize Logic ---
      const handleResize = () => {
        const { width, height } = container.getBoundingClientRect();
        projection.fitSize([width, height], countries);
        countryPaths.attr('d', pathGenerator);
        background.attr('width', width).attr('height', height);
      };

      const observer = new ResizeObserver(handleResize);
      observer.observe(container);
      handleResize(); // Initial render

      // Cleanup
      return () => observer.disconnect();
    });

    return () => {
      d3.select(container).select('svg').remove();
    };
  }, [onCountryClick, onCountryHover]);

  // Effect for re-coloring the map when data or module changes
  useEffect(() => {
    const svg = d3.select(containerRef.current).select('svg');
    if (svg.empty() || !profileMap.size) return;

    svg
      .selectAll<SVGPathElement, any>('path[data-country]')
      .transition()
      .duration(400)
      .style('fill', function () {
        const el = this;
        const d3name = el.getAttribute('data-country');
        if (!d3name) return '#ccc';

        const apiName = normalizeCountryName(d3name);
        if (!apiName) return '#e5e7eb'; // Unmapped regions

        const profile = profileMap.get(apiName);
        const color = getModuleColor(profile, activeModule);

        // Store the calculated color for the hover effect to use
        (el as any).__originalFill = color;

        // If this is the currently hovered element, keep it highlighted
        if (lastHoveredRef.current === el) {
          return d3.color(color)!.darker(0.4).toString();
        }

        return color;
      });
  }, [activeModule, profileMap]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }} />;
};

export default HexMap;
