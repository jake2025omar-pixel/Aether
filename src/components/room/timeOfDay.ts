import * as THREE from 'three';

export type TimeOfDayPhase = 'night' | 'dawn' | 'fajr' | 'sunrise' | 'morning' | 'noon' | 'afternoon' | 'sunset' | 'maghrib' | 'evening';

export interface TimeOfDayProfile {
  phase: TimeOfDayPhase;
  label: string;
  skyTop: string;
  horizon: string;
  ambient: string;
  key: string;
  fill: string;
  ambientIntensity: number;
  keyIntensity: number;
  fillIntensity: number;
  sunVisible: boolean;
  starsVisible: boolean;
  cityLightsVisible: boolean;
}

const PROFILES: Record<TimeOfDayPhase, TimeOfDayProfile> = {
  night: { phase: 'night', label: 'ليل', skyTop: '#081326', horizon: '#172b43', ambient: '#182538', key: '#7388b8', fill: '#426d8a', ambientIntensity: 0.46, keyIntensity: 0.42, fillIntensity: 0.22, sunVisible: false, starsVisible: true, cityLightsVisible: true },
  dawn: { phase: 'dawn', label: 'بداية الفجر', skyTop: '#16233f', horizon: '#514e71', ambient: '#303653', key: '#998eb4', fill: '#57758a', ambientIntensity: 0.52, keyIntensity: 0.56, fillIntensity: 0.30, sunVisible: false, starsVisible: true, cityLightsVisible: true },
  fajr: { phase: 'fajr', label: 'الفجر', skyTop: '#30466a', horizon: '#927995', ambient: '#4a5269', key: '#c3a2a0', fill: '#7697ae', ambientIntensity: 0.64, keyIntensity: 0.76, fillIntensity: 0.42, sunVisible: false, starsVisible: false, cityLightsVisible: true },
  sunrise: { phase: 'sunrise', label: 'الشروق', skyTop: '#7192bd', horizon: '#f0a479', ambient: '#8a8191', key: '#ffc18c', fill: '#9bbad2', ambientIntensity: 0.82, keyIntensity: 1.20, fillIntensity: 0.64, sunVisible: true, starsVisible: false, cityLightsVisible: false },
  morning: { phase: 'morning', label: 'الصباح', skyTop: '#79b4df', horizon: '#e8d9c4', ambient: '#abbaca', key: '#ffe2bd', fill: '#93bdd2', ambientIntensity: 0.92, keyIntensity: 1.42, fillIntensity: 0.72, sunVisible: false, starsVisible: false, cityLightsVisible: false },
  noon: { phase: 'noon', label: 'الظهر', skyTop: '#69aee0', horizon: '#d9e9f0', ambient: '#c4d5df', key: '#fff0d9', fill: '#9fc8df', ambientIntensity: 1.02, keyIntensity: 1.60, fillIntensity: 0.80, sunVisible: false, starsVisible: false, cityLightsVisible: false },
  afternoon: { phase: 'afternoon', label: 'العصر', skyTop: '#638fb9', horizon: '#e3bc91', ambient: '#a1a9b7', key: '#ffd09c', fill: '#82a8bd', ambientIntensity: 0.86, keyIntensity: 1.30, fillIntensity: 0.62, sunVisible: false, starsVisible: false, cityLightsVisible: false },
  sunset: { phase: 'sunset', label: 'الغروب', skyTop: '#514b77', horizon: '#f28d70', ambient: '#6c596d', key: '#ffad81', fill: '#827794', ambientIntensity: 0.74, keyIntensity: 1.10, fillIntensity: 0.48, sunVisible: true, starsVisible: false, cityLightsVisible: false },
  maghrib: { phase: 'maghrib', label: 'المغرب', skyTop: '#292e55', horizon: '#986c79', ambient: '#42445d', key: '#c99597', fill: '#697c9b', ambientIntensity: 0.58, keyIntensity: 0.70, fillIntensity: 0.38, sunVisible: false, starsVisible: false, cityLightsVisible: true },
  evening: { phase: 'evening', label: 'العشاء', skyTop: '#121f3c', horizon: '#39425e', ambient: '#252f46', key: '#8194bd', fill: '#456a82', ambientIntensity: 0.48, keyIntensity: 0.50, fillIntensity: 0.26, sunVisible: false, starsVisible: true, cityLightsVisible: true },
};

/** Uses the device's local clock/time zone; it does not request geolocation or transmit location. */
export function getTimeOfDayProfile(date: Date): TimeOfDayProfile {
  const localHour = date.getHours() + date.getMinutes() / 60;
  if (localHour < 3) return PROFILES.night;
  if (localHour < 4) return PROFILES.dawn;
  if (localHour < 5) return PROFILES.fajr;
  if (localHour < 6.5) return PROFILES.sunrise;
  if (localHour < 10) return PROFILES.morning;
  if (localHour < 14) return PROFILES.noon;
  if (localHour < 17) return PROFILES.afternoon;
  if (localHour < 18.5) return PROFILES.sunset;
  if (localHour < 19.5) return PROFILES.maghrib;
  if (localHour < 21) return PROFILES.evening;
  return PROFILES.night;
}

export interface NeonWorld3TimeOfDayController {
  readonly timeZone: string;
  refresh: (now?: Date) => TimeOfDayPhase;
  update: (deltaSeconds: number) => void;
}

interface LightingRig {
  ambient: THREE.AmbientLight;
  key: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
}

function makeSkyMaterial(profile: TimeOfDayProfile): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(profile.skyTop) },
      horizonColor: { value: new THREE.Color(profile.horizon) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      varying vec2 vUv;
      void main() {
        float blend = smoothstep(0.02, 0.96, vUv.y);
        vec3 color = mix(horizonColor, topColor, blend);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

function addExteriorCity(group: THREE.Group, centerZ: number, lights: THREE.Mesh[]): void {
  const skyline = new THREE.Group();
  skyline.name = 'NeonWorld3_DistantCity';
  const buildingMaterial = new THREE.MeshBasicMaterial({ color: 0x17273a });
  const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xffc982, toneMapped: false, transparent: true, opacity: 0.88 });
  const widths = [0.55, 0.72, 0.42, 0.9, 0.60, 0.82, 0.48, 0.7, 0.54, 0.65];
  const heights = [1.1, 1.7, 0.9, 2.0, 1.28, 1.6, 0.82, 1.43, 1.0, 1.78];
  let z = centerZ - 5.05;
  for (let i = 0; i < widths.length; i += 1) {
    const width = widths[i];
    const height = heights[i];
    const depth = 0.42;
    const building = new THREE.Mesh(new THREE.BoxGeometry(depth, height, width), buildingMaterial);
    building.name = `CityBuilding_${i}`;
    building.position.set(-4.28, height / 2 - 0.18, z + width / 2);
    building.castShadow = false;
    building.receiveShadow = false;
    skyline.add(building);

    for (let row = 0; row < Math.max(2, Math.floor(height / 0.32)); row += 1) {
      for (const col of [-1, 1]) {
        if ((i + row + (col === 1 ? 1 : 0)) % 3 === 0) continue;
        const window = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.055, 0.04), windowMaterial.clone());
        window.name = `CityWindow_${i}_${row}_${col}`;
        window.position.set(-4.055, 0.22 + row * 0.27, z + width / 2 + col * Math.min(width * 0.22, 0.13));
        window.userData.cityWindow = true;
        lights.push(window);
        skyline.add(window);
      }
    }
    z += width + 0.12;
  }
  group.add(skyline);
}

/** Attach an exterior sky, skyline, phase lights, and a sunrise/sunset-only sun disc. */
export function attachNeonWorld3TimeOfDay(
  room: THREE.Object3D,
  scene: THREE.Scene,
  rig: LightingRig,
  now = new Date(),
): NeonWorld3TimeOfDayController {
  const initial = getTimeOfDayProfile(now);
  const exterior = new THREE.Group();
  exterior.name = 'NeonWorld3_TimeOfDayExterior';
  exterior.userData.deviceLocalTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'device-local';

  const skyMaterial = makeSkyMaterial(initial);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(12, 5.2), skyMaterial);
  sky.name = 'NeonWorld3_GradientSky';
  sky.rotation.y = Math.PI / 2;
  sky.position.set(-3.88, 2.10, -1.38);
  sky.renderOrder = -20;
  sky.frustumCulled = false;
  exterior.add(sky);

  const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffbd83, transparent: true, opacity: 0.92, toneMapped: false, side: THREE.DoubleSide });
  const sun = new THREE.Mesh(new THREE.CircleGeometry(0.42, 48), sunMaterial);
  sun.name = 'NeonWorld3_SunriseSunsetDisc';
  sun.rotation.y = Math.PI / 2;
  sun.position.set(-3.94, 2.18, -1.38);
  sun.renderOrder = -10;
  exterior.add(sun);

  const starPositions: number[] = [];
  let seed = 41;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 64; i += 1) {
    const y = 0.55 + random() * 3.2;
    const z = -1.38 - 4.7 + random() * 9.4;
    starPositions.push(-3.99, y, z);
  }
  const starsGeometry = new THREE.BufferGeometry();
  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const starsMaterial = new THREE.PointsMaterial({ color: 0xd6e6ff, size: 0.025, transparent: true, opacity: 0.82, sizeAttenuation: false, depthWrite: false });
  const stars = new THREE.Points(starsGeometry, starsMaterial);
  stars.name = 'NeonWorld3_NightStars';
  exterior.add(stars);

  const litWindows: THREE.Mesh[] = [];
  addExteriorCity(exterior, -1.38, litWindows);
  room.add(exterior);
  room.updateMatrixWorld(true);

  const currentTop = new THREE.Color(initial.skyTop);
  const currentHorizon = new THREE.Color(initial.horizon);
  const currentAmbient = new THREE.Color(initial.ambient);
  const currentKey = new THREE.Color(initial.key);
  const currentFill = new THREE.Color(initial.fill);
  const targetTop = currentTop.clone();
  const targetHorizon = currentHorizon.clone();
  const targetAmbient = currentAmbient.clone();
  const targetKey = currentKey.clone();
  const targetFill = currentFill.clone();
  let currentAmbientIntensity = initial.ambientIntensity;
  let currentKeyIntensity = initial.keyIntensity;
  let currentFillIntensity = initial.fillIntensity;
  let targetAmbientIntensity = currentAmbientIntensity;
  let targetKeyIntensity = currentKeyIntensity;
  let targetFillIntensity = currentFillIntensity;
  let targetProfile = initial;
  const backgroundColor = new THREE.Color(initial.skyTop);
  const horizonFogColor = new THREE.Color(initial.horizon);

  const applyVisibility = (profile: TimeOfDayProfile) => {
    sun.visible = profile.sunVisible;
    stars.visible = profile.starsVisible;
    for (const window of litWindows) {
      window.visible = profile.cityLightsVisible;
    }
  };
  applyVisibility(initial);

  return {
    timeZone: exterior.userData.deviceLocalTimeZone as string,
    refresh: (date = new Date()) => {
      const next = getTimeOfDayProfile(date);
      targetProfile = next;
      targetTop.set(next.skyTop);
      targetHorizon.set(next.horizon);
      targetAmbient.set(next.ambient);
      targetKey.set(next.key);
      targetFill.set(next.fill);
      targetAmbientIntensity = next.ambientIntensity;
      targetKeyIntensity = next.keyIntensity;
      targetFillIntensity = next.fillIntensity;
      applyVisibility(next);
      return next.phase;
    },
    update: (deltaSeconds: number) => {
      const alpha = 1 - Math.exp(-Math.max(0, deltaSeconds) * 0.45);
      currentTop.lerp(targetTop, alpha);
      currentHorizon.lerp(targetHorizon, alpha);
      currentAmbient.lerp(targetAmbient, alpha);
      currentKey.lerp(targetKey, alpha);
      currentFill.lerp(targetFill, alpha);
      currentAmbientIntensity = THREE.MathUtils.damp(currentAmbientIntensity, targetAmbientIntensity, 0.45, deltaSeconds);
      currentKeyIntensity = THREE.MathUtils.damp(currentKeyIntensity, targetKeyIntensity, 0.45, deltaSeconds);
      currentFillIntensity = THREE.MathUtils.damp(currentFillIntensity, targetFillIntensity, 0.45, deltaSeconds);

      skyMaterial.uniforms.topColor.value.copy(currentTop);
      skyMaterial.uniforms.horizonColor.value.copy(currentHorizon);
      backgroundColor.copy(currentTop);
      if (scene.background instanceof THREE.Color) scene.background.copy(backgroundColor);
      if (scene.fog instanceof THREE.FogExp2 || scene.fog instanceof THREE.Fog) scene.fog.color.copy(currentHorizon);
      rig.ambient.color.copy(currentAmbient);
      rig.ambient.intensity = currentAmbientIntensity;
      rig.key.color.copy(currentKey);
      rig.key.intensity = currentKeyIntensity;
      rig.fill.color.copy(currentFill);
      rig.fill.intensity = currentFillIntensity;
      rig.rim.color.copy(currentFill);
      rig.rim.intensity = currentFillIntensity * (targetProfile.phase === 'night' ? 0.72 : 1.0);
      starsMaterial.opacity = targetProfile.starsVisible ? 0.82 : 0.0;
    },
  };
}
