"use client";
import React, { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import { CountryProfile, ActiveModule, RelationEdge } from "../../types";
import {
  normalizeCountryName,
  getModuleColor,
  COUNTRY_COORDS,
} from "../../lib/countryData";

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
  /** ISO numeric (zero-padded) -> fill colour; overrides tab colouring */
  fillByIso?: Map<string, string>;
  /** ISO numeric -> graph country name (exact join) */
  isoToName?: Map<string, string>;
  /** ISO numeric -> [lon, lat] centroid, used to place relation arcs */
  isoCoords?: Map<string, [number, number]>;
  /** 0..1 multiplier from the "Links opacity" slider */
  linkOpacity?: number;
}

const geoCoordsTo3d = (
  lon: number,
  lat: number,
  radius: number,
): THREE.Vector3 => {
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
  fillByIso,
  isoToName,
  isoCoords,
  linkOpacity = 0.6,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // All mutable state lives in refs so callbacks never go stale
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const globeGroupRef = useRef<THREE.Group>(new THREE.Group());
  const countryMeshesRef = useRef<THREE.Group>(new THREE.Group());
  const relationsGroupRef = useRef<THREE.Group>(new THREE.Group());
  const cloudsRef = useRef<THREE.Mesh | null>(null);
  const animFrameRef = useRef<number>(0);
  const isDragging = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });
  const mouseDownPos = useRef({ x: 0, y: 0 });
  const mouseDownTime = useRef(0);
  const lastHovered = useRef<string | null>(null);
  const lastRaycast = useRef(0);
  const visibleRef = useRef(visible);
  const worldLoadedRef = useRef(false);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  // The scene + mouse handlers are created once; keep the latest callbacks in
  // refs, otherwise clicks call the first-render handler, whose country list
  // was still empty (so the panel never opened).
  const onClickRef = useRef(onCountryClick);
  const onHoverRef = useRef(onCountryHover);
  useEffect(() => {
    onClickRef.current = onCountryClick;
    onHoverRef.current = onCountryHover;
  }, [onCountryClick, onCountryHover]);

  const zoomBy = useCallback((factor: number) => {
    const cam = cameraRef.current;
    if (!cam) return;
    cam.position.z = Math.max(150, Math.min(700, cam.position.z * factor));
  }, []);

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

    // ── Lights: one "sun" + soft sky fill. Realistic day side, readable night side.
    scene.add(new THREE.AmbientLight(0xcfdcff, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 2.6);
    sun.position.set(-260, 160, 520); // front-left: lit face toward the viewer, soft terminator on the right
    scene.add(sun);

    // ── Earth: NASA Blue Marble colour + terrain normal map + ocean shine.
    // 2048px textures (~1.5 MB total) keep it light; 96 segments is plenty
    // at this size. Loaded async so the globe appears even before textures.
    const loader = new THREE.TextureLoader();
    const tex = (url: string, srgb = false) => {
      const t = loader.load(url);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      return t;
    };
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(100, 96, 96),
      new THREE.MeshPhongMaterial({
        map: tex("/textures/earth_atmos_2048.jpg", true),
        normalMap: tex("/textures/earth_normal_2048.jpg"),
        normalScale: new THREE.Vector2(0.85, 0.85),
        specularMap: tex("/textures/earth_specular_2048.jpg"),
        specular: new THREE.Color(0x335577),
        shininess: 18,
      }),
    );
    // geoCoordsTo3d() uses the same lon/lat -> xyz mapping as SphereGeometry UVs,
    // so the imagery lines up with borders and arcs without any rotation.
    globeGroupRef.current.add(earth);

    // ── Clouds: separate transparent shell that drifts slowly (subtle).
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(100.9, 64, 64),
      new THREE.MeshLambertMaterial({
        map: tex("/textures/earth_clouds_1024.png", true),
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    cloudsRef.current = clouds;
    globeGroupRef.current.add(clouds);

    // ── Atmosphere: Fresnel rim shader on a slightly larger back-facing
    // sphere. Bright at the silhouette, invisible facing the camera, so it
    // never hides the surface. Additive blend, one draw call.
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(112, 64, 64),
      new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          varying vec3 vNormal;
          void main() {
            float rim = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
            gl_FragColor = vec4(0.35, 0.62, 1.0, 1.0) * rim;
          }`,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    scene.add(atmosphere); // not in the rotating group: the rim stays put

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
        const iso: string | null = feature.id != null ? String(feature.id).padStart(3, "0") : null;
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
            const v = geoCoordsTo3d(lon, lat, 100.3); // Increased offset to prevent z-fighting and sphere penetration
            pos.setXYZ(i, v.x, v.y, v.z);

            const n = v.clone().normalize();
            normals[i * 3] = n.x;
            normals[i * 3 + 1] = n.y;
            normals[i * 3 + 2] = n.z;
          }
          shapeGeo.setAttribute(
            "normal",
            new THREE.BufferAttribute(normals, 3),
          );

          const shapeMesh = new THREE.Mesh(
            shapeGeo,
            new THREE.MeshStandardMaterial({
              color: baseHex,
              emissive: baseHex,
              emissiveIntensity: 0.4,
              transparent: true,
              opacity: 0, // overlay: tinted only on hover / metric colouring / simulation
              depthWrite: false,
              side: THREE.FrontSide,
              polygonOffset: true,
              polygonOffsetFactor: -1,
              polygonOffsetUnits: -1,
            }),
          );
          shapeMesh.userData = { apiName, iso, isCountry: true, isShape: true };
          countryMeshesRef.current.add(shapeMesh);

          // Outline
          const pts = ring.map(
            ([lon, lat]: number[]) => geoCoordsTo3d(lon, lat, 100.35), // Slightly above the shape
          );
          const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
          const line = new THREE.Line(
            lineGeo,
            new THREE.LineBasicMaterial({
              color: 0xdbeafe,
              transparent: true,
              opacity: 0.35,
            }),
          );
          line.userData = { apiName, iso, isCountry: true };
          countryMeshesRef.current.add(line);
        });

        // Dot at centroid (all modules)
        const centroid = d3.geoCentroid(feature);
        if (centroid && centroid[0] != null && centroid[1] != null) {
          const pos = geoCoordsTo3d(centroid[0], centroid[1], 100.8);
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
          dot.userData = {
            apiName,
            isCountry: true,
            isDot: true,
            baseScale: 1,
          };
          countryMeshesRef.current.add(dot);
        }
      });
    });

    // ── Animate ──────────────────────────────────────────────
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      if (!visibleRef.current) return;
      if (!isDragging.current) {
        globeGroupRef.current.rotation.y += 0.0006;
      }
      if (cloudsRef.current) cloudsRef.current.rotation.y += 0.00012;

      const time = Date.now() * 0.005;
      countryMeshesRef.current.children.forEach((obj) => {
        if (obj.userData?.isDot && obj.userData?.severity) {
          const mul = 1 + Math.sin(time + obj.id) * 0.4; // random offset by id
          obj.scale.setScalar(obj.userData.baseScale * mul);
        } else if (
          obj.userData?.isDot &&
          obj.scale.x !== obj.userData.baseScale
        ) {
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
      rendererRef.current.setSize(
        container.clientWidth,
        container.clientHeight,
      );
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

      const hits = raycaster.intersectObjects(
        countryMeshesRef.current.children,
        false,
      );
      const hit = hits.find((h) => h.object.userData?.isCountry);

      if (hit) {
        const name: string = hit.object.userData.apiName;
        if (name !== lastHovered.current) {
          lastHovered.current = name;
          onHoverRef.current(name);
          // Highlight
          countryMeshesRef.current.children.forEach((obj) => {
            const isThis = obj.userData.apiName === name;
            if (
              obj instanceof THREE.Mesh &&
              obj.material instanceof THREE.MeshStandardMaterial
            ) {
              if (obj.userData.isShape) {
                const base = obj.userData.baseOpacity ?? 0;
                obj.material.opacity = isThis ? Math.max(0.35, base) : base;
                obj.material.emissiveIntensity = isThis ? 0.5 : 0.15;
              } else {
                obj.material.emissiveIntensity = isThis ? 1.2 : 0.4;
                if (isThis) obj.scale.setScalar(1.3);
                else obj.scale.setScalar(1);
              }
            }
            if (
              obj instanceof THREE.Line &&
              obj.material instanceof THREE.LineBasicMaterial
            ) {
              obj.material.opacity = isThis ? 0.95 : 0.35;
              if (isThis) obj.material.color.set(0x93c5fd);
              else obj.material.color.set(0xdbeafe);
            }
          });
        }
      } else if (lastHovered.current) {
        lastHovered.current = null;
        onHoverRef.current(null);
        countryMeshesRef.current.children.forEach((obj) => {
          if (
            obj instanceof THREE.Mesh &&
            obj.material instanceof THREE.MeshStandardMaterial
          ) {
            if (obj.userData.isShape) {
              obj.material.opacity = obj.userData.baseOpacity ?? 0;
              obj.material.emissiveIntensity = 0.15;
            } else {
              obj.material.emissiveIntensity = 0.4;
              obj.scale.setScalar(1);
            }
          }
          if (
            obj instanceof THREE.Line &&
            obj.material instanceof THREE.LineBasicMaterial
          ) {
            obj.material.opacity = 0.35;
            obj.material.color.set(0xdbeafe);
          }
        });
      }
    };

    const onUp = (e: MouseEvent) => {
      const moved =
        Math.abs(e.clientX - mouseDownPos.current.x) < 6 &&
        Math.abs(e.clientY - mouseDownPos.current.y) < 6;
      const quick = Date.now() - mouseDownTime.current < 300;
      if (moved && quick && cameraRef.current && e.target === rendererRef.current?.domElement) {
        const rect = container.getBoundingClientRect();
        const ray = new THREE.Raycaster();
        ray.setFromCamera(
          new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1,
          ),
          cameraRef.current,
        );
        const hit = ray
          .intersectObjects(countryMeshesRef.current.children, false)
          .find((h) => h.object.userData?.isShape || h.object.userData?.isDot);
        const name: string | undefined = hit?.object.userData.apiName ?? lastHovered.current ?? undefined;
        if (name) onClickRef.current(name);
      }
      isDragging.current = false;
      container.style.cursor = "grab";
    };

    const onWheel = (e: WheelEvent) => {
      if (!visibleRef.current || !cameraRef.current) return;
      e.preventDefault();
      cameraRef.current.position.z = Math.max(150, Math.min(700, cameraRef.current.position.z * (e.deltaY > 0 ? 1.08 : 0.92)));
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      ro.disconnect();
      container.removeEventListener("wheel", onWheel);
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
      const objIso: string | undefined = obj.userData.iso;
      let colorHex =
        fillByIso && fillByIso.size > 0
          ? (objIso && fillByIso.get(objIso)) || "#94a3b8"
          : colorForCountry(apiName);
      if (colorHex && colorHex.length > 7) colorHex = colorHex.substring(0, 7);

      const severity = simulationResults
        ? simulationResults[apiName]
        : undefined;
      if (severity === "critical") colorHex = "#ef4444";
      else if (severity === "high") colorHex = "#f97316";
      else if (severity === "medium") colorHex = "#f59e0b";
      else if (severity === "low") colorHex = "#eab308";

      if (obj.userData.isDot) obj.userData.severity = severity;

      if (
        obj instanceof THREE.Mesh &&
        obj.material instanceof THREE.MeshStandardMaterial
      ) {
        obj.material.color.set(colorHex);
        obj.material.emissive.set(colorHex);
        // Boost glow if it's severe
        if (obj.userData.isShape) {
          // The real Earth shows through: tint only when there is something to show.
          const tinted = !!severity || (fillByIso !== undefined && fillByIso.size > 0);
          const base = severity ? 0.6 : tinted ? 0.5 : 0;
          obj.userData.baseOpacity = base;
          obj.material.opacity = obj.userData.apiName === lastHovered.current ? Math.max(0.35, base) : base;
          obj.material.emissiveIntensity = tinted ? 0.25 : 0.15;
        } else {
          obj.material.emissiveIntensity = severity
            ? 1.5
            : obj.userData.apiName === lastHovered.current
              ? 1.2
              : 0.4;
        }
      }
      if (
        obj instanceof THREE.Line &&
        obj.material instanceof THREE.LineBasicMaterial
      ) {
        obj.material.color.set(severity ? colorHex : 0xdbeafe);
        obj.material.opacity = severity ? 0.9 : 0.35;
      }
    });
  }, [colorForCountry, simulationResults, fillByIso, isoToName]);

  // ── Canonical names from the graph (ISO join) ─────────────
  useEffect(() => {
    if (!isoToName || isoToName.size === 0) return;
    countryMeshesRef.current.children.forEach((obj) => {
      const iso: string | undefined = obj.userData?.iso;
      if (iso && isoToName.has(iso)) obj.userData.apiName = isoToName.get(iso);
    });
  }, [isoToName]);

  // ── Update relations arcs ─────────────────────────────────
  // THREE.Line instead of a TubeGeometry per arc: a tube is ~200 triangles,
  // a line is one draw-cheap polyline, so 1,000+ arcs stay smooth.
  useEffect(() => {
    relationsGroupRef.current.children.forEach((c) => {
      if (c instanceof THREE.Line) {
        c.geometry.dispose();
        (c.material as THREE.Material).dispose();
      }
    });
    relationsGroupRef.current.clear();
    if (!showRelations || !relations.length) return;

    const ranked = [...relations].sort((x, y) => (y.weight ?? 0) - (x.weight ?? 0)).slice(0, 1500);
    ranked.forEach((rel) => {
      const sc = (rel.fromIso && isoCoords?.get(rel.fromIso)) || getGeoCoords(rel.fromCountry);
      const ec = (rel.toIso && isoCoords?.get(rel.toIso)) || getGeoCoords(rel.toCountry);
      if (!sc || !ec) return;

      const start = geoCoordsTo3d(sc[0], sc[1], 100.6);
      const end = geoCoordsTo3d(ec[0], ec[1], 100.6);
      const lift = 104 + Math.min(30, start.distanceTo(end) * 0.12);
      const mid = start.clone().lerp(end, 0.5).normalize().multiplyScalar(lift);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(32));
      const mat = new THREE.LineBasicMaterial({
        color: (rel.moduleColor ?? "#6366f1").substring(0, 7),
        transparent: true,
        opacity: Math.min(1, (0.25 + Math.min(0.6, (rel.weight ?? 0.5) * 0.6)) * (linkOpacity / 0.6)),
      });
      relationsGroupRef.current.add(new THREE.Line(geo, mat));
    });
  }, [relations, showRelations, getGeoCoords, isoCoords, linkOpacity]);

  return (
    <div ref={containerRef} className="relative w-full h-full" style={{ cursor: "grab" }}>
      <div className="absolute bottom-[116px] left-[344px] z-10 flex flex-col bo-panel rounded-xl overflow-hidden">
        {[
          ["+", 0.8, "Zoom in"],
          ["−", 1.25, "Zoom out"],
        ].map(([label, f, title]) => (
          <button
            key={label as string}
            onClick={() => zoomBy(f as number)}
            title={title as string}
            className="w-10 h-10 bo-t1 text-lg font-semibold hover:bg-[var(--bo-accent-soft)] border-b last:border-b-0 bo-divider"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default React.memo(GlobeMap);
