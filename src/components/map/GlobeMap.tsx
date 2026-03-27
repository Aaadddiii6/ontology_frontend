"use client";
import React, { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import { CountryProfile, ActiveModule, RelationEdge } from "../../types";
import { normalizeCountryName, getModuleColor, COUNTRY_COORDS } from "../../lib/countryData";

interface GlobeMapProps {
  profileMap: Map<string, CountryProfile>;
  activeModule: ActiveModule;
  onCountryHover: (name: string | null) => void;
  onCountryClick: (name: string) => void;
  visible: boolean;
  showRelations?: boolean;
  relations?: RelationEdge[];
  countryCoords?: Map<string, [number, number]>;
  simulationResults?: Record<string, "critical" | "high" | "medium" | "low">;
}

const geoCoordsTo3d = (lon: number, lat: number, radius: number): THREE.Vector3 => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
};

const GlobeMap: React.FC<GlobeMapProps> = ({
  profileMap,
  activeModule,
  onCountryHover,
  onCountryClick,
  visible,
  showRelations = true,
  relations = [],
  countryCoords,
  simulationResults,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // All mutable state lives in refs so callbacks never go stale
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const globeGroupRef = useRef<THREE.Group>(new THREE.Group());
  const countryMeshesRef = useRef<THREE.Group>(new THREE.Group());
  const relationsGroupRef = useRef<THREE.Group>(new THREE.Group());
  const animFrameRef = useRef<number>(0);
  const isDragging = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });
  const mouseDownPos = useRef({ x: 0, y: 0 });
  const mouseDownTime = useRef(0);
  const lastHovered = useRef<string | null>(null);
  const lastRaycast = useRef(0);
  const visibleRef = useRef(visible);
  const worldLoadedRef = useRef(false);

  useEffect(() => { visibleRef.current = visible; }, [visible]);

  // ── Helpers ───────────────────────────────────────────────
  const getGeoCoords = useCallback(
    (name: string): [number, number] | null => {
      // 1. Try the topojson-derived centroid map (most accurate)
      if (countryCoords?.has(name)) return countryCoords.get(name)!;
      // 2. Try normalised name in centroid map
      const norm = normalizeCountryName(name);
      if (norm && countryCoords?.has(norm)) return countryCoords.get(norm)!;
      // 3. Fallback to static coords table
      if (COUNTRY_COORDS[name]) return COUNTRY_COORDS[name];
      if (norm && COUNTRY_COORDS[norm!]) return COUNTRY_COORDS[norm!];
      return null;
    },
    [countryCoords],
  );

  const getOverviewColor = useCallback(
    (apiName: string | null) => {
      if (!apiName) return "#8ad0f0";
      const p = profileMap.get(apiName);
      if (!p) return "#8ad0f0";
      if (p.nuclear === "confirmed") return "#0f52ba";
      return "#6694f6";
    },
    [profileMap],
  );

  const colorForCountry = useCallback(
    (apiName: string | null) => {
      const p = apiName ? profileMap.get(apiName) : undefined;
      return activeModule === "overview"
        ? getOverviewColor(apiName)
        : getModuleColor(p, activeModule);
    },
    [activeModule, profileMap, getOverviewColor],
  );

  // ── Scene setup (runs once) ────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Camera
    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.1,
      2000,
    );
    camera.position.z = 340;
    cameraRef.current = camera;

    // ── Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // ── Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(400, 300, 400);
    scene.add(sun);
    const fill = new THREE.PointLight(0xaaccff, 0.8, 1000);
    fill.position.set(-200, -100, 200);
    scene.add(fill);

    // ── Globe base
    const globeBase = new THREE.Mesh(
      new THREE.SphereGeometry(100, 64, 64),
      new THREE.MeshStandardMaterial({
        color: 0x0d1b2e,
        roughness: 0.4,
        metalness: 0.6,
        transparent: true,
        opacity: 0.97,
      }),
    );
    globeGroupRef.current.add(globeBase);

    // ── Subtle ocean shimmer
    const ocean = new THREE.Mesh(
      new THREE.SphereGeometry(99.5, 64, 64),
      new THREE.MeshStandardMaterial({
        color: 0x1a3a5c,
        roughness: 0.1,
        metalness: 0.9,
        transparent: true,
        opacity: 0.6,
      }),
    );
    globeGroupRef.current.add(ocean);

    // ── Atmosphere glow
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(115, 48, 48),
      new THREE.MeshBasicMaterial({
        color: 0x4f6ef7,
        transparent: true,
        opacity: 0.06,
        side: THREE.BackSide,
      }),
    );
    globeGroupRef.current.add(atmo);

    // ── Grid lines
    const grid = new THREE.Mesh(
      new THREE.SphereGeometry(100.3, 36, 36),
      new THREE.MeshBasicMaterial({
        color: 0x334466,
        wireframe: true,
        transparent: true,
        opacity: 0.08,
      }),
    );
    globeGroupRef.current.add(grid);

    // ── Add groups to globe
    globeGroupRef.current.add(countryMeshesRef.current);
    globeGroupRef.current.add(relationsGroupRef.current);
    scene.add(globeGroupRef.current);

    // ── Load world topology ──────────────────────────────────
    d3.json<any>("/data/countries-110m.json").then((world) => {
      if (!world || !sceneRef.current) return;
      worldLoadedRef.current = true;

      const countries = topojson.feature(world, world.objects.countries as any);

      (countries as any).features.forEach((feature: any) => {
        const rawName: string = feature.properties?.name ?? "";
        const apiName = normalizeCountryName(rawName) ?? rawName;

        const profile = profileMap.get(apiName);
        const color = colorForCountry(apiName);
        const baseHex = color.substring(0, 7);

        const polys: number[][][][] =
          feature.geometry?.type === "Polygon"
            ? [feature.geometry.coordinates]
            : feature.geometry?.type === "MultiPolygon"
              ? feature.geometry.coordinates
              : [];

        polys.forEach((poly) => {
          // Country fill: project each ring as a shape
          const ring = poly[0];
          if (!ring || ring.length < 3) return;

          const shape = new THREE.Shape();
          ring.forEach(([lon, lat]: number[], i: number) => {
            if (i === 0) shape.moveTo(lon, lat);
            else shape.lineTo(lon, lat);
          });
          
          const shapeGeo = new THREE.ShapeGeometry(shape);
          const pos = shapeGeo.attributes.position;
          const normals = new Float32Array(pos.count * 3);

          for (let i = 0; i < pos.count; i++) {
            const lon = pos.getX(i);
            const lat = pos.getY(i);
            const v = geoCoordsTo3d(lon, lat, 101.5); // Offset radius greatly to prevent z-fighting flat polygons
            pos.setXYZ(i, v.x, v.y, v.z);

            const n = v.clone().normalize();
            normals[i * 3] = n.x;
            normals[i * 3 + 1] = n.y;
            normals[i * 3 + 2] = n.z;
          }
          shapeGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

          const shapeMesh = new THREE.Mesh(
            shapeGeo,
            new THREE.MeshStandardMaterial({
              color: baseHex,
              emissive: baseHex,
              emissiveIntensity: 0.3,
              transparent: true,
              opacity: 0.4,
              side: THREE.DoubleSide,
            }),
          );
          shapeMesh.userData = { apiName, isCountry: true, isShape: true };
          countryMeshesRef.current.add(shapeMesh);

          // Outline
          const pts = ring.map(([lon, lat]: number[]) =>
            geoCoordsTo3d(lon, lat, 101.6),
          );
          const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
          const line = new THREE.Line(
            lineGeo,
            new THREE.LineBasicMaterial({
              color: 0xffffff,
              transparent: true,
              opacity: 0.15,
            }),
          );
          line.userData = { apiName, isCountry: true };
          countryMeshesRef.current.add(line);
        });

        // Dot at centroid (all modules)
        const centroid = d3.geoCentroid(feature);
        if (centroid && centroid[0] != null && centroid[1] != null) {
          const pos = geoCoordsTo3d(centroid[0], centroid[1], 102.5);
          const size = 1.2 + (profile?.defense_composite ?? 0) * 2.5;
          const dot = new THREE.Mesh(
            new THREE.SphereGeometry(Math.min(size, 3.5), 8, 8),
            new THREE.MeshStandardMaterial({
              color: baseHex,
              emissive: baseHex,
              emissiveIntensity: 0.5,
              transparent: true,
              opacity: 0.9,
            }),
          );
          dot.position.copy(pos);
          dot.userData = { apiName, isCountry: true, isDot: true, baseScale: 1 };
          countryMeshesRef.current.add(dot);
        }
      });
    });

    // ── Animate ──────────────────────────────────────────────
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      if (!visibleRef.current) return;
      if (!isDragging.current) {
        globeGroupRef.current.rotation.y += 0.0008;
      }
      
      const time = Date.now() * 0.005;
      countryMeshesRef.current.children.forEach((obj) => {
        if (obj.userData?.isDot && obj.userData?.severity) {
          const mul = 1 + Math.sin(time + obj.id) * 0.4; // random offset by id
          obj.scale.setScalar(obj.userData.baseScale * mul);
        } else if (obj.userData?.isDot && obj.scale.x !== obj.userData.baseScale) {
          obj.scale.setScalar(obj.userData.baseScale); // restore scale when severity removed
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    // ── Resize ──────────────────────────────────────────────
    const onResize = () => {
      if (!container || !cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = container.clientWidth / container.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(container.clientWidth, container.clientHeight);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    // ── Mouse events ─────────────────────────────────────────
    const onDown = (e: MouseEvent) => {
      isDragging.current = true;
      mouseDownPos.current = { x: e.clientX, y: e.clientY };
      prevMouse.current = { x: e.clientX, y: e.clientY };
      mouseDownTime.current = Date.now();
      container.style.cursor = "grabbing";
    };

    const onMove = (e: MouseEvent) => {
      if (isDragging.current) {
        const dx = e.clientX - prevMouse.current.x;
        const dy = e.clientY - prevMouse.current.y;
        globeGroupRef.current.rotation.y += dx * 0.005;
        globeGroupRef.current.rotation.x = Math.max(
          -1.2,
          Math.min(1.2, globeGroupRef.current.rotation.x + dy * 0.003),
        );
        prevMouse.current = { x: e.clientX, y: e.clientY };
        return;
      }

      // Raycasting for hover
      if (!visibleRef.current) return;
      const now = Date.now();
      if (now - lastRaycast.current < 60) return;
      lastRaycast.current = now;

      const rect = container.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (!cameraRef.current) return;
      const raycaster = new THREE.Raycaster();
      raycaster.params.Line = { threshold: 2 };
      raycaster.setFromCamera(new THREE.Vector2(mx, my), cameraRef.current);

      const hits = raycaster.intersectObjects(countryMeshesRef.current.children, false);
      const hit = hits.find((h) => h.object.userData?.isCountry);

      if (hit) {
        const name: string = hit.object.userData.apiName;
        if (name !== lastHovered.current) {
          lastHovered.current = name;
          onCountryHover(name);
          // Highlight
          countryMeshesRef.current.children.forEach((obj) => {
            const isThis = obj.userData.apiName === name;
            if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
              if (obj.userData.isShape) {
                obj.material.opacity = isThis ? 0.7 : 0.4;
                obj.material.emissiveIntensity = isThis ? 0.8 : 0.3;
              } else {
                obj.material.emissiveIntensity = isThis ? 1.2 : 0.4;
                if (isThis) obj.scale.setScalar(1.3);
                else obj.scale.setScalar(1);
              }
            }
            if (obj instanceof THREE.Line && obj.material instanceof THREE.LineBasicMaterial) {
              obj.material.opacity = isThis ? 0.8 : 0.15;
              if (isThis) obj.material.color.set(0x6366f1);
              else obj.material.color.set(0xffffff);
            }
          });
        }
      } else if (lastHovered.current) {
        lastHovered.current = null;
        onCountryHover(null);
        countryMeshesRef.current.children.forEach((obj) => {
          if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
            if (obj.userData.isShape) {
              obj.material.opacity = 0.4;
              obj.material.emissiveIntensity = 0.3;
            } else {
              obj.material.emissiveIntensity = 0.4;
              obj.scale.setScalar(1);
            }
          }
          if (obj instanceof THREE.Line && obj.material instanceof THREE.LineBasicMaterial) {
            obj.material.opacity = 0.15;
            obj.material.color.set(0xffffff);
          }
        });
      }
    };

    const onUp = (e: MouseEvent) => {
      const moved =
        Math.abs(e.clientX - mouseDownPos.current.x) < 6 &&
        Math.abs(e.clientY - mouseDownPos.current.y) < 6;
      const quick = Date.now() - mouseDownTime.current < 300;
      if (moved && quick && lastHovered.current) {
        onCountryClick(lastHovered.current);
      }
      isDragging.current = false;
      container.style.cursor = "grab";
    };

    container.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      ro.disconnect();
      container.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only once

  // ── Update colors when module/profileMap/sim changes ───────────
  useEffect(() => {
    countryMeshesRef.current.children.forEach((obj) => {
      if (!obj.userData?.isCountry) return;
      const apiName: string = obj.userData.apiName;
      let colorHex = colorForCountry(apiName);
      if (colorHex && colorHex.length > 7) colorHex = colorHex.substring(0, 7);
      
      const severity = simulationResults ? simulationResults[apiName] : undefined;
      if (severity === "critical") colorHex = "#ef4444";
      else if (severity === "high") colorHex = "#f97316";
      else if (severity === "medium") colorHex = "#f59e0b";
      else if (severity === "low") colorHex = "#eab308";

      if (obj.userData.isDot) obj.userData.severity = severity;

      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
        obj.material.color.set(colorHex);
        obj.material.emissive.set(colorHex);
        // Boost glow if it's severe
        if (obj.userData.isShape) {
          obj.material.opacity = severity ? 0.7 : (obj.userData.apiName === lastHovered.current ? 0.7 : 0.4);
          obj.material.emissiveIntensity = severity ? 0.8 : (obj.userData.apiName === lastHovered.current ? 0.8 : 0.3);
        } else {
          obj.material.emissiveIntensity = severity ? 1.5 : (obj.userData.apiName === lastHovered.current ? 1.2 : 0.4);
        }
      }
      if (obj instanceof THREE.Line && obj.material instanceof THREE.LineBasicMaterial) {
        obj.material.color.set(severity ? colorHex : 0xffffff);
        obj.material.opacity = severity ? 0.8 : 0.3;
      }
    });
  }, [colorForCountry, simulationResults]);

  // ── Update relations arcs ─────────────────────────────────
  useEffect(() => {
    relationsGroupRef.current.clear();
    if (!showRelations || !relations.length) return;

    relations.slice(0, 100).forEach((rel) => {
      const sc = getGeoCoords(rel.fromCountry);
      const ec = getGeoCoords(rel.toCountry);
      if (!sc || !ec) return;

      const start = geoCoordsTo3d(sc[0], sc[1], 101);
      const end = geoCoordsTo3d(ec[0], ec[1], 101);
      const mid = start.clone().lerp(end, 0.5).normalize().multiplyScalar(118);

      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const geo = new THREE.TubeGeometry(curve, 24, 0.25, 4, false);
      const mat = new THREE.MeshBasicMaterial({
        color: (rel.moduleColor ?? "#6366f1").substring(0, 7),
        transparent: true,
        opacity: Math.min(0.7, (rel.weight ?? 0.5) * 0.8),
      });
      relationsGroupRef.current.add(new THREE.Mesh(geo, mat));
    });
  }, [relations, showRelations, getGeoCoords]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{ cursor: "grab" }}
    />
  );
};

export default React.memo(GlobeMap);