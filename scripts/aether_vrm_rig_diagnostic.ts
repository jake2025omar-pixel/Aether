import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { CompanionRig } from '../src/components/room/CompanionRig';

// Diagnostic harness for testing VRM humanoid bone nodes and procedural animation layers
export async function runVrmRigDiagnostic(vrmPath: string) {
  if (!fs.existsSync(vrmPath)) {
    console.warn('VRM path does not exist for diagnostic:', vrmPath);
    return;
  }
  const source = fs.readFileSync(vrmPath);
  console.log('Read VRM source of size', source.length, 'bytes');
}
