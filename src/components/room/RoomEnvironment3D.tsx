import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CompanionRig } from './CompanionRig';
import { CompanionState, CompanionEmotion } from '../../lib/companionPersonality';
import { loadWeb3DAsset } from '@/Aether/3D/Preview/AssetPreviewLoader';
import { Mic, Volume2, Sparkles, Brain } from 'lucide-react';

export interface RoomEnvironment3DProps {
  companionState: CompanionState;
  companionEmotion: CompanionEmotion;
  visemeMouthOpen: number;
  companionModelUrl?: string | null;
  onCompanionClick?: () => void;
  className?: string;
}

export const RoomEnvironment3D: React.FC<RoomEnvironment3DProps> = ({
  companionState,
  companionEmotion,
  visemeMouthOpen,
  companionModelUrl,
  onCompanionClick,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const companionRigRef = useRef<CompanionRig | null>(null);
  const floorGlowRef = useRef<THREE.PointLight | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const targetLookPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.45, 3.4));

  // Sync Emotion & Visemes to 3D Companion Rig
  useEffect(() => {
    if (companionRigRef.current) {
      companionRigRef.current.setEmotion(companionEmotion);
    }
  }, [companionEmotion]);

  useEffect(() => {
    if (companionRigRef.current) {
      companionRigRef.current.setViseme(visemeMouthOpen);
    }
  }, [visemeMouthOpen]);

  // Main 3D Room N Scene Setup
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x06030b);
    scene.fog = new THREE.FogExp2(0x06030b, 0.07);

    // 2. Camera setup - Natural human standing height (Y = 1.45m), framing full-body feet-to-head
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);
    camera.position.set(0, 1.45, 3.4);
    camera.lookAt(0, 1.05, 0);
    cameraRef.current = camera;
    targetLookPosRef.current.copy(camera.position);

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    rendererRef.current = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    container.appendChild(renderer.domElement);

    // 4. Lighting Rig (Room N Atmosphere - Deep Amethyst & Soft Warm Key)
    const ambientLight = new THREE.AmbientLight(0x2d174d, 1.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff6ed, 2.2);
    keyLight.position.set(1.8, 3.8, 3.0);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    fillLight.position.set(-2.8, 2.2, 2.0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xc084fc, 2.6);
    rimLight.position.set(0, 3.0, -2.8);
    scene.add(rimLight);

    const floorGlow = new THREE.PointLight(0xa855f7, 2.2, 7);
    floorGlow.position.set(0, 0.25, 0);
    floorGlowRef.current = floorGlow;
    scene.add(floorGlow);

    // 5. Room N Architectural Environment (Cyberpunk Reflective Floor & Neon Pillars)
    const roomGroup = new THREE.Group();

    // Floor (Dark reflective cyber tiles)
    const floorGeo = new THREE.PlaneGeometry(14, 14);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0c0717,
      roughness: 0.22,
      metalness: 0.88,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    roomGroup.add(floor);

    // Floor Cyber Grid
    const grid = new THREE.GridHelper(14, 28, 0x9333ea, 0x1d1033);
    grid.position.y = 0.005;
    roomGroup.add(grid);

    // Back Wall
    const backWallGeo = new THREE.PlaneGeometry(14, 6.5);
    const backWallMat = new THREE.MeshStandardMaterial({
      color: 0x080412,
      roughness: 0.65,
      metalness: 0.3,
    });
    const backWall = new THREE.Mesh(backWallGeo, backWallMat);
    backWall.position.set(0, 3.25, -3.8);
    roomGroup.add(backWall);

    // Neon Wall Trim Line
    const neonLineGeo = new THREE.BoxGeometry(9.0, 0.035, 0.04);
    const neonLineMat = new THREE.MeshBasicMaterial({ color: 0xc084fc });
    const neonLine = new THREE.Mesh(neonLineGeo, neonLineMat);
    neonLine.position.set(0, 2.4, -3.75);
    roomGroup.add(neonLine);

    // Cyber Room Pillars
    const pillarGeo = new THREE.CylinderGeometry(0.07, 0.07, 5.5, 16);
    const pillarMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
    leftPillar.position.set(-3.2, 2.75, -2.2);
    roomGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
    rightPillar.position.set(3.2, 2.75, -2.2);
    roomGroup.add(rightPillar);

    scene.add(roomGroup);

    // 6. Mount Companion Rig
    let isCancelled = false;
    if (companionModelUrl) {
      loadWeb3DAsset(companionModelUrl, true).then((res) => {
        if (isCancelled) return;
        const rig = new CompanionRig(res.vrm || null);
        companionRigRef.current = rig;
        scene.add(rig.root);
        rig.setEmotion(companionEmotion);
      });
    } else {
      const rig = new CompanionRig(null);
      companionRigRef.current = rig;
      scene.add(rig.root);
      rig.setEmotion(companionEmotion);
    }

    // 7. Subtle interactive parallax on mouse / touch move
    const handlePointerMove = (e: PointerEvent) => {
      const normX = (e.clientX / window.innerWidth - 0.5) * 2;
      const normY = (e.clientY / window.innerHeight - 0.5) * 2;

      // Gentle camera position shift
      camera.position.x = normX * 0.22;
      camera.position.y = 1.45 - normY * 0.1;
      camera.lookAt(0, 1.05, 0);

      targetLookPosRef.current.set(camera.position.x, camera.position.y, camera.position.z);
    };
    window.addEventListener('pointermove', handlePointerMove);

    // 8. Animation Loop
    const clock = new THREE.Clock();
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Update Companion Rig (Breathing, Eye Blinks, Visemes)
      if (companionRigRef.current) {
        companionRigRef.current.update(delta, elapsed, targetLookPosRef.current);
      }

      // Atmospheric floor light pulse
      if (floorGlowRef.current) {
        floorGlowRef.current.intensity = 2.0 + Math.sin(elapsed * 2.2) * 0.4;
      }

      renderer.render(scene, camera);
    };
    animate();

    // 9. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      isCancelled = true;
      window.removeEventListener('pointermove', handlePointerMove);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      resizeObserver.disconnect();

      if (companionRigRef.current) {
        companionRigRef.current.dispose();
      }

      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [companionModelUrl]);

  // Render Status Badge Icon
  const getStatusIcon = () => {
    switch (companionState) {
      case 'LISTENING':
        return <Mic className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />;
      case 'THINKING':
        return <Brain className="w-3.5 h-3.5 text-purple-300 animate-spin" />;
      case 'SPEAKING':
        return <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  const getStatusColor = () => {
    switch (companionState) {
      case 'LISTENING':
        return 'text-cyan-300 border-cyan-500/40 bg-cyan-950/40 shadow-[0_0_20px_rgba(6,182,212,0.35)]';
      case 'THINKING':
        return 'text-purple-300 border-purple-500/40 bg-purple-950/40 shadow-[0_0_20px_rgba(168,85,247,0.35)]';
      case 'SPEAKING':
        return 'text-emerald-300 border-emerald-500/40 bg-emerald-950/40 shadow-[0_0_20px_rgba(16,185,129,0.35)]';
      default:
        return 'text-white/80 border-purple-500/30 bg-black/40 shadow-[0_0_20px_-3px_rgba(168,85,247,0.25)]';
    }
  };

  return (
    <div className={`relative w-full h-full overflow-hidden select-none ${className}`}>
      {/* 3D WebGL Canvas */}
      <div
        ref={containerRef}
        onClick={onCompanionClick}
        className="w-full h-full cursor-pointer"
      />

      {/* Subtle Companion Status Pill (Natural, Non-Intrusive) */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div
          className={`glass-nav-pill px-4 py-1.5 rounded-full flex items-center gap-2 border backdrop-blur-md transition-all duration-300 ${getStatusColor()}`}
        >
          {getStatusIcon()}
          <span className="text-xs font-medium tracking-wide">
            Aether
          </span>
          <span className="text-[10px] opacity-60 font-mono tracking-wider uppercase">
            • {companionState}
          </span>
          {companionEmotion !== 'NEUTRAL' && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-purple-200">
              {companionEmotion}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
