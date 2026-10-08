import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CompanionRig } from './CompanionRig';
import { CompanionState, CompanionEmotion, COMPANION_DISPLAY_NAME } from '../../lib/companionPersonality';
import { dispose3DResource, loadWeb3DAsset } from '@/Aether/3D/Preview/AssetPreviewLoader';
import { Mic, Volume2, Sparkles, Brain } from 'lucide-react';

export interface RoomEnvironment3DProps {
  companionState: CompanionState;
  companionEmotion: CompanionEmotion;
  visemeMouthOpen: number;
  companionModelUrl?: string | null;
  roomModelUrl?: string | null;
  onCompanionClick?: () => void;
  className?: string;
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
  const targetLookPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.45, 3.4));

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
    scene.fog = new THREE.FogExp2(BG_COLOR, 0.05);

    // 2. Camera setup - room-scale framing. The imported Neon room is about
    // 7.5m wide x 9.4m deep, so a 3.4m portrait distance only showed a tiny
    // corner. Keep the asset at its authored scale and frame the room instead.
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);
    camera.position.set(0, 1.45, 3.4);
    camera.lookAt(0, 1.7, 0);
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

    container.appendChild(renderer.domElement);
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // 4. Lighting Rig (Soft Amethyst Studio & Warm Key)
    const ambientLight = new THREE.AmbientLight(0x281545, 1.35);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff5eb, 1.9);
    keyLight.position.set(1.8, 3.8, 3.0);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.25);
    fillLight.position.set(-2.8, 2.2, 2.0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xc084fc, 2.2);
    rimLight.position.set(0, 3.2, -2.8);
    scene.add(rimLight);

    const floorGlow = new THREE.PointLight(0xa855f7, 2.2, 8);
    floorGlow.position.set(0, 0.35, 0);
    floorGlowRef.current = floorGlow;
    scene.add(floorGlow);

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

    // Ethereal radial ground aura directly under the companion
    const auraTexture = createRadialGlowTexture();
    const auraGeo = new THREE.PlaneGeometry(5.2, 5.2);
    const auraMat = new THREE.MeshBasicMaterial({
      map: auraTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const auraMesh = new THREE.Mesh(auraGeo, auraMat);
    auraMesh.rotation.x = -Math.PI / 2;
    auraMesh.position.set(0, 0.003, 0);
    roomGroup.add(auraMesh);

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

    // 6. Real room conversion fallback handler
    let isCancelled = false;
    const roomLoadController = new AbortController();
    const companionLoadController = new AbortController();
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
        res.scene.traverse((object) => {
          if (!(object as THREE.Mesh).isMesh) return;
          const mesh = object as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of materials) {
            material.side = THREE.DoubleSide;
            if (material.name.toLowerCase().includes('led') && material instanceof THREE.MeshStandardMaterial) {
              material.emissive.set(0x22d3ee);
              material.emissiveIntensity = Math.max(material.emissiveIntensity, 1.4);
            }
            material.needsUpdate = true;
          }
        });
        scene.remove(roomGroup);
        dispose3DResource(roomGroup);
        res.scene.name = 'NeonWorld3Runtime';
        // Keep the exported room aligned with the camera without changing its original lighting or props.
        res.scene.rotation.y = Math.PI;
        // Correct only the exported pillow offsets so they rest on the supplied bed base.
        const pillowPlacements: Array<[string, number, number, number]> = [
          ['SimplePillow1_Root', -1.25, 1.16, 4.2],
          ['SimplePillow2_Root', -0.25, 1.16, 4.2],
        ];
        for (const [name, x, y, z] of pillowPlacements) {
          const pillowRoot = res.scene.getObjectByName(name);
          if (pillowRoot) pillowRoot.position.set(x, y, z);
        }
        res.scene.updateMatrixWorld(true);
        // Fit the complete imported room, not just the companion. This prevents
        // the GLB from appearing as a floor fragment in one distant corner.
        const roomBounds = new THREE.Box3().setFromObject(res.scene);
        const roomSize = roomBounds.getSize(new THREE.Vector3());
        const roomCenter = roomBounds.getCenter(new THREE.Vector3());
        const verticalFov = THREE.MathUtils.degToRad(camera.fov);
        // Stay inside the authored room. Fitting its exterior bounds would put
        // the camera outside the front wall, hiding the companion and furniture.
        const fitDistance = (Math.max(roomSize.x, roomSize.y, roomSize.z) * 0.15) / Math.tan(verticalFov / 2);
        targetCamDist = THREE.MathUtils.clamp(fitDistance, 3.2, 3.8);
        currentCamDist = targetCamDist;
        // Keep the companion at eye/chest level; the room's geometric center is
        // higher because it includes the ceiling and would aim above her head.
        targetRoomFocus.copy(new THREE.Vector3(0, 1.08, 0));
        scene.add(res.scene);

        // Preserve the imported room's textures while restoring a subdued neon-night mood.
        ambientLight.color.setHex(0x211941);
        ambientLight.intensity = 0.95;
        keyLight.intensity = 1.65;
        fillLight.intensity = 1.35;
        rimLight.intensity = 2.1;
        floorGlow.color.setHex(0x8b5cf6);
        renderer.toneMappingExposure = 1.0;

        const cyanBounce = new THREE.PointLight(0x22d3ee, 2.6, 8, 2);
        cyanBounce.position.set(-2.8, 1.65, -1.4);
        const violetBounce = new THREE.PointLight(0xa855f7, 2.4, 8, 2);
        violetBounce.position.set(2.8, 1.55, -1.2);
        scene.add(cyanBounce, violetBounce);
      }).catch((err: unknown) => {
        if (!isCancelled) console.warn('[Room3D] Neon room load exception, keeping procedural room:', err);
      });
    }

    // 7. Mount Companion Rig & Enhance VRM Textures
    const mountFallbackRig = () => {
      if (isCancelled || companionRigRef.current) return;
      const rig = new CompanionRig(null);
      companionRigRef.current = rig;
      scene.add(rig.root);
      rig.setEmotion(emotionRef.current);
      rig.setViseme(visemeRef.current);
      rig.setState(stateRef.current);
      rig.setMotionEnabled(motionEnabledRef.current);
    }

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

    // 8. Interactive 360° room camera. Drag horizontally to orbit around the
    // room; drag vertically to tilt. Pinch and wheel remain zoom controls.
    const MIN_DISTANCE = 2.2;
    const MAX_DISTANCE = 6.0;
    let currentCamDist = 3.4;
    let targetCamDist = 3.4;
    let orbitYaw = 0.18;
    let orbitPitch = 0.10;
    let targetRoomFocus = new THREE.Vector3(0, 1.7, 0);
    let isOrbiting = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;

    // Touch gesture tracking (1 finger = orbit, 2 fingers = smooth pinch-to-zoom)
    let isPinching = false;
    let initialPinchDist = 0;
    let pinchStartCamDist = 3.4;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        isPinching = true;
        initialPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        pinchStartCamDist = targetCamDist;
      } else if (e.touches.length === 1) {
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinching && initialPinchDist > 0) {
        // Prevent default document scaling so 3D camera dollies in/out instead of stretching canvas bitmap
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scaleFactor = initialPinchDist / Math.max(dist, 10);
        targetCamDist = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, pinchStartCamDist * scaleFactor));
      } else if (e.touches.length === 1 && !isPinching) {
        e.preventDefault();
        const t = e.touches[0];
        orbitYaw -= (t.clientX - lastTouchX) * 0.008;
        orbitPitch = THREE.MathUtils.clamp(orbitPitch + (t.clientY - lastTouchY) * 0.005, -0.45, 0.45);
        lastTouchX = t.clientX;
        lastTouchY = t.clientY;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        isPinching = false;
      }
    };

    // Desktop Mouse Wheel Zoom
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetCamDist = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, targetCamDist + e.deltaY * 0.003));
    };

    const handlePointerDown = (e: PointerEvent) => {
      isOrbiting = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      container.setPointerCapture?.(e.pointerId);
    };
    const handlePointerMove = (e: PointerEvent) => {
      if (!isOrbiting || e.pointerType === 'touch') return;
      orbitYaw -= (e.clientX - lastPointerX) * 0.008;
      orbitPitch = THREE.MathUtils.clamp(orbitPitch + (e.clientY - lastPointerY) * 0.005, -0.45, 0.45);
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    };
    const handlePointerUp = () => {
      isOrbiting = false;
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
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Smooth room-scale orbit and dolly physics
      currentCamDist = THREE.MathUtils.lerp(currentCamDist, targetCamDist, 0.08);
      camera.position.x = targetRoomFocus.x + Math.sin(orbitYaw) * currentCamDist;
      camera.position.y = targetRoomFocus.y + Math.sin(orbitPitch) * currentCamDist;
      camera.position.z = targetRoomFocus.z + Math.cos(orbitYaw) * currentCamDist;
      camera.lookAt(targetRoomFocus);

      targetLookPosRef.current.copy(camera.position);

      // Update Companion Rig (Idle Breathing, Blinking, Visemes, Look-At)
      if (companionRigRef.current) {
        companionRigRef.current.update(delta, elapsed, targetLookPosRef.current);
      }

      // Atmospheric floor light pulse
      const motionEnabled = motionEnabledRef.current;
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
