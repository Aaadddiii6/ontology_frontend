import React, { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import { CountryProfile, ActiveModule } from "../../types";
import { normalizeCountryName, getModuleColor } from "../../lib/countryData";

interface GlobeMapProps {
  profileMap: Map<string, CountryProfile>;
  activeModule: ActiveModule;
  onCountryHover: (name: string | null) => void;
  onCountryClick: (name: string) => void;
  visible: boolean;
}

// Helper to convert lat/lon to 3D points
const geoCoordsTo3d = (lon: number, lat: number, radius: number) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
};

const GlobeMap: React.FC<GlobeMapProps> = ({
  profileMap,
  activeModule,
  onCountryHover,
  onCountryClick,
  visible,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const previousMouse = useRef({ x: 0, y: 0 });
  const globeGroup = useRef<THREE.Group>(new THREE.Group());
  const lastHovered = useRef<string | null>(null);

  const updateCountryColors = useCallback(() => {
    globeGroup.current.children.forEach((obj) => {
      if (obj.userData.isCountry) {
        const countryName = obj.userData.countryName;
        const profile = profileMap.get(countryName);
        const color = getModuleColor(profile, activeModule);
        (obj as THREE.Mesh).material = new THREE.MeshPhongMaterial({ color });
      }
    });
  }, [activeModule, profileMap]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !visible) return;

    let animationFrameId: number;

    // --- Scene, Camera, Renderer ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    camera.position.z = 320;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // --- Lighting ---
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(200, 200, 200);
    scene.add(dirLight);

    // --- Globe ---
    const globeSphere = new THREE.Mesh(
      new THREE.SphereGeometry(120, 64, 64),
      new THREE.MeshPhongMaterial({ color: 0xdbd8f0, shininess: 30 }),
    );
    globeGroup.current.add(globeSphere);
    scene.add(globeGroup.current);

    const raycastMeshes: THREE.Mesh[] = [];

    // --- Load and Draw Country Data ---
    d3.json<any>("/data/countries-110m.json").then((world) => {
      if (!world) return;
      const countries = topojson.feature(world, world.objects.countries as any);

      (countries as any).features.forEach((feature: any) => {
        const apiName = normalizeCountryName((feature.properties as any).name);
        if (!apiName) return;

        // Create invisible spheres at centroids for raycasting
        const centroid = d3.geoCentroid(feature);
        const pos = geoCoordsTo3d(centroid[0], centroid[1], 120.5);
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(2, 8, 8),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        mesh.position.copy(pos);
        mesh.userData.countryName = apiName;
        raycastMeshes.push(mesh);
        globeGroup.current.add(mesh);
      });
    });

    // --- Interaction ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseMove = (event: MouseEvent) => {
      if (isDragging.current) {
        const deltaX = event.clientX - previousMouse.current.x;
        const deltaY = event.clientY - previousMouse.current.y;
        globeGroup.current.rotation.y += deltaX * 0.005;
        globeGroup.current.rotation.x += deltaY * 0.003;
        globeGroup.current.rotation.x = Math.max(
          -0.8,
          Math.min(0.8, globeGroup.current.rotation.x),
        );
        previousMouse.current = { x: event.clientX, y: event.clientY };
      } else {
        mouse.x = (event.offsetX / container.clientWidth) * 2 - 1;
        mouse.y = -(event.offsetY / container.clientHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(raycastMeshes);

        if (intersects.length > 0) {
          const countryName = intersects[0].object.userData.countryName;
          if (lastHovered.current !== countryName) {
            onCountryHover(countryName);
            lastHovered.current = countryName;
          }
        } else if (lastHovered.current) {
          onCountryHover(null);
          lastHovered.current = null;
        }
      }
    };

    const onMouseDown = (event: MouseEvent) => {
      isDragging.current = true;
      previousMouse.current = { x: event.clientX, y: event.clientY };
    };

    const onMouseUp = () => {
      isDragging.current = false;
    };

    const onClick = () => {
      if (lastHovered.current) {
        onCountryClick(lastHovered.current);
      }
    };

    container.addEventListener("mousedown", onMouseDown);
    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseup", onMouseUp);
    container.addEventListener("mouseleave", onMouseUp);
    container.addEventListener("click", onClick);

    // --- Animation Loop ---
    const animate = () => {
      if (!isDragging.current && !lastHovered.current) {
        globeGroup.current.rotation.y += 0.0005;
      }
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    // --- Resize ---
    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);

    // --- Cleanup ---
    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("mouseleave", onMouseUp);
      container.removeEventListener("click", onClick);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [visible, onCountryHover, onCountryClick]);

  useEffect(() => {
    if (visible) {
      updateCountryColors();
    }
  }, [visible, updateCountryColors]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        cursor: isDragging.current ? "grabbing" : "grab",
        display: visible ? "block" : "none",
      }}
    />
  );
};

export default GlobeMap;
