import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { dispose3DResource } from './AssetPreviewLoader';
import { RotateCw, ZoomIn, Eye, Grid } from 'lucide-react';

export interface AssetPreview3DProps {
  modelScene: THREE.Object3D;
  className?: string;
  onMetricsUpdate?: (metrics: { meshes: number; triangles: number }) => void;
}

export const AssetPreview3D: React.FC<AssetPreview3DProps> = ({
  modelScene,
  className = '',
  onMetricsUpdate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [wireframe, setWireframe] = useState<boolean>(false);

  // Reset camera to fit bounding box
  const fitCameraToModel = useCallback((sceneObj: THREE.Object3D) => {
    if (!cameraRef.current || !controlsRef.current) return;

    const bbox = new THREE.Box3().setFromObject(sceneObj);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bbox.getSize(size);
    bbox.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z, 0.5);
    const fov = cameraRef.current.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;

    cameraRef.current.position.set(center.x, center.y + size.y * 0.2, center.z + cameraZ);
    cameraRef.current.lookAt(center);
    cameraRef.current.near = maxDim / 100;
    cameraRef.current.far = maxDim * 100;
    cameraRef.current.updateProjectionMatrix();

    controlsRef.current.target.copy(center);
    controlsRef.current.update();
  }, []);

  const handleResetCamera = () => {
    if (modelScene) {
      fitCameraToModel(modelScene);
    }
  };

  // Toggle wireframe on all meshes
  useEffect(() => {
    if (!modelScene) return;
    modelScene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => {
              (m as THREE.MeshStandardMaterial).wireframe = wireframe;
            });
          } else {
            (mesh.material as THREE.MeshStandardMaterial).wireframe = wireframe;
          }
        }
      }
    });
  }, [modelScene, wireframe]);

  // Toggle Grid
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
  }, [showGrid]);

  // Controls autoRotate sync
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
      controlsRef.current.autoRotateSpeed = 2.0;
    }
  }, [autoRotate]);

  // Main Three.js Scene Setup & Cleanup
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0a0714);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;

    // 3. Renderer with power-preference and antialias
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'default',
      alpha: false,
    });
    rendererRef.current = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio to 2 for mobile GPU
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = false; // Disable heavy shadow maps for mobile safety

    container.appendChild(renderer.domElement);

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.minDistance = 0.2;
    controls.maxDistance = 50;

    // 5. Lighting (Aether Lavender / Mint ambient aesthetic)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLightFront = new THREE.DirectionalLight(0xfff5ea, 1.5);
    dirLightFront.position.set(2, 4, 3);
    scene.add(dirLightFront);

    const dirLightRim = new THREE.DirectionalLight(0xa855f7, 0.8);
    dirLightRim.position.set(-3, 2, -3);
    scene.add(dirLightRim);

    // 6. Grid Helper
    const grid = new THREE.GridHelper(10, 20, 0xa855f7, 0x2e1b4d);
    grid.position.y = 0;
    gridHelperRef.current = grid;
    grid.visible = showGrid;
    scene.add(grid);

    // 7. Add Model Scene
    scene.add(modelScene);
    fitCameraToModel(modelScene);

    // 8. Animation Loop
    const clock = new THREE.Clock();
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      clock.getDelta();

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // 9. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = newW / newH;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(newW, newH);
        }
      }
    });
    resizeObserver.observe(container);

    // 10. Cleanup on unmount or modelScene switch
    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      resizeObserver.disconnect();

      if (controlsRef.current) {
        controlsRef.current.dispose();
      }

      scene.remove(modelScene);
      dispose3DResource(modelScene);

      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [modelScene, fitCameraToModel]);

  return (
    <div className={`relative w-full h-full min-h-[340px] rounded-2xl overflow-hidden bg-[#07050D] select-none ${className}`}>
      {/* Three.js canvas container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating HUD Controls */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 pointer-events-auto">
          <button
            type="button"
            onClick={handleResetCamera}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Reset Camera"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1.5 rounded-lg transition-colors ${
              autoRotate ? 'text-purple-300 bg-purple-600/30' : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            title="Toggle Auto-Rotate"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded-lg transition-colors ${
              showGrid ? 'text-purple-300 bg-purple-600/30' : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            title="Toggle Ground Grid"
          >
            <Grid className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setWireframe(!wireframe)}
            className={`p-1.5 rounded-lg transition-colors ${
              wireframe ? 'text-purple-300 bg-purple-600/30' : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            title="Toggle Wireframe"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>

        <div className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-white/50 pointer-events-auto">
          Drag: Orbit • Scroll: Zoom
        </div>
      </div>
    </div>
  );
};
