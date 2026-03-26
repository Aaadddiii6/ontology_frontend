import React, { useEffect, useRef, useCallback, useMemo } from "react";
import * as THREE from "three";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import { CountryProfile, ActiveModule, RelationEdge } from "../../types";
import { normalizeCountryName, getModuleColor } from "../../lib/countryData";

interface GlobeMapProps {
  profileMap: Map<string, CountryProfile>;
  activeModule: ActiveModule;
  onCountryHover: (name: string | null) => void;
  onCountryClick: (name: string) => void;
  visible: boolean;
  showRelations?: boolean;
  relations?: RelationEdge[];
  countryCoords?: Map<string, [number, number]>;
}

const TOP_30_COUNTRIES_GEO: Record<string, [number, number]> = {
  "United States": [-95.7, 37.1],
  "Russian Federation": [105.3, 61.5],
  China: [104.2, 35.9],
  "United Kingdom": [-3.4, 55.4],
  France: [2.2, 46.2],
  Germany: [10.5, 51.2],
  India: [79.0, 20.6],
  Pakistan: [69.3, 30.4],
  Brazil: [-51.9, -14.2],
  "Saudi Arabia": [45.1, 23.9],
  Israel: [34.9, 31.0],
  "Iran, Islamic Republic of": [53.7, 32.4],
  Ukraine: [31.2, 48.4],
  Japan: [138.3, 36.2],
  "Korea, Republic of": [127.8, 35.9],
  Turkey: [35.2, 39.0],
  Egypt: [30.8, 26.8],
  Nigeria: [8.7, 9.1],
  Indonesia: [113.9, -0.8],
  Australia: [133.8, -25.3],
  Canada: [-106.3, 56.1],
  Mexico: [-102.6, 23.6],
  Poland: [19.1, 51.9],
  Italy: [12.6, 41.9],
  Spain: [-3.7, 40.5],
  Netherlands: [5.3, 52.1],
  Belgium: [4.5, 50.5],
  Sweden: [18.6, 60.1],
  Norway: [8.5, 60.5],
  Finland: [25.7, 61.9],
};

const geoCoordsTo3d = (lon: number, lat: number, radius: number) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
};

const createArcPath = (
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
) => {
  const mid = start.clone().lerp(end, 0.5);
  const midLen = mid.length();
  mid.normalize().multiplyScalar(midLen + radius * 0.2); // Elevate the midpoint

  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  return curve;
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const mouseDownTime = useRef(0);
  const mouseDownPos = useRef({ x: 0, y: 0 });
  const previousMouse = useRef({ x: 0, y: 0 });
  const globeGroup = useRef<THREE.Group>(new THREE.Group());
  const lastHovered = useRef<string | null>(null);
  const countryMeshesRef = useRef<THREE.Group>(new THREE.Group());
  const relationsGroup = useRef<THREE.Group>(new THREE.Group());
  const circlesGroup = useRef<THREE.Group>(new THREE.Group());
  const lastRaycastTime = useRef(0);
  const countryPosRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const visibleRef = useRef(visible);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  const getOverviewColor = useCallback(
    (apiName: string | null) => {
      if (!apiName) return "#8ad0f0"; // Not in database/no name
      const profile = profileMap.get(apiName);
      if (!profile) return "#8ad0f0"; // Not in database
      if (profile.nuclear === "confirmed") return "#0f52ba";
      return "#6694f6"; // Default parchment tan
    },
    [profileMap],
  );

  const updateCountryColors = useCallback(() => {
    countryMeshesRef.current.children.forEach((obj) => {
      if (obj.userData.isCountryMesh) {
        const countryName = obj.userData.countryName;
        const profile = profileMap.get(countryName);
        let color: string;
        if (activeModule === "overview") {
          color = getOverviewColor(countryName);
        } else {
          color = getModuleColor(profile, activeModule);
        }

        if (
          obj instanceof THREE.Mesh &&
          obj.material instanceof THREE.MeshStandardMaterial
        ) {
          const baseColor = color.substring(0, 7);
          obj.material.color.set(baseColor);
          obj.material.emissive.set(baseColor);
          obj.material.emissiveIntensity = 0.2;

          if (color.length === 9) {
            obj.material.transparent = true;
            obj.material.opacity = parseInt(color.substring(7, 9), 16) / 255;
          } else {
            obj.material.transparent = false;
            obj.material.opacity = 1;
          }
        } else if (
          obj instanceof THREE.Line &&
          obj.material instanceof THREE.LineBasicMaterial
        ) {
          // Lines don't have emissive, just set base color if we ever want to color borders
          // For now we keep them white but update opacity if needed
          obj.userData.baseColor = color;
        }
      }
    });
  }, [activeModule, profileMap, getOverviewColor]);

  const updateCirclesAndRelations = useCallback(() => {
    circlesGroup.current.clear();
    relationsGroup.current.clear();

    if (!visible) return;

    const moduleAccentRaw =
      activeModule === "overview"
        ? "#c4a882"
        : getModuleColor(null, activeModule);
    const moduleAccentColor = moduleAccentRaw.substring(0, 7);

    const getGeoCoords = (name: string): [number, number] | null => {
      if (countryCoords && countryCoords.has(name))
        return countryCoords.get(name)!;
      const normalized = normalizeCountryName(name);
      if (normalized && countryCoords && countryCoords.has(normalized))
        return countryCoords.get(normalized)!;
      return (
        TOP_30_COUNTRIES_GEO[name] ||
        TOP_30_COUNTRIES_GEO[normalized || ""] ||
        null
      );
    };

    // Country Circles for all countries in profileMap
    profileMap.forEach((profile, countryName) => {
      const geo = getGeoCoords(countryName);
      if (geo) {
        const pos = geoCoordsTo3d(geo[0], geo[1], 101.5);
        const size = 0.8 + (profile.defense_composite || 0) * 2;
        const geometry = new THREE.SphereGeometry(size, 8, 8);
        const material = new THREE.MeshBasicMaterial({
          color: moduleAccentColor,
          transparent: true,
          opacity: 0.8,
        });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(pos);
        circlesGroup.current.add(sphere);
      }
    });

    // 3D Relations
    if (showRelations && relations && relations.length > 0) {
      relations.forEach((rel) => {
        const startCoords = getGeoCoords(rel.fromCountry);
        const endCoords = getGeoCoords(rel.toCountry);

        if (startCoords && endCoords) {
          const start = geoCoordsTo3d(startCoords[0], startCoords[1], 100.5);
          const end = geoCoordsTo3d(endCoords[0], endCoords[1], 100.5);

          const mid = start
            .clone()
            .lerp(end, 0.5)
            .normalize()
            .multiplyScalar(115);
          const curve = new THREE.QuadraticBezierCurve3(start, mid, end);

          const geometry = new THREE.TubeGeometry(curve, 20, 0.2, 4, false);
          const material = new THREE.MeshBasicMaterial({
            color: (rel.moduleColor || "#ffffff").substring(0, 7),
            transparent: true,
            opacity: Math.min(rel.weight * 0.7, 0.8),
          });
          const tube = new THREE.Mesh(geometry, material);
          tube.userData.curve = curve;
          tube.userData.offset = Math.random(); // Start at random point
          relationsGroup.current.add(tube);
        }
      });
    }
  }, [
    visible,
    activeModule,
    profileMap,
    showRelations,
    relations,
    countryCoords,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.1,
      2000,
    );
    camera.position.z = 350;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.8);
    mainLight.position.set(500, 300, 500);
    scene.add(mainLight);

    const fillLight = new THREE.PointLight(0xffffff, 1, 1000);
    fillLight.position.set(-200, -100, 200);
    scene.add(fillLight);

    const globeBase = new THREE.Mesh(
      new THREE.SphereGeometry(100, 48, 48),
      new THREE.MeshStandardMaterial({
        color: 0x9ab8f4, // Updated globe color
        roughness: 0.2,
        metalness: 0.7,
        transparent: true,
        opacity: 0.9,
      }),
    );
    globeGroup.current.add(globeBase);

    // Inner glow - adjusted for lighter theme
    const innerGlow = new THREE.Mesh(
      new THREE.SphereGeometry(101, 48, 48),
      new THREE.MeshStandardMaterial({
        color: 0x6366f1,
        transparent: true,
        opacity: 0.1,
        side: THREE.FrontSide,
      }),
    );
    globeGroup.current.add(innerGlow);

    const atmosphereOuter = new THREE.Mesh(
      new THREE.SphereGeometry(135, 48, 48),
      new THREE.MeshBasicMaterial({
        color: 0x4f46e5,
        transparent: true,
        opacity: 0.05,
        side: THREE.BackSide,
      }),
    );
    globeGroup.current.add(atmosphereOuter);

    const gridGeometry = new THREE.SphereGeometry(100.1, 40, 40);
    const gridMaterial = new THREE.MeshBasicMaterial({
      color: 0x333333,
      wireframe: true,
      transparent: true,
      opacity: 0.1,
    });
    const grid = new THREE.Mesh(gridGeometry, gridMaterial);
    globeGroup.current.add(grid);

    globeGroup.current.add(countryMeshesRef.current);
    globeGroup.current.add(relationsGroup.current);
    globeGroup.current.add(circlesGroup.current);
    scene.add(globeGroup.current);

    d3.json<any>("/data/countries-110m.json").then((world) => {
      if (!world) return;
      const countries = topojson.feature(world, world.objects.countries as any);

      (countries as any).features.forEach((feature: any) => {
        const countryName = feature.properties.name;
        const apiName = normalizeCountryName(countryName);
        if (!apiName) return;

        const centroid = d3.geoCentroid(feature);
        const pos = geoCoordsTo3d(centroid[0], centroid[1], 100.5);
        countryPosRef.current.set(apiName, pos);

        const profile = profileMap.get(apiName);
        let color;
        if (activeModule === "overview") {
          color = getOverviewColor(apiName);
        } else {
          color = getModuleColor(profile, activeModule);
        }

        if (
          feature.geometry.type === "Polygon" ||
          feature.geometry.type === "MultiPolygon"
        ) {
          const polygons =
            feature.geometry.type === "Polygon"
              ? [feature.geometry.coordinates]
              : feature.geometry.coordinates;

          polygons.forEach((coords: any) => {
            const points = coords[0].map((coord: any) =>
              geoCoordsTo3d(coord[0], coord[1], 100.2),
            );

            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(
              geometry,
              new THREE.LineBasicMaterial({
                color: 0xffffff, // Defined white borders
                opacity: 0.8, // Increased opacity for definition
                transparent: true,
                linewidth: 1,
              }),
            );
            line.userData.countryName = apiName;
            line.userData.isCountryMesh = true;
            line.userData.baseColor = color;
            line.userData.isOverview = activeModule === "overview";
            countryMeshesRef.current.add(line);

            // Only add dots if NOT in overview
            if (activeModule !== "overview") {
              const dotGeo = new THREE.SphereGeometry(0.8, 8, 8);
              const baseColor = color.substring(0, 7);
              const dotMat = new THREE.MeshStandardMaterial({
                color: baseColor,
                emissive: baseColor,
                emissiveIntensity: 0.5,
                transparent: true,
                opacity:
                  color.length === 9
                    ? parseInt(color.substring(7, 9), 16) / 255
                    : 0.9,
              });
              const centroid = d3.geoCentroid(feature);
              const pos = geoCoordsTo3d(centroid[0], centroid[1], 101);
              const dot = new THREE.Mesh(dotGeo, dotMat);
              dot.position.copy(pos);
              dot.userData.countryName = apiName;
              dot.userData.isCountryMesh = true;
              countryMeshesRef.current.add(dot);
            }
          });
        }
      });
      updateCirclesAndRelations();
    });

    const raycaster = new THREE.Raycaster();
    raycaster.params.Line.threshold = 3; // Make lines easier to click
    const mouse = new THREE.Vector2();

    const onMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const isOverContainer =
        x >= 0 &&
        y >= 0 &&
        x <= container.clientWidth &&
        y <= container.clientHeight;

      if (isDragging.current) {
        const deltaX = event.clientX - previousMouse.current.x;
        const deltaY = event.clientY - previousMouse.current.y;
        globeGroup.current.rotation.y += deltaX * 0.005;
        globeGroup.current.rotation.x += deltaY * 0.003;
        globeGroup.current.rotation.x = Math.max(
          -1.2,
          Math.min(1.2, globeGroup.current.rotation.x),
        );
        previousMouse.current = { x: event.clientX, y: event.clientY };
      } else if (isOverContainer && visibleRef.current) {
        // Throttled raycasting
        const now = Date.now();
        if (now - lastRaycastTime.current < 50) return;
        lastRaycastTime.current = now;

        mouse.x = (x / container.clientWidth) * 2 - 1;
        mouse.y = -(y / container.clientHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(
          countryMeshesRef.current.children,
        );

        if (intersects.length > 0) {
          const name = intersects[0].object.userData.countryName;
          if (lastHovered.current !== name) {
            onCountryHover(name);
            lastHovered.current = name;

            countryMeshesRef.current.children.forEach((obj) => {
              if (obj.userData.countryName === name) {
                if (obj instanceof THREE.Mesh) {
                  obj.scale.set(2, 2, 2);
                  if (obj.material instanceof THREE.MeshStandardMaterial) {
                    obj.material.emissiveIntensity = 1;
                  }
                }
                if (obj instanceof THREE.Line) {
                  (obj.material as THREE.LineBasicMaterial).opacity = 1;
                  (obj.material as THREE.LineBasicMaterial).color.set(0x6366f1);
                }
              } else {
                if (obj instanceof THREE.Mesh) {
                  obj.scale.set(1, 1, 1);
                  if (obj.material instanceof THREE.MeshStandardMaterial) {
                    obj.material.emissiveIntensity = 0.2;
                  }
                }
                if (obj instanceof THREE.Line) {
                  (obj.material as THREE.LineBasicMaterial).opacity = 0.4;
                  (obj.material as THREE.LineBasicMaterial).color.set(0xffffff);
                }
              }
            });
          }
        } else if (lastHovered.current) {
          onCountryHover(null);
          lastHovered.current = null;
          countryMeshesRef.current.children.forEach((obj) => {
            if (obj instanceof THREE.Mesh) {
              obj.scale.set(1, 1, 1);
              if (obj.material instanceof THREE.MeshStandardMaterial) {
                obj.material.emissiveIntensity = 0.2;
              }
            }
            if (obj instanceof THREE.Line) {
              (obj.material as THREE.LineBasicMaterial).opacity = 0.4;
              (obj.material as THREE.LineBasicMaterial).color.set(0xffffff);
            }
          });
        }
      }
    };

    const onMouseDown = (event: MouseEvent) => {
      isDragging.current = true;
      mouseDownTime.current = Date.now();
      mouseDownPos.current = { x: event.clientX, y: event.clientY };
      previousMouse.current = { x: event.clientX, y: event.clientY };
      if (containerRef.current) containerRef.current.style.cursor = "grabbing";
    };

    const onMouseUp = (event: MouseEvent) => {
      isDragging.current = false;
      if (containerRef.current) containerRef.current.style.cursor = "crosshair";

      const moveX = Math.abs(event.clientX - mouseDownPos.current.x);
      const moveY = Math.abs(event.clientY - mouseDownPos.current.y);
      const timeElapsed = Date.now() - mouseDownTime.current;

      // If it was a quick click and not a drag
      if (moveX < 5 && moveY < 5 && timeElapsed < 250) {
        if (lastHovered.current) {
          onCountryClick(lastHovered.current);
        }
      }
    };

    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp); // Listen on window for more reliable drag release

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (!visibleRef.current) return;

      if (!isDragging.current) {
        globeGroup.current.rotation.y += 0.0005;
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onCountryHover, onCountryClick]); // Removed activeModule to prevent scene recreation

  useEffect(() => {
    updateCountryColors();
    updateCirclesAndRelations();
  }, [updateCountryColors, updateCirclesAndRelations]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{
        cursor: isDragging.current ? "grabbing" : "grab",
      }}
    />
  );
};

export default React.memo(GlobeMap);
