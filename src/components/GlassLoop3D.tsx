import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

class SmallInfinityCurve extends THREE.Curve<THREE.Vector3> {
  scale: number;
  constructor(scale = 1.6) {
    super();
    this.scale = scale;
  }
  getPoint(t: number, optionalTarget = new THREE.Vector3()) {
    const point = optionalTarget;
    const u = t * Math.PI * 2;
    const sinU = Math.sin(u);
    const cosU = Math.cos(u);
    const denom = 1 + sinU * sinU;
    const x = (this.scale * 1.8 * cosU) / denom;
    const y = (this.scale * 1.6 * sinU * cosU) / denom;
    const z = Math.sin(u * 2) * (this.scale * 0.45);
    return point.set(x, y, z);
  }
}

export const GlassLoop3D: React.FC<{ size?: number }> = ({ size = 120 }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.set(0, 0, 6.2);

    const path = new SmallInfinityCurve(1.5);
    const geometry = new THREE.TubeGeometry(path, 120, 0.32, 24, true);

    // Soft pastel glass material
    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#c084fc'),
      emissive: new THREE.Color('#e9d5ff'),
      emissiveIntensity: 0.2,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.88,
      ior: 1.5,
      thickness: 1.2,
      transparent: true,
      opacity: 0.9,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Soft lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0xa855f7, 15, 10);
    pointLight1.position.set(3, 3, 4);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xf472b6, 12, 10);
    pointLight2.position.set(-3, -2, 3);
    scene.add(pointLight2);

    let animationId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();
      mesh.rotation.y = time * 0.6;
      mesh.rotation.x = Math.sin(time * 0.4) * 0.3;
      mesh.rotation.z = Math.cos(time * 0.3) * 0.2;
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [size]);

  return (
    <div
      ref={mountRef}
      style={{ width: size, height: size }}
      className="pointer-events-none select-none drop-shadow-[0_15px_25px_rgba(168,85,247,0.25)] flex items-center justify-center"
    />
  );
};
