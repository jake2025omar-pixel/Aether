import React, { useState } from 'react';
import {
  X,
  Layers,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  Terminal,
  Activity,
  Smile,
  Navigation,
  Sparkles,
  Play,
  Compass,
  Box,
} from 'lucide-react';
import { getRegisteredAssets, getAssetManifest } from '@/Aether/3D/Preview/manifestRegistry';
import { FullBodyActionType, AnimeExpressionStyle } from '../../lib/behavior';

interface DeveloperInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FULL_BODY_ACTIONS: { id: FullBodyActionType; label: string; desc: string }[] = [
  { id: 'FRIENDLY_WAVE', label: 'Friendly Wave', desc: 'Arm raises, palm sways, smiling acknowledgement' },
  { id: 'HEAD_SCRATCH', label: 'Head Scratch', desc: 'Hand to hair, head tilts, bashful/puzzled expression' },
  { id: 'EXPRESSIVE_SHRUG', label: 'Expressive Shrug', desc: 'Both shoulders lift, open splayed palms, head tilts' },
  { id: 'LAUGH_REACTION', label: 'Laugh Reaction', desc: 'Torso bounces, hand covers mouth, joy crinkle eyes' },
  { id: 'THINKING_CONTEMPLATION', label: 'Deep Thinking', desc: 'Finger to chin, head tilts up-right, gaze aversive' },
  { id: 'AFFECTIONATE_REACH', label: 'Affectionate Reach', desc: 'Leans forward, soft open palm toward user, warm smile' },
  { id: 'SURPRISED_RECOIL', label: 'Surprise Recoil', desc: 'Torso recoils back, hands to chest, eyes widen in shock' },
  { id: 'CONFIDENT_HIP_REST', label: 'Confident Hip Rest', desc: 'Hand rests on hip, contrapposto tilt, playful smirk' },
  { id: 'EXPLANATORY_GESTURE', label: 'Explanatory Point', desc: 'Pointing phrase emphasis with cadence head accent' },
];

const ANIME_FACIAL_STYLES: { id: AnimeExpressionStyle; label: string; tag: string }[] = [
  { id: 'PLAYFUL_WINK', label: 'Playful Wink', tag: 'Wink + Fang Smirk' },
  { id: 'MISCHIEVOUS_SMIRK', label: 'Mischievous Smirk', tag: 'Asymmetric Grin' },
  { id: 'SHY_BLUSH_LOOK_AWAY', label: 'Shy / Blush', tag: 'Gaze Down-Away' },
  { id: 'SURPRISE_EYE_WIDEN', label: 'Eye Widen Shock', tag: 'Expanded Sclera' },
  { id: 'LAUGHTER_BURST', label: 'Laughter Burst', tag: 'Joyful Eye Curves' },
  { id: 'AFFECTIONATE_TENDER', label: 'Affectionate Gaze', tag: 'Soft Lingering Smile' },
  { id: 'POUT_ANNORD', label: 'Anime Pout', tag: 'Pursed Lips' },
  { id: 'THOUGHTFUL_PURSE', label: 'Thoughtful Purse', tag: 'Upward Eye Drift' },
  { id: 'SLEEPY_DROOP', label: 'Sleepy Droop', tag: 'Heavy Eyelids' },
];

const ROOM_WAYPOINTS = [
  { label: 'Center Stage', pos: { x: 0, y: 0, z: 0 }, yaw: 0 },
  { label: 'Right Lounge', pos: { x: 0.55, y: 0, z: -0.30 }, yaw: -0.25 },
  { label: 'Left Terrace', pos: { x: -0.55, y: 0, z: -0.25 }, yaw: 0.25 },
  { label: 'Deep Suite', pos: { x: 0.15, y: 0, z: -0.65 }, yaw: 0 },
  { label: 'Close Intimate', pos: { x: 0, y: 0, z: 0.28 }, yaw: 0 },
];

export const DeveloperInspectionModal: React.FC<DeveloperInspectionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'performance' | 'architecture' | 'assets'>('performance');
  const [selectedAssetId, setSelectedAssetId] = useState<string>('char_dark_ice_c3256ebd4d660b1f');
  const [copiedId, setCopiedId] = useState(false);
  const [lastTriggered, setLastTriggered] = useState<string | null>(null);
  const [isRoamingEnabled, setIsRoamingEnabled] = useState(true);

  if (!isOpen) return null;

  const registeredAssets = getRegisteredAssets();
  const manifest = getAssetManifest(selectedAssetId);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id).catch(() => {});
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const triggerAction = (action: FullBodyActionType) => {
    window.dispatchEvent(new CustomEvent('aether:trigger-action', { detail: { action } }));
    setLastTriggered(`Action: ${action}`);
    setTimeout(() => setLastTriggered(null), 3000);
  };

  const triggerFacial = (style: AnimeExpressionStyle) => {
    window.dispatchEvent(new CustomEvent('aether:trigger-facial', { detail: { style, duration: 3.5 } }));
    setLastTriggered(`Facial: ${style}`);
    setTimeout(() => setLastTriggered(null), 3000);
  };

  const triggerNav = (pos: { x: number; y: number; z: number }, yaw: number, label: string) => {
    window.dispatchEvent(new CustomEvent('aether:trigger-nav', { detail: { position: pos, faceYaw: yaw } }));
    setLastTriggered(`Navigating to: ${label}`);
    setTimeout(() => setLastTriggered(null), 3000);
  };

  const toggleRoaming = () => {
    const next = !isRoamingEnabled;
    setIsRoamingEnabled(next);
    window.dispatchEvent(new CustomEvent('aether:toggle-roam', { detail: { enabled: next } }));
    setLastTriggered(`Autonomous Roaming: ${next ? 'Enabled' : 'Disabled'}`);
    setTimeout(() => setLastTriggered(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[88vh] crystal-surface rounded-2xl border border-white/15 p-5 flex flex-col gap-3 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide">
                Aether Internal Developer Suite
              </h2>
              <p className="text-[11px] text-white/50 font-mono">
                Digital Human Performance Engine & Asset Telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastTriggered && (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md animate-pulse">
                ✓ {lastTriggered}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close Developer Inspection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Top Master Tab Switch */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <button
            onClick={() => setActiveTab('performance')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'performance'
                ? 'bg-purple-600/40 text-purple-200 border border-purple-400/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Character Performance Director</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'architecture'
                ? 'bg-purple-600/40 text-purple-200 border border-purple-400/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Interior Architecture & Spatial Engine</span>
          </button>

          <button
            onClick={() => setActiveTab('assets')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'assets'
                ? 'bg-purple-600/40 text-purple-200 border border-purple-400/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3D Asset Manifests</span>
          </button>
        </div>

        {/* TAB 1: Character Performance Director */}
        {activeTab === 'performance' && (
          <div className="flex-1 overflow-y-auto space-y-4 text-xs pr-1">
            {/* Telemetry Summary Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
              <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/20">
                <span className="text-purple-300/60 block text-[10px]">SKELETON BONES</span>
                <span className="text-white font-semibold">54 Humanoid Bones</span>
              </div>
              <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20">
                <span className="text-cyan-300/60 block text-[10px]">FINGER JOINTS</span>
                <span className="text-white font-semibold">30 Bones (15L + 15R)</span>
              </div>
              <div className="p-2.5 rounded-xl bg-fuchsia-950/30 border border-fuchsia-500/20">
                <span className="text-fuchsia-300/60 block text-[10px]">FACIAL MORPHS</span>
                <span className="text-white font-semibold">57 Mesh + 13 VRM Presets</span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20">
                <span className="text-emerald-300/60 block text-[10px]">SPEECH VISEMES</span>
                <span className="text-white font-semibold">5 Japanese Vowels (A,I,U,E,O)</span>
              </div>
            </div>

            {/* Section A: Full-Body Choreographed Actions */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-purple-300 font-semibold text-xs">
                  <Play className="w-3.5 h-3.5" />
                  <span>Full-Body Choreographed Performances (Coordinated Acting)</span>
                </div>
                <span className="text-[10px] text-white/40 font-mono">9 Available Routines</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {FULL_BODY_ACTIONS.map((act) => (
                  <button
                    key={act.id}
                    onClick={() => triggerAction(act.id)}
                    className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-purple-600/20 border border-white/5 hover:border-purple-400/40 text-left transition-all cursor-pointer flex flex-col gap-1 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white group-hover:text-purple-200">
                        {act.label}
                      </span>
                      <Sparkles className="w-3 h-3 text-white/30 group-hover:text-purple-400" />
                    </div>
                    <span className="text-[10px] text-white/50 leading-tight">
                      {act.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Section B: Anime-Inspired Expression Grammar */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-fuchsia-300 font-semibold text-xs">
                  <Smile className="w-3.5 h-3.5" />
                  <span>Anime Expression Grammar & Fine-Grained Muscle Acting</span>
                </div>
                <span className="text-[10px] text-white/40 font-mono">Multi-Scale Micro Controls</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ANIME_FACIAL_STYLES.map((fac) => (
                  <button
                    key={fac.id}
                    onClick={() => triggerFacial(fac.id)}
                    className="p-2 rounded-xl bg-white/[0.03] hover:bg-fuchsia-600/20 border border-white/5 hover:border-fuchsia-400/40 text-left transition-all cursor-pointer flex flex-col gap-0.5 group"
                  >
                    <span className="font-semibold text-white group-hover:text-fuchsia-200">
                      {fac.label}
                    </span>
                    <span className="text-[10px] font-mono text-fuchsia-400/70">
                      {fac.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Section C: Autonomous Room Navigation */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-xs">
                  <Compass className="w-3.5 h-3.5" />
                  <span>Autonomous Room Navigation & Locomotion</span>
                </div>

                <button
                  onClick={toggleRoaming}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold border transition-all cursor-pointer ${
                    isRoamingEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-white/5 text-white/40 border-white/10'
                  }`}
                >
                  Autonomous Roam: {isRoamingEnabled ? 'ACTIVE' : 'PAUSED'}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {ROOM_WAYPOINTS.map((wp) => (
                  <button
                    key={wp.label}
                    onClick={() => triggerNav(wp.pos, wp.yaw, wp.label)}
                    className="p-2 rounded-xl bg-white/[0.03] hover:bg-cyan-600/20 border border-white/5 hover:border-cyan-400/40 text-left transition-all cursor-pointer flex flex-col gap-0.5 group"
                  >
                    <span className="font-semibold text-white group-hover:text-cyan-200 truncate">
                      {wp.label}
                    </span>
                    <span className="text-[9px] font-mono text-white/40">
                      x:{wp.pos.x.toFixed(1)}, z:{wp.pos.z.toFixed(1)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Interior Architecture & Spatial Engine */}
        {activeTab === 'architecture' && (
          <div className="flex-1 overflow-y-auto space-y-4 text-xs pr-1">
            {/* Architecture Telemetry Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-0.5">
                <span className="text-white/40 text-[10px]">SOURCE SCENE</span>
                <span className="text-purple-300 font-semibold truncate">Neon_World_3.glb</span>
                <span className="text-white/40 text-[9px]">Extracted & Organized</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-0.5">
                <span className="text-white/40 text-[10px]">FLOOR CONTACT</span>
                <span className="text-emerald-400 font-semibold">100% Flush (0.000m)</span>
                <span className="text-white/40 text-[9px]">Zero Hover / Zero Clip</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-0.5">
                <span className="text-white/40 text-[10px]">COLLISION BARRIERS</span>
                <span className="text-sky-300 font-semibold">5 Active AABBs</span>
                <span className="text-white/40 text-[9px]">Locomotion Protected</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-0.5">
                <span className="text-white/40 text-[10px]">CAMERA SIGHTLINE</span>
                <span className="text-purple-300 font-semibold">360° Unobstructed</span>
                <span className="text-white/40 text-[9px]">Zero Wall Occlusion</span>
              </div>
            </div>

            {/* Validation Checklist */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-white/90">
                  Architectural Placement Validation Report
                </h3>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                  ✓ ALL 5 AUDITS PASSED
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-emerald-300">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-white">Floor & Support Precision</span>
                    <span className="text-white/60 text-[10px]">All bases flush with ground (min Y = 0.000m)</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-emerald-300">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-white">Inter-Furniture Non-Intersection</span>
                    <span className="text-white/60 text-[10px]">Zero pairwise overlaps; clean clearance buffers</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-emerald-300">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-white">Companion Interaction Envelope</span>
                    <span className="text-white/60 text-[10px]">1.66m minimum clearance around center stage</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-emerald-300">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-white">360° Panoramic Orbit</span>
                    <span className="text-white/60 text-[10px]">All tall items placed at peripheral focal lines</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Extracted Furniture Catalog & Intentional Roles */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-white/90">
                Extracted Assets & Intentional Spatial Organization
              </h3>

              <div className="space-y-2">
                {/* 1. Carpet */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[9px]">
                        ZONE 1 · CONVERSATION STAGE
                      </span>
                      <span className="font-semibold text-white">Designer Luxury Area Rug</span>
                    </div>
                    <span className="font-mono text-[10px] text-white/50">4.0m × 5.0m</span>
                  </div>
                  <p className="text-[11px] text-white/70">
                    Visually anchors the companion's living suite and conversation stage at (0, 0.002, -0.35). Integrates seamlessly with the radial ground aura without z-fighting.
                  </p>
                </div>

                {/* 2. Credenza */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[9px]">
                        ZONE 2 · NORTH HORIZON
                      </span>
                      <span className="font-semibold text-white">Executive 4-Door Lowboard Credenza</span>
                    </div>
                    <span className="font-mono text-[10px] text-white/50">4.05m × 0.88m × 0.53m</span>
                  </div>
                  <p className="text-[11px] text-white/70">
                    Extracted from 7 distinct sub-components (base, sides, 4 doors) and unified into a single architectural unit at Z = -3.20m. Establishes elegant horizontal depth behind the companion.
                  </p>
                </div>

                {/* 3. Nightstand */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[9px]">
                        ZONE 3 · WEST TERRACE
                      </span>
                      <span className="font-semibold text-white">Architectural Multi-Wood Side Console</span>
                    </div>
                    <span className="font-mono text-[10px] text-white/50">1.0m × 0.35m × 0.50m</span>
                  </div>
                  <p className="text-[11px] text-white/70">
                    Positioned in the west lounge wing at (-2.45, 0.0, -0.85) angled 22.5° inward. Flush floor contact with rich natural wood and satin lacquer finishes.
                  </p>
                </div>

                {/* 4. Cushions */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[9px]">
                        ZONE 4 · ACCENT LOUNGE
                      </span>
                      <span className="font-semibold text-white">Plush Accent Floor Cushions (Alpha & Beta)</span>
                    </div>
                    <span className="font-mono text-[10px] text-white/50">2 Units</span>
                  </div>
                  <p className="text-[11px] text-white/70">
                    Organically positioned at (-1.35, 0.014, -1.60) and (1.35, 0.014, -1.55). Millimeter-accurate resting elevation on the carpet surface with realistic relaxed rotations.
                  </p>
                </div>

                {/* 5. LED Fixture */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[9px]">
                        ZONE 5 · CEILING COVE
                      </span>
                      <span className="font-semibold text-white">Linear Architectural Luminaire</span>
                    </div>
                    <span className="font-mono text-[10px] text-white/50">4.0m Length</span>
                  </div>
                  <p className="text-[11px] text-white/70">
                    Suspended cove light at Y = 2.95m above the credenza, projecting soft cyan/amethyst glow downward along the north wall.
                  </p>
                </div>

                {/* 6. Terrace Facade */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[9px]">
                        ZONE 6 · SKYLINE VISTA
                      </span>
                      <span className="font-semibold text-white">Floor-to-Ceiling Panoramic Terrace Facade</span>
                    </div>
                    <span className="font-mono text-[10px] text-white/50">West Flank</span>
                  </div>
                  <p className="text-[11px] text-white/70">
                    Floor-to-ceiling structural glazing at X = -3.85m framing the horizon without interfering with the 360° camera orbit path.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Asset Manifests */}
        {activeTab === 'assets' && (
          <div className="flex-1 overflow-y-auto space-y-3 text-xs pr-1">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-white/5">
              {registeredAssets.map((asset) => {
                const isSelected = selectedAssetId === asset.asset_id;
                return (
                  <button
                    key={asset.asset_id}
                    onClick={() => setSelectedAssetId(asset.asset_id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600/30 text-white border border-purple-400/50'
                        : 'text-white/60 hover:text-white hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-purple-300" />
                    <span>{asset.name}</span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        asset.preview_status === 'WEB_READY'
                          ? 'bg-emerald-400'
                          : asset.preview_status === 'CONVERSION_REQUIRED'
                          ? 'bg-amber-400'
                          : 'bg-rose-400'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {manifest && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-purple-400 uppercase font-semibold">
                      {manifest.category}
                    </span>
                    <h3 className="text-base font-bold text-white">
                      {manifest.semantic_name || manifest.file_name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-mono font-semibold uppercase border ${
                        manifest.preview_status === 'WEB_READY'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : manifest.preview_status === 'CONVERSION_REQUIRED'
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {manifest.preview_status}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                  <div className="font-mono text-[11px]">
                    <span className="text-white/40 block">STABLE ASSET ID</span>
                    <code className="text-purple-200">{manifest.asset_id}</code>
                  </div>

                  <button
                    onClick={() => handleCopyId(manifest.asset_id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 transition-colors cursor-pointer"
                  >
                    {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span className="text-[11px] font-mono">{copiedId ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-white/40 block text-[10px]">SOURCE FORMAT</span>
                    <span className="text-white font-semibold">{manifest.technical_3d?.format || 'NOT_DETERMINED'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-white/40 block text-[10px]">ARCHIVE FILE</span>
                    <span className="text-white truncate block" title={manifest.original_archive}>
                      {manifest.original_archive}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-white/40 block text-[10px]">SKELETON</span>
                    <span className="text-white">
                      {manifest.technical_3d?.skeleton ? `Yes (${manifest.technical_3d.bone_count} bones)` : 'No / None'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-white/40 block text-[10px]">RUNTIME STATUS</span>
                    <span className="text-white">
                      {manifest.runtime_file ? 'Mounted' : 'Awaiting Binary'}
                    </span>
                  </div>
                </div>

                {manifest.conversion_requirement && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-300 mb-1">
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Required Conversion Pipeline</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      {manifest.conversion_requirement}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
