import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CompanionRig } from './CompanionRig';
import { CompanionState, CompanionEmotion, COMPANION_DISPLAY_NAME } from '../../lib/companionPersonality';
import { dispose3DResource, loadWeb3DAsset } from '@/Aether/3D/Preview/AssetPreviewLoader';
import { FurnitureLayoutEngine } from '../../lib/environment/FurnitureLayoutEngine';
import { Mic, Volume2, Sparkles, Brain } from 'lucide-react';

export interface RoomEnvironment3DProps {
  companionState: CompanionState;
  companionEmotion: CompanionEmotion;
  visemeMouthOpen: number;
  companionModelUrl?: string | null;
  roomModelUrl?: string | null;
  onCompanionClick?: () => void;
  className?: string;
  currentSpeechText?: string | null;
}

/**
 * Creates a smooth radial aura texture for the ethereal ground disc
 * eliminating all harsh geometric boundaries.
 */
function createRadialGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    gradient.addColorStop(0, 'rgba(168, 85, 247, 0.40)'); // Amethyst core
    gradient.addColorStop(0.28, 'rgba(147, 51, 234, 0.22)');
    gradient.addColorStop(0.60, 'rgba(56, 189, 248, 0.08)'); // Subtle cyan aura
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Full soft falloff
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  return texture;
}

/**
 * Creates soft circular particle sprites for ambient floating starlight motes.
 */
function createParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    grad.addColorStop(0.35, 'rgba(192, 132, 252, 0.45)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/**
 * Configures all VRM textures for ultra-crisp closeup rendering:
 * activates trilinear mipmapping, max hardware anisotropy, and linear filtering.
 */
function enhanceVRMTextures(root: THREE.Object3D, maxAnisotropy: number): void {
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of materials) {
        if (!mat) continue;
        const record = mat as unknown as Record<string, unknown>;
        for (const key of Object.keys(record)) {
          const val = record[key];
          if (val && typeof val === 'object' && (val as THREE.Texture).isTexture) {
            const tex = val as THREE.Texture;
            tex.generateMipmaps = true;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.anisotropy = Math.max(tex.anisotropy || 1, maxAnisotropy);
            tex.needsUpdate = true;
          }
        }
      }
    }
  });
}

export const RoomEnvironment3D: React.FC<RoomEnvironment3DProps> = ({
  companionState,
  companionEmotion,
  visemeMouthOpen,
  companionModelUrl,
  roomModelUrl,
  onCompanionClick,
  className = '',
  currentSpeechText = null,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const companionRigRef = useRef<CompanionRig | null>(null);
  const floorGlowRef = useRef<THREE.PointLight | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const stateRef = useRef(companionState);
  const emotionRef = useRef(companionEmotion);
  const visemeRef = useRef(visemeMouthOpen);
  const motionEnabledRef = useRef(true);
  const targetLookPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.25, 2.7));



  stateRef.current = companionState;
  emotionRef.current = companionEmotion;
  visemeRef.current = visemeMouthOpen;

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

  useEffect(() => {
    if (companionRigRef.current) {
      companionRigRef.current.setState(companionState);
    }
  }, [companionState]);

  useEffect(() => {
    if (companionRigRef.current) {
      if (currentSpeechText) {
        companionRigRef.current.onSpeechStart(currentSpeechText);
      } else {
        companionRigRef.current.onSpeechEnd();
      }
    }
  }, [currentSpeechText]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotionPreference = () => {
      motionEnabledRef.current = !preference.matches;
      companionRigRef.current?.setMotionEnabled(motionEnabledRef.current);
    };
    syncMotionPreference();
    preference.addEventListener('change', syncMotionPreference);
    return () => preference.removeEventListener('change', syncMotionPreference);
  }, []);

  // Performance Director External Triggers (Developer Mode & Interaction Bus)
  useEffect(() => {
    const handleAction = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.action && companionRigRef.current) {
        companionRigRef.current.triggerAction(detail.action, true);
      }
    };
    const handleFacial = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.style && companionRigRef.current) {
        companionRigRef.current.triggerFacialStyle(detail.style, detail.duration || 3.5);
      }
    };
    const handleNav = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.position && companionRigRef.current) {
        companionRigRef.current.navigateTo(detail.position, detail.faceYaw);
      }
    };
    const handleToggleRoam = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail?.enabled === 'boolean' && companionRigRef.current) {
        companionRigRef.current.setAutonomousNavigation(detail.enabled);
      }
    };

    window.addEventListener('aether:trigger-action', handleAction);
    window.addEventListener('aether:trigger-facial', handleFacial);
    window.addEventListener('aether:trigger-nav', handleNav);
    window.addEventListener('aether:toggle-roam', handleToggleRoam);

    return () => {
      window.removeEventListener('aether:trigger-action', handleAction);
      window.removeEventListener('aether:trigger-facial', handleFacial);
      window.removeEventListener('aether:trigger-nav', handleNav);
      window.removeEventListener('aether:toggle-roam', handleToggleRoam);
    };
  }, []);

  // Main 3D Room & Companion Scene Setup
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene setup: boundless deep obsidian void seamlessly faded with fog
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const BG_COLOR = 0x06030b;
    scene.background = new THREE.Color(BG_COLOR);
    scene.fog = new THREE.FogExp2(BG_COLOR, 0.035);

    // 2. Camera setup - centered directly on companion at eye/chest level
    const portraitViewport = height > width * 1.08;
    const initialCameraDistance = portraitViewport ? 2.28 : 2.7;
    const initialFocusY = portraitViewport ? 1.38 : 1.25;
    const camera = new THREE.PerspectiveCamera(portraitViewport ? 42 : 46, width / height, 0.1, 100);
    camera.position.set(0, initialFocusY, initialCameraDistance);
    camera.lookAt(0, initialFocusY, 0);
    cameraRef.current = camera;
    targetLookPosRef.current.copy(camera.position);

    // 3. WebGL Renderer with High-DPI support, ACES tone mapping, and sRGB color
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    rendererRef.current = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Anchor canvas firmly to the full window viewport so it cannot be squashed or compressed
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100vw';
    renderer.domElement.style.height = '100svh';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.pointerEvents = 'auto';
    renderer.domElement.style.touchAction = 'none';
    container.style.touchAction = 'none';

    container.appendChild(renderer.domElement);
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // 4. Lighting Rig (Soft Amethyst Studio & Warm Key)
    const ambientLight = new THREE.AmbientLight(0x1b2a3d, 0.72);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffead8, 2.15);
    keyLight.position.set(1.8, 3.8, 3.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 12;
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -2;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x8fc8e8, 0.58);
    fillLight.position.set(-3.2, 2.8, 2.4);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x6ea8c7, 0.9);
    rimLight.position.set(0, 3.2, -2.8);
    scene.add(rimLight);

    floorGlowRef.current = null;

    // 5. Boundless, Immersive Room Environment (No box walls, no harsh lines or borders)
    const roomGroup = new THREE.Group();

    // Large seamless floor: perfectly matches the fog color (0x06030b), disappearing into the horizon
    const floorGeo = new THREE.PlaneGeometry(120, 120);
    const floorMat = new THREE.MeshStandardMaterial({
      color: BG_COLOR,
      roughness: 0.32,
      metalness: 0.85,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    roomGroup.add(floor);

    // Ambient floating starlight particles providing depth and spatial atmosphere
    const particleCount = 65;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleBaseY = new Float32Array(particleCount);
    const particleSpeeds = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 8.0;
      particlePositions[i * 3 + 1] = 0.2 + Math.random() * 2.8;
      particleBaseY[i] = particlePositions[i * 3 + 1];
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 5.5 - 0.4;
      particleSpeeds[i] = 0.3 + Math.random() * 0.7;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleTexture = createParticleTexture();
    const particleMat = new THREE.PointsMaterial({
      size: 0.075,
      map: particleTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.65,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    roomGroup.add(particles);

    scene.add(roomGroup);

    // 6. Architectural Furniture Extraction & Spatial Layout Engine
    // Extracts authentic furniture and decorative assets from Neon World 3 (Noeo_world_3),
    // organizing them within the boundless AetherAI room with millimeter floor contact,
    // intentional architectural zoning, and active obstacle colliders for companion locomotion.
    let isCancelled = false;
    const roomLoadController = new AbortController();
    const companionLoadController = new AbortController();
    const furnitureColliders: THREE.Box3[] = [];

    if (roomModelUrl) {
      loadWeb3DAsset(roomModelUrl, false, roomLoadController.signal).then((res) => {
        if (isCancelled) {
          if (res.scene) dispose3DResource(res.scene);
          return;
        }
        if (!res.success || !res.scene) {
          console.warn('[Room3D] Neon room load failed, keeping procedural room:', res.error);
          return;
        }

        // Run Furniture Layout Engine
        const layoutResult = FurnitureLayoutEngine.extractAndOrganize(res.scene, {
          companionCenter: new THREE.Vector3(0, 0, 0),
          companionSafeRadius: 0.85,
          carpetElevation: 0.002,
        });

        // Keep the authored architectural shell visible. Hide only the source
        // furniture after extraction; doing this earlier would make the clones
        // produced by FurnitureLayoutEngine inherit visible=false.
        const sourceFurnitureNames = new Set([
          'Carpet', 'Drawer Base', 'DrawerSide1', 'DrawerSide2',
          'DrawerDoor1', 'DrawerDoor2', 'DrawerDoor3', 'DrawerDoor4',
          'Nightstand', 'Pillow', 'Pillow.001',
          'SimplePillow1_Root', 'SimplePillow2_Root',
        ]);
        res.scene.traverse((node) => {
          if (sourceFurnitureNames.has(node.name)) node.visible = false;
          if ((node as THREE.Mesh).isMesh) {
            const mesh = node as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });
        // Neon World contains its own authored floor/base surfaces. Once the
        // room loads, hide the large fallback plane so the two coplanar floors
        // cannot z-fight and produce diagonal seams or black patches.
        floor.visible = false;
        scene.add(res.scene);

        // Add extracted furniture into room
        scene.add(layoutResult.furnitureGroup);
        furnitureColliders.push(...layoutResult.colliders);

        // Feed collision barriers to companion rig if already mounted
        if (companionRigRef.current) {
          companionRigRef.current.setFurnitureColliders(furnitureColliders);
        }

        // Adjust studio ambiance for authentic high-end penthouse interior
        ambientLight.color.setHex(0x203246);
        ambientLight.intensity = 0.78;
        keyLight.intensity = 1.9;
        fillLight.intensity = 0.62;
        rimLight.intensity = 0.82;
        renderer.toneMappingExposure = 0.92;
      }).catch((err: unknown) => {
        if (!isCancelled) console.warn('[Room3D] Neon room load exception, keeping procedural room:', err);
      });
    }

    // 7. Mount Companion Rig & Enhance VRM Textures
    const mountFallbackRig = () => {
      if (isCancelled || companionRigRef.current) return;
      const rig = new CompanionRig(null);
      companionRigRef.current = rig;
      rig.root.position.set(0, 0, 0);
      if (furnitureColliders.length > 0) {
        rig.setFurnitureColliders(furnitureColliders);
      }
      scene.add(rig.root);
      rig.setEmotion(emotionRef.current);
      rig.setViseme(visemeRef.current);
      rig.setState(stateRef.current);
      rig.setMotionEnabled(motionEnabledRef.current);
    };

    if (companionModelUrl) {
      loadWeb3DAsset(companionModelUrl, true, companionLoadController.signal).then((res) => {
        if (isCancelled) {
          if (res.vrm?.scene || res.scene) dispose3DResource(res.vrm?.scene || res.scene);
          return;
        }
        if (!res.success || !res.vrm) {
          console.warn('[Room3D] Companion load failed, using procedural rig:', res.error);
          mountFallbackRig();
          return;
        }

        // Apply anisotropic filtering and trilinear mipmapping across all textures
        enhanceVRMTextures(res.vrm.scene, maxAnisotropy);

        const rig = new CompanionRig(res.vrm);
        companionRigRef.current = rig;
        rig.root.position.set(0, 0, 0);
        if (furnitureColliders.length > 0) {
          rig.setFurnitureColliders(furnitureColliders);
        }
        scene.add(rig.root);
        rig.setEmotion(emotionRef.current);
        rig.setViseme(visemeRef.current);
        rig.setState(stateRef.current);
        rig.setMotionEnabled(motionEnabledRef.current);
      }).catch((err) => {
        console.warn('[Room3D] Companion model load exception:', err);
        mountFallbackRig();
      });
    } else {
      mountFallbackRig();
    }

    // 8. Interactive 360° companion camera with ultra-smooth cinematic physics.
    // Centered directly on the companion at (0, 1.25, 0).
    // Drag horizontally to orbit around companion; drag vertically to tilt.
    // Pinch and mouse wheel zoom smoothly.
    const MIN_DISTANCE = 1.1;
    const MAX_DISTANCE = 5.2;
    let currentCamDist = initialCameraDistance;
    let targetCamDist = initialCameraDistance;
    let currentYaw = 0.0;
    let targetYaw = 0.0;
    let currentPitch = 0.0;
    let targetPitch = 0.0;
    let yawVelocity = 0;
    let pitchVelocity = 0;
    let lastMoveTime = performance.now();
    let isOrbiting = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;
    const currentRoomFocus = new THREE.Vector3(0.0, initialFocusY, 0.0);
    const targetRoomFocus = new THREE.Vector3(0.0, initialFocusY, 0.0);

    const ROTATION_SENSITIVITY_MOUSE = 0.0032;
    const ROTATION_SENSITIVITY_TOUCH = 0.0038;

    // Touch gesture tracking (1 finger = orbit, 2 fingers = smooth pinch-to-zoom)
    let isPinching = false;
    let initialPinchDist = 0;
    let pinchStartCamDist = initialCameraDistance;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        isPinching = true;
        initialPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        pinchStartCamDist = targetCamDist;
        yawVelocity = 0;
        pitchVelocity = 0;
      } else if (e.touches.length === 1) {
        isOrbiting = true;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
        lastMoveTime = performance.now();
        yawVelocity = 0;
        pitchVelocity = 0;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinching && initialPinchDist > 0) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scaleFactor = initialPinchDist / Math.max(dist, 10);
        targetCamDist = THREE.MathUtils.clamp(pinchStartCamDist * scaleFactor, MIN_DISTANCE, MAX_DISTANCE);
      } else if (e.touches.length === 1 && !isPinching) {
        e.preventDefault();
        const now = performance.now();
        const dt = Math.max((now - lastMoveTime) / 1000, 0.008);
        lastMoveTime = now;
        const t = e.touches[0];
        const dx = (t.clientX - lastTouchX) * ROTATION_SENSITIVITY_TOUCH;
        const dy = (t.clientY - lastTouchY) * ROTATION_SENSITIVITY_TOUCH;
        targetYaw -= dx;
        targetPitch = THREE.MathUtils.clamp(targetPitch + dy, -0.42, 0.45);

        // Filtered velocity for fluid release inertia
        const instYawVel = -dx / dt;
        const instPitchVel = dy / dt;
        yawVelocity = yawVelocity * 0.35 + instYawVel * 0.65;
        pitchVelocity = pitchVelocity * 0.35 + instPitchVel * 0.65;

        lastTouchX = t.clientX;
        lastTouchY = t.clientY;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        isPinching = false;
      }
      if (e.touches.length === 0) {
        isOrbiting = false;
        yawVelocity = THREE.MathUtils.clamp(yawVelocity, -3.5, 3.5);
        pitchVelocity = THREE.MathUtils.clamp(pitchVelocity, -2.2, 2.2);
      }
    };

    // Desktop Mouse Wheel Zoom with ultra-smooth delta
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomStep = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY) * 0.002, 0.32);
      targetCamDist = THREE.MathUtils.clamp(targetCamDist + zoomStep, MIN_DISTANCE, MAX_DISTANCE);
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      isOrbiting = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      lastMoveTime = performance.now();
      yawVelocity = 0;
      pitchVelocity = 0;
      container.setPointerCapture?.(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isOrbiting || e.pointerType === 'touch') return;
      const now = performance.now();
      const dt = Math.max((now - lastMoveTime) / 1000, 0.008);
      lastMoveTime = now;

      const dx = (e.clientX - lastPointerX) * ROTATION_SENSITIVITY_MOUSE;
      const dy = (e.clientY - lastPointerY) * ROTATION_SENSITIVITY_MOUSE;
      targetYaw -= dx;
      targetPitch = THREE.MathUtils.clamp(targetPitch + dy, -0.42, 0.45);

      const instYawVel = -dx / dt;
      const instPitchVel = dy / dt;
      yawVelocity = yawVelocity * 0.35 + instYawVel * 0.65;
      pitchVelocity = pitchVelocity * 0.35 + instPitchVel * 0.65;

      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    };

    const handlePointerUp = () => {
      isOrbiting = false;
      yawVelocity = THREE.MathUtils.clamp(yawVelocity, -3.5, 3.5);
      pitchVelocity = THREE.MathUtils.clamp(pitchVelocity, -2.2, 2.2);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('pointercancel', handlePointerUp);

    // 9. Animation Loop
    const clock = new THREE.Clock();
    let wasMotionEnabled = true;
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const motionEnabled = motionEnabledRef.current;

      // Ultra-smooth inertia gliding on release
      if (!isOrbiting) {
        if (Math.abs(yawVelocity) > 0.0001) {
          targetYaw += yawVelocity * delta;
          yawVelocity *= Math.pow(0.91, delta * 60);
        } else {
          yawVelocity = 0;
        }

        if (Math.abs(pitchVelocity) > 0.0001) {
          targetPitch = THREE.MathUtils.clamp(targetPitch + pitchVelocity * delta, -0.42, 0.45);
          pitchVelocity *= Math.pow(0.91, delta * 60);
        } else {
          pitchVelocity = 0;
        }
      }

      // Infinitesimal organic idle breathing sway when camera is resting
      const idleSway = motionEnabled && !isOrbiting && Math.abs(yawVelocity) < 0.02
        ? Math.sin(elapsed * 0.4) * 0.006
        : 0;

      // Silky frame-rate independent exponential dampening for focus target, yaw, pitch and distance
      currentRoomFocus.x = THREE.MathUtils.damp(currentRoomFocus.x, targetRoomFocus.x, 7.0, delta);
      currentRoomFocus.y = THREE.MathUtils.damp(currentRoomFocus.y, targetRoomFocus.y, 7.0, delta);
      currentRoomFocus.z = THREE.MathUtils.damp(currentRoomFocus.z, targetRoomFocus.z, 7.0, delta);

      currentYaw = THREE.MathUtils.damp(currentYaw, targetYaw + idleSway, 9.0, delta);
      currentPitch = THREE.MathUtils.damp(currentPitch, targetPitch, 9.0, delta);
      currentCamDist = THREE.MathUtils.damp(currentCamDist, targetCamDist, 7.5, delta);

      // True spherical projection without trigonometric distortion
      const cosPitch = Math.cos(currentPitch);
      const sinPitch = Math.sin(currentPitch);
      camera.position.x = currentRoomFocus.x + Math.sin(currentYaw) * cosPitch * currentCamDist;
      camera.position.y = currentRoomFocus.y + sinPitch * currentCamDist;
      camera.position.z = currentRoomFocus.z + Math.cos(currentYaw) * cosPitch * currentCamDist;
      camera.lookAt(currentRoomFocus);

      targetLookPosRef.current.copy(camera.position);

      // Update Companion Rig (Idle Breathing, Blinking, Visemes, Look-At, Locomotion)
      if (companionRigRef.current) {
        companionRigRef.current.update(delta, elapsed, targetLookPosRef.current);
        targetRoomFocus.x = companionRigRef.current.root.position.x;
        targetRoomFocus.z = companionRigRef.current.root.position.z;
        targetRoomFocus.y = initialFocusY;
      }

      // Atmospheric floor light pulse
      if (floorGlowRef.current) {
        floorGlowRef.current.intensity = motionEnabled ? 2.0 + Math.sin(elapsed * 2.2) * 0.4 : 2.0;
      }

      // Keep atmospheric particles still for reduced-motion preferences.
      if (roomGroup.parent === scene && (motionEnabled || wasMotionEnabled)) {
        const positions = particleGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < particleCount; i++) {
          const py = motionEnabled
            ? particleBaseY[i] + Math.sin(elapsed * particleSpeeds[i] + i) * 0.025
            : particleBaseY[i];
          positions.setY(i, py);
        }
        positions.needsUpdate = true;
      }
      wasMotionEnabled = motionEnabled;

      renderer.render(scene, camera);
    };
    animate();

    // 10. Robust Resize Handling (Immune to Mobile, iPad, and PC Virtual Keyboard Squashing)
    let prevWidth = width;
    let prevHeight = height;

    const handleResize = (w: number, h: number) => {
      if (w <= 0 || h <= 0 || !cameraRef.current || !rendererRef.current) return;

      // Detect if this resize is an on-screen keyboard opening/closing
      // (On Mobile, iPad, or Laptop/PC touch keyboard):
      // - Width remains virtually constant (|w - prevWidth| < 20).
      // - Height drops significantly or restores while an input is focused or visualViewport is shrunk.
      const isInputActive =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA';
      const isWidthConstant = Math.abs(w - prevWidth) < 20;
      const isHeightDrop = h < prevHeight - 70;
      const isHeightRestore = Math.abs(h - prevHeight) > 70 && !isHeightDrop;
      const isVisualViewportReduced =
        typeof window !== 'undefined' &&
        Boolean(window.visualViewport && window.visualViewport.height < prevHeight * 0.88);

      const isKeyboardEvent =
        isWidthConstant &&
        (isInputActive || isHeightDrop || isVisualViewportReduced || isHeightRestore);

      if (isKeyboardEvent) {
        // DO NOT RESIZE THE 3D CANVAS OR CAMERA!
        // The 3D room and companion must remain 100% full-sized, pristine, and uncompressed.
        return;
      }

      // Genuine window resize (desktop window resize or device orientation rotation)
      prevWidth = w;
      prevHeight = h;

      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        handleResize(w, h);
      }
    });
    resizeObserver.observe(container);

    const onWindowResize = () => {
      handleResize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('orientationchange', onWindowResize);

    return () => {
      isCancelled = true;
      roomLoadController.abort();
      companionLoadController.abort();
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('orientationchange', onWindowResize);

      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      resizeObserver.disconnect();

      if (companionRigRef.current) {
        companionRigRef.current.dispose();
        companionRigRef.current = null;
      }

      dispose3DResource(scene);

      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      scene.clear();
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      floorGlowRef.current = null;
      animFrameIdRef.current = null;
    };
  }, [companionModelUrl, roomModelUrl]);

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
        return 'text-emerald-300 border-emerald-500/40 bg-emerald-950/40 shadow-[0_0_20px_rgba(168,85,247,0.35)]';
      default:
        return 'text-white/80 border-purple-500/30 bg-black/40 shadow-[0_0_20px_-3px_rgba(168,85,247,0.25)]';
    }
  };

  return (
    <div
      style={{ touchAction: 'none' }}
      className={`aether-room-stage fixed inset-0 w-full h-full overflow-hidden select-none pointer-events-auto ${className}`}
    >
      {/* 3D WebGL Canvas */}
      <div
        ref={containerRef}
        onClick={onCompanionClick}
        className="fixed inset-0 w-full h-full cursor-pointer"
      />

      {/* Subtle Companion Status Pill */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div
          className={`glass-nav-pill px-4 py-1.5 rounded-full flex items-center gap-2 border backdrop-blur-md transition-all duration-300 ${getStatusColor()}`}
        >
          {getStatusIcon()}
          <span className="text-xs font-medium tracking-wide">
            {COMPANION_DISPLAY_NAME}
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
