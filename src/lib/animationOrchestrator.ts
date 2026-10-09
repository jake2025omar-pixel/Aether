/**
 * Aether animation orchestration layer.
 *
 * This module is deliberately renderer/rig agnostic. A character adapter only
 * needs to consume the semantic pose returned by AnimationOrchestrator.update().
 * New avatars can therefore reuse the scheduler without sharing bones, clips,
 * blend-shape names, or renderer-specific implementation details.
 */

export type AnimationLifecycle =
  | 'REQUESTED'
  | 'VALIDATED'
  | 'QUEUED'
  | 'STARTING'
  | 'PLAYING'
  | 'COMPLETING'
  | 'BLENDING_OUT'
  | 'FINISHED'
  | 'NEXT_ACTION';

export type AnimationState =
  | 'INITIALIZING'
  | 'NEUTRAL_IDLE'
  | 'ACTIVE_IDLE'
  | 'WAITING_FOR_USER'
  | 'LISTENING'
  | 'THINKING'
  | 'PREPARING_RESPONSE'
  | 'EMOTIONAL_REACTION'
  | 'SPEAKING'
  | 'FINISHING_GESTURE'
  | 'BLENDING_TO_NEXT_ACTION'
  | 'TECHNICAL_ERROR'
  | 'RECOVERING'
  | 'SAFE_FALLBACK';

export type AnimationEventType =
  | 'USER_MESSAGE_RECEIVED'
  | 'VOICE_INPUT'
  | 'RESPONSE_RECEIVED'
  | 'SPEECH_STARTED'
  | 'SPEECH_ENDED'
  | 'REQUEST_PENDING'
  | 'REQUEST_TIMEOUT'
  | 'CONNECTION_LOST'
  | 'SERVER_ERROR'
  | 'EMPTY_OR_INVALID_RESPONSE'
  | 'RESPONSE_CANCELLED'
  | 'RETRYING'
  | 'RECOVERED'
  | 'FINAL_FAILURE'
  | 'EMOTION_CHANGED'
  | 'RESET';

export type InterruptPolicy =
  | 'FINISH_NATURALLY'
  | 'ACCELERATE_TO_COMPLETION'
  | 'BLEND_TO_LISTENING'
  | 'QUEUE_NEXT_ACTION'
  | 'TRANSITION_TO_SPEAKING'
  | 'RECOVER_TO_SAFE_POSE';

export interface SemanticMotionProfile {
  key: string;
  facialExpression: string;
  gaze: { x: number; y: number; openness: number };
  blinkRate: number;
  head: { x: number; y: number; z: number };
  torso: { lean: number; shoulderLift: number };
  arms: { left: number; right: number };
  breathing: number;
  amplitude: number;
  duration: number;
  transitionIn: number;
  transitionOut: number;
  compatibleLayers: string[];
  interruptPolicy: InterruptPolicy;
  priority: number;
  nextState: AnimationState;
  fallbackState: AnimationState;
}

export interface AnimationEvent {
  type: AnimationEventType;
  emotion?: string;
  intensity?: number;
  messageId?: string;
  timestamp?: number;
}

export interface AnimationSnapshot {
  lifecycle: AnimationLifecycle;
  state: AnimationState;
  action: string;
  progress: number;
  emotion: string;
  intensity: number;
  pendingEventCount: number;
  interruptedAction: string | null;
}

export interface SemanticAnimationFrame {
  state: AnimationState;
  lifecycle: AnimationLifecycle;
  action: string;
  progress: number;
  breathing: number;
  head: { x: number; y: number; z: number };
  torso: { lean: number; shoulderLift: number };
  arms: { left: number; right: number };
  gaze: { x: number; y: number; openness: number };
  facialExpression: string;
  facialIntensity: number;
  interruptedAction: string | null;
  safeFallback: boolean;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => t * t * (3 - 2 * t);

const profile = (
  key: string,
  values: Partial<SemanticMotionProfile> & Pick<SemanticMotionProfile, 'facialExpression'>,
): SemanticMotionProfile => ({
  key,
  facialExpression: values.facialExpression,
  gaze: values.gaze || { x: 0, y: 0, openness: 1 },
  blinkRate: values.blinkRate ?? 1,
  head: values.head || { x: 0, y: 0, z: 0 },
  torso: values.torso || { lean: 0, shoulderLift: 0 },
  arms: values.arms || { left: 0, right: 0 },
  breathing: values.breathing ?? 1,
  amplitude: values.amplitude ?? 1,
  duration: values.duration ?? 0.8,
  transitionIn: values.transitionIn ?? 0.18,
  transitionOut: values.transitionOut ?? 0.22,
  compatibleLayers: values.compatibleLayers || ['breathing', 'gaze', 'facial'],
  interruptPolicy: values.interruptPolicy || 'BLEND_TO_LISTENING',
  priority: values.priority ?? 50,
  nextState: values.nextState || 'WAITING_FOR_USER',
  fallbackState: values.fallbackState || 'SAFE_FALLBACK',
});

/** Semantic library: no avatar-specific bone or blend-shape identifiers. */
export const DEFAULT_MOTION_PROFILES: Readonly<Record<string, SemanticMotionProfile>> = {
  neutral: profile('neutral', { facialExpression: 'neutral', breathing: 1, duration: 0.5, interruptPolicy: 'FINISH_NATURALLY', nextState: 'NEUTRAL_IDLE' }),
  happy: profile('happy', { facialExpression: 'happy', head: { x: -0.015, y: 0.02, z: 0 }, torso: { lean: 0.015, shoulderLift: 0.008 }, arms: { left: -0.025, right: 0.055 }, amplitude: 0.75, duration: 0.9 }),
  excited: profile('excited', { facialExpression: 'happy', head: { x: -0.02, y: 0.035, z: 0 }, torso: { lean: 0.035, shoulderLift: 0.018 }, arms: { left: -0.05, right: 0.1 }, amplitude: 1, duration: 1.05 }),
  amused: profile('amused', { facialExpression: 'happy', head: { x: -0.04, y: 0.015, z: -0.025 }, torso: { lean: 0.02, shoulderLift: 0.012 }, arms: { left: -0.02, right: 0.035 }, amplitude: 0.62, duration: 0.75 }),
  playful: profile('playful', { facialExpression: 'happy', head: { x: -0.04, y: 0.04, z: -0.06 }, torso: { lean: 0.02, shoulderLift: 0.01 }, arms: { left: -0.04, right: 0.07 }, amplitude: 0.72, duration: 0.9 }),
  affectionate: profile('affectionate', { facialExpression: 'happy', head: { x: 0.02, y: 0, z: 0.045 }, torso: { lean: 0.025, shoulderLift: 0 }, arms: { left: -0.02, right: 0.035 }, amplitude: 0.5, duration: 0.95 }),
  relieved: profile('relieved', { facialExpression: 'relaxed', head: { x: 0.025, y: 0, z: 0 }, torso: { lean: 0.02, shoulderLift: -0.02 }, arms: { left: -0.01, right: 0.02 }, breathing: 1.2, amplitude: 0.5, duration: 1.1 }),
  proud: profile('proud', { facialExpression: 'happy', head: { x: -0.015, y: 0, z: 0 }, torso: { lean: -0.025, shoulderLift: 0.02 }, arms: { left: -0.015, right: 0.03 }, amplitude: 0.62, duration: 0.85 }),
  curious: profile('curious', { facialExpression: 'surprised', gaze: { x: 0.12, y: 0.02, openness: 1 }, head: { x: -0.035, y: 0.025, z: -0.08 }, torso: { lean: 0.015, shoulderLift: 0 }, arms: { left: -0.015, right: 0.02 }, amplitude: 0.58, duration: 0.85 }),
  grateful: profile('grateful', { facialExpression: 'happy', head: { x: 0.035, y: 0, z: 0.025 }, torso: { lean: 0.035, shoulderLift: -0.008 }, arms: { left: -0.035, right: 0.035 }, amplitude: 0.54, duration: 0.9 }),
  comforting: profile('comforting', { facialExpression: 'relaxed', head: { x: 0.02, y: 0, z: 0.025 }, torso: { lean: 0.025, shoulderLift: 0 }, arms: { left: -0.04, right: 0.04 }, amplitude: 0.42, duration: 0.9 }),
  confident: profile('confident', { facialExpression: 'happy', head: { x: -0.01, y: 0, z: 0 }, torso: { lean: -0.02, shoulderLift: 0.015 }, arms: { left: -0.02, right: 0.045 }, amplitude: 0.65, duration: 0.8 }),
  calm: profile('calm', { facialExpression: 'relaxed', breathing: 0.75, amplitude: 0.28, duration: 0.7, interruptPolicy: 'FINISH_NATURALLY', nextState: 'WAITING_FOR_USER' }),
  shy: profile('shy', { facialExpression: 'happy', gaze: { x: -0.06, y: -0.08, openness: 0.92 }, head: { x: 0.035, y: -0.035, z: 0.07 }, torso: { lean: 0.02, shoulderLift: 0.012 }, arms: { left: -0.025, right: 0.025 }, amplitude: 0.45, duration: 1.0 }),
  embarrassed: profile('embarrassed', { facialExpression: 'happy', gaze: { x: 0.04, y: -0.1, openness: 0.86 }, head: { x: 0.055, y: -0.025, z: 0.05 }, torso: { lean: 0.03, shoulderLift: 0.018 }, arms: { left: -0.02, right: 0.02 }, amplitude: 0.42, duration: 1.0 }),
  flustered: profile('flustered', { facialExpression: 'surprised', gaze: { x: -0.05, y: -0.04, openness: 0.9 }, head: { x: 0.02, y: 0.03, z: -0.04 }, torso: { lean: 0.02, shoulderLift: 0.025 }, arms: { left: -0.04, right: 0.06 }, amplitude: 0.72, duration: 0.8 }),
  thoughtful: profile('thoughtful', { facialExpression: 'relaxed', gaze: { x: -0.1, y: 0.04, openness: 0.96 }, head: { x: -0.045, y: -0.06, z: -0.035 }, torso: { lean: -0.012, shoulderLift: 0 }, arms: { left: -0.015, right: 0.01 }, amplitude: 0.42, duration: 1.15 }),
  surprised: profile('surprised', { facialExpression: 'surprised', gaze: { x: 0, y: 0.02, openness: 1.05 }, head: { x: -0.025, y: 0, z: 0 }, torso: { lean: -0.025, shoulderLift: 0.025 }, arms: { left: -0.045, right: 0.07 }, amplitude: 0.85, duration: 0.68 }),
  nervous: profile('nervous', { facialExpression: 'surprised', gaze: { x: 0.04, y: -0.025, openness: 0.92 }, head: { x: 0.01, y: -0.02, z: 0.03 }, torso: { lean: 0.01, shoulderLift: 0.02 }, arms: { left: -0.02, right: 0.035 }, breathing: 1.25, amplitude: 0.48, duration: 0.9 }),
  uncertain: profile('uncertain', { facialExpression: 'surprised', gaze: { x: -0.06, y: 0, openness: 0.96 }, head: { x: -0.025, y: 0.02, z: -0.045 }, torso: { lean: 0.01, shoulderLift: 0.008 }, arms: { left: -0.02, right: 0.02 }, amplitude: 0.42, duration: 0.85 }),
  sleepy: profile('sleepy', { facialExpression: 'sad', gaze: { x: 0, y: -0.06, openness: 0.72 }, head: { x: 0.045, y: 0, z: 0.02 }, torso: { lean: 0.035, shoulderLift: -0.015 }, arms: { left: -0.01, right: 0.01 }, breathing: 0.7, amplitude: 0.28, duration: 1.25 }),
  sad: profile('sad', { facialExpression: 'sad', gaze: { x: 0, y: -0.08, openness: 0.9 }, head: { x: 0.06, y: 0, z: 0.015 }, torso: { lean: 0.03, shoulderLift: -0.015 }, arms: { left: -0.02, right: 0.02 }, breathing: 0.86, amplitude: 0.48, duration: 1.0 }),
  disappointed: profile('disappointed', { facialExpression: 'sad', gaze: { x: 0.03, y: -0.07, openness: 0.88 }, head: { x: 0.04, y: -0.02, z: 0 }, torso: { lean: 0.025, shoulderLift: -0.018 }, arms: { left: -0.015, right: 0.012 }, amplitude: 0.45, duration: 0.95 }),
  hurt: profile('hurt', { facialExpression: 'sad', gaze: { x: -0.04, y: -0.075, openness: 0.86 }, head: { x: 0.055, y: -0.025, z: 0.025 }, torso: { lean: 0.045, shoulderLift: -0.025 }, arms: { left: -0.025, right: 0.025 }, amplitude: 0.52, duration: 1.05 }),
  worried: profile('worried', { facialExpression: 'sad', gaze: { x: 0.02, y: -0.02, openness: 0.93 }, head: { x: 0.02, y: -0.02, z: 0.04 }, torso: { lean: 0.018, shoulderLift: 0.016 }, arms: { left: -0.02, right: 0.03 }, breathing: 1.1, amplitude: 0.5, duration: 0.95 }),
  confused: profile('confused', { facialExpression: 'surprised', gaze: { x: -0.08, y: 0, openness: 0.96 }, head: { x: -0.02, y: 0.035, z: -0.09 }, torso: { lean: 0.012, shoulderLift: 0.01 }, arms: { left: -0.02, right: 0.055 }, amplitude: 0.56, duration: 0.9 }),
  frustrated: profile('frustrated', { facialExpression: 'angry', head: { x: 0.015, y: 0, z: -0.02 }, torso: { lean: 0.01, shoulderLift: 0.018 }, arms: { left: -0.025, right: 0.045 }, amplitude: 0.62, duration: 0.85 }),
  annoyed: profile('annoyed', { facialExpression: 'angry', head: { x: 0.01, y: 0.02, z: -0.04 }, torso: { lean: 0.012, shoulderLift: 0.012 }, arms: { left: -0.018, right: 0.035 }, amplitude: 0.5, duration: 0.8 }),
  angry: profile('angry', { facialExpression: 'angry', gaze: { x: 0, y: 0.01, openness: 0.96 }, head: { x: -0.01, y: 0, z: -0.02 }, torso: { lean: -0.015, shoulderLift: 0.025 }, arms: { left: -0.04, right: 0.07 }, breathing: 1.2, amplitude: 0.82, duration: 0.9 }),
  withdrawn: profile('withdrawn', { facialExpression: 'sad', gaze: { x: 0.1, y: -0.06, openness: 0.84 }, head: { x: 0.055, y: 0.025, z: 0.035 }, torso: { lean: 0.055, shoulderLift: -0.01 }, arms: { left: -0.01, right: 0.01 }, amplitude: 0.35, duration: 1.2 }),
  concerned: profile('concerned', { facialExpression: 'sad', gaze: { x: 0.02, y: -0.02, openness: 0.92 }, head: { x: 0.025, y: 0.01, z: 0.045 }, torso: { lean: 0.02, shoulderLift: 0.014 }, arms: { left: -0.02, right: 0.035 }, amplitude: 0.48, duration: 0.9 }),
  listening: profile('listening', { facialExpression: 'relaxed', head: { x: 0, y: 0, z: 0.045 }, torso: { lean: 0.018, shoulderLift: 0 }, arms: { left: -0.012, right: 0.022 }, amplitude: 0.25, duration: 0.6, interruptPolicy: 'FINISH_NATURALLY', nextState: 'LISTENING' }),
  waiting: profile('waiting', { facialExpression: 'relaxed', gaze: { x: 0, y: 0, openness: 1 }, head: { x: 0, y: 0, z: 0.02 }, torso: { lean: 0.01, shoulderLift: 0 }, arms: { left: -0.01, right: 0.015 }, amplitude: 0.2, duration: 0.65, interruptPolicy: 'FINISH_NATURALLY', nextState: 'WAITING_FOR_USER' }),
  thinking: profile('thinking', { facialExpression: 'relaxed', gaze: { x: -0.08, y: 0.035, openness: 0.96 }, head: { x: -0.04, y: -0.055, z: -0.025 }, torso: { lean: -0.01, shoulderLift: 0 }, arms: { left: -0.012, right: 0.018 }, amplitude: 0.38, duration: 0.9, interruptPolicy: 'BLEND_TO_LISTENING', nextState: 'THINKING' }),
  speaking: profile('speaking', { facialExpression: 'happy', head: { x: 0, y: 0.015, z: 0 }, torso: { lean: 0.008, shoulderLift: 0 }, arms: { left: -0.025, right: 0.05 }, amplitude: 0.35, duration: 0.72, interruptPolicy: 'TRANSITION_TO_SPEAKING', nextState: 'SPEAKING' }),
  technical_error: profile('technical_error', { facialExpression: 'surprised', gaze: { x: 0.05, y: -0.015, openness: 0.94 }, head: { x: -0.025, y: 0.025, z: -0.06 }, torso: { lean: 0.015, shoulderLift: 0.008 }, arms: { left: -0.015, right: 0.03 }, amplitude: 0.35, duration: 0.78, priority: 85, interruptPolicy: 'RECOVER_TO_SAFE_POSE', nextState: 'TECHNICAL_ERROR' }),
  recovery: profile('recovery', { facialExpression: 'relaxed', head: { x: 0.015, y: 0, z: 0.02 }, torso: { lean: 0.012, shoulderLift: -0.01 }, arms: { left: -0.01, right: 0.02 }, amplitude: 0.3, duration: 0.8, priority: 80, interruptPolicy: 'BLEND_TO_LISTENING', nextState: 'RECOVERING' }),
  head_tilt: profile('head_tilt', { facialExpression: 'relaxed', head: { x: -0.025, y: 0.015, z: -0.095 }, torso: { lean: 0.01, shoulderLift: 0 }, arms: { left: -0.01, right: 0.015 }, amplitude: 0.35, duration: 1.05, priority: 20, interruptPolicy: 'ACCELERATE_TO_COMPLETION', nextState: 'ACTIVE_IDLE' }),
  glance: profile('glance', { facialExpression: 'relaxed', gaze: { x: 0.12, y: 0.01, openness: 0.98 }, head: { x: 0, y: 0.02, z: 0 }, torso: { lean: 0, shoulderLift: 0 }, arms: { left: -0.01, right: 0.01 }, amplitude: 0.22, duration: 0.8, priority: 18, interruptPolicy: 'ACCELERATE_TO_COMPLETION', nextState: 'ACTIVE_IDLE' }),
};

const emotionAliases: Record<string, string> = {
  NEUTRAL: 'neutral', HAPPY: 'happy', EXCITED: 'excited', AMUSED: 'amused', PLAYFUL: 'playful', AFFECTIONATE: 'affectionate', RELIEVED: 'relieved', PROUD: 'proud', CURIOUS: 'curious', GRATEFUL: 'grateful', COMFORTING: 'comforting', CONFIDENT: 'confident', CALM: 'calm', CONTENT: 'calm', SHY: 'shy', EMBARRASSED: 'embarrassed', FLUSTERED: 'flustered', THOUGHTFUL: 'thoughtful', SURPRISED: 'surprised', NERVOUS: 'nervous', UNCERTAIN: 'uncertain', SLEEPY: 'sleepy', TIRED: 'sleepy', SAD: 'sad', DISAPPOINTED: 'disappointed', HURT: 'hurt', WORRIED: 'worried', CONFUSED: 'confused', FRUSTRATED: 'frustrated', ANNOYED: 'annoyed', ANGRY: 'angry', WITHDRAWN: 'withdrawn', CONCERNED: 'concerned', THINKING: 'thinking', EMPATHETIC: 'comforting', GENTLY_ANNOYED: 'annoyed', LISTENING: 'listening', WAITING: 'waiting', SPEAKING: 'speaking', TECHNICAL_ERROR: 'technical_error', RECOVERING: 'recovery', RECOVERY: 'recovery', HAPPY_EMBARRASSED: 'embarrassed', SAD_PLAYFUL: 'sad', ANNOYED_AFFECTIONATE: 'affectionate', EXCITED_NERVOUS: 'nervous',
};

export class AnimationOrchestrator {
  private readonly profiles: Readonly<Record<string, SemanticMotionProfile>>;
  private state: AnimationState = 'INITIALIZING';
  private lifecycle: AnimationLifecycle = 'FINISHED';
  private emotion = 'NEUTRAL';
  private intensity = 0.5;
  private activeProfile = DEFAULT_MOTION_PROFILES.neutral;
  private previousProfile = DEFAULT_MOTION_PROFILES.neutral;
  private actionElapsed = 0;
  private blendElapsed = 0;
  private idleElapsed = 0;
  private idleCooldown = 1.8;
  private idleSeed = 17;
  private pending: AnimationEvent[] = [];
  private interruptedAction: string | null = null;
  private motionEnabled = true;
  private handledMessageIds = new Set<string>();
  private frame: SemanticAnimationFrame;

  constructor(profiles: Readonly<Record<string, SemanticMotionProfile>> = DEFAULT_MOTION_PROFILES) {
    this.profiles = profiles;
    this.frame = this.makeFrame();
  }

  public setMotionEnabled(enabled: boolean): void {
    this.motionEnabled = enabled;
    if (!enabled) {
      this.pending.length = 0;
      this.lifecycle = 'FINISHED';
      this.activeProfile = this.profiles.neutral || DEFAULT_MOTION_PROFILES.neutral;
      this.state = 'NEUTRAL_IDLE';
    }
  }

  public setEmotion(emotion: string, intensity = 0.5): void {
    const nextEmotion = emotion || 'NEUTRAL';
    const normalizedIntensity = clamp01(intensity);
    if (nextEmotion === this.emotion && Math.abs(normalizedIntensity - this.intensity) < 0.03) return;
    this.emotion = nextEmotion;
    this.intensity = normalizedIntensity;
    this.enqueue({ type: 'EMOTION_CHANGED', emotion: nextEmotion, intensity: normalizedIntensity });
  }

  public setConversationState(state: string): void {
    const map: Record<string, AnimationState> = {
      IDLE: 'WAITING_FOR_USER', LISTENING: 'LISTENING', THINKING: 'THINKING', SPEAKING: 'SPEAKING',
      INITIALIZING: 'INITIALIZING', TECHNICAL_ERROR: 'TECHNICAL_ERROR', RECOVERING: 'RECOVERING',
    };
    const next = map[state] || 'WAITING_FOR_USER';
    const event: AnimationEvent = next === 'LISTENING'
      ? { type: 'VOICE_INPUT' }
      : next === 'THINKING'
        ? { type: 'REQUEST_PENDING' }
        : next === 'SPEAKING'
          ? { type: 'SPEECH_STARTED' }
          : next === 'WAITING_FOR_USER'
            ? { type: 'SPEECH_ENDED' }
            : { type: 'RESPONSE_RECEIVED' };
    this.state = next;
    this.enqueue(event);
  }

  public notify(event: AnimationEvent): void {
    this.enqueue(event);
  }

  /** Requests a semantic action while rejecting unknown/unapproved identifiers. */
  public requestAction(action: string, state: AnimationState = 'EMOTIONAL_REACTION'): boolean {
    const requested = this.profiles[action];
    if (!requested) {
      this.safeFallback();
      return false;
    }
    this.startProfile(requested, state, this.lifecycle !== 'FINISHED');
    return true;
  }

  public getSnapshot(): AnimationSnapshot {
    return { lifecycle: this.lifecycle, state: this.state, action: this.activeProfile.key, progress: this.progress(), emotion: this.emotion, intensity: this.intensity, pendingEventCount: this.pending.length, interruptedAction: this.interruptedAction };
  }

  public update(delta: number, elapsed: number): SemanticAnimationFrame {
    const dt = clamp(delta, 0, 0.1);
    if (!this.motionEnabled) return this.makeFrame();
    this.actionElapsed += dt;
    this.idleElapsed += dt;
    this.advanceLifecycle(dt);
    this.maybeScheduleIdle(elapsed);
    const progress = this.progress();
    const transition = this.lifecycle === 'BLENDING_OUT' ? clamp01(this.blendElapsed / Math.max(this.activeProfile.transitionOut, 0.05)) : 1;
    const shaped = easeInOut(clamp01(progress));
    const activeWeight = this.lifecycle === 'BLENDING_OUT' ? 1 - easeInOut(transition) : shaped;
    const intensity = clamp(this.intensity, 0.12, 1);
    const profileAmplitude = this.activeProfile.amplitude * intensity;
    const pulse = Math.sin(elapsed * 1.37 + this.activeProfile.key.length) * 0.08;
    this.frame = {
      state: this.state,
      lifecycle: this.lifecycle,
      action: this.activeProfile.key,
      progress,
      breathing: this.activeProfile.breathing * (1 + pulse) * (this.state === 'THINKING' ? 0.92 : 1),
      head: {
        x: this.activeProfile.head.x * profileAmplitude * activeWeight,
        y: this.activeProfile.head.y * profileAmplitude * activeWeight,
        z: this.activeProfile.head.z * profileAmplitude * activeWeight,
      },
      torso: {
        lean: this.activeProfile.torso.lean * profileAmplitude * activeWeight,
        shoulderLift: this.activeProfile.torso.shoulderLift * profileAmplitude * activeWeight,
      },
      arms: {
        left: this.activeProfile.arms.left * profileAmplitude * activeWeight,
        right: this.activeProfile.arms.right * profileAmplitude * activeWeight,
      },
      gaze: {
        x: this.activeProfile.gaze.x * profileAmplitude * activeWeight,
        y: this.activeProfile.gaze.y * profileAmplitude * activeWeight,
        openness: this.activeProfile.gaze.openness,
      },
      facialExpression: this.activeProfile.facialExpression,
      facialIntensity: intensity * (this.lifecycle === 'BLENDING_OUT' ? 1 - transition : 1),
      interruptedAction: this.interruptedAction,
      safeFallback: this.state === 'SAFE_FALLBACK',
    };
    return this.frame;
  }

  private enqueue(event: AnimationEvent): void {
    if (event.messageId) {
      if (this.handledMessageIds.has(event.messageId)) return;
      this.handledMessageIds.add(event.messageId);
      if (this.handledMessageIds.size > 64) this.handledMessageIds.delete(this.handledMessageIds.values().next().value as string);
    }
    this.pending.push({ ...event, timestamp: event.timestamp || Date.now() });
  }

  private advanceLifecycle(dt: number): void {
    const incoming = this.pending.shift();
    if (incoming) this.handleEvent(incoming);
    if (this.lifecycle === 'REQUESTED' || this.lifecycle === 'VALIDATED' || this.lifecycle === 'QUEUED') {
      this.lifecycle = 'STARTING';
      return;
    }
    if (this.lifecycle === 'STARTING') {
      this.lifecycle = 'PLAYING';
      return;
    }
    if (this.lifecycle === 'PLAYING' && this.actionElapsed >= this.activeProfile.duration) {
      this.lifecycle = 'COMPLETING';
      this.blendElapsed = 0;
      return;
    }
    if (this.lifecycle === 'COMPLETING') {
      this.lifecycle = 'BLENDING_OUT';
      this.blendElapsed = 0;
      return;
    }
    if (this.lifecycle === 'BLENDING_OUT') {
      this.blendElapsed += dt;
      if (this.blendElapsed >= this.activeProfile.transitionOut) {
        this.lifecycle = 'FINISHED';
        this.interruptedAction = null;
        // Finish on the neutral/base pose. Do not restart the same waiting
        // profile forever; this allows the idle scheduler to choose a new
        // glance or head-tilt action on its next cooldown.
        this.activeProfile = this.profiles.neutral || DEFAULT_MOTION_PROFILES.neutral;
        this.actionElapsed = 0;
        this.blendElapsed = 0;
      }
    }
  }

  private handleEvent(event: AnimationEvent): void {
    switch (event.type) {
      case 'EMOTION_CHANGED':
        this.startProfile(this.profileForEmotion(event.emotion || this.emotion), 'EMOTIONAL_REACTION');
        return;
      case 'USER_MESSAGE_RECEIVED':
      case 'VOICE_INPUT':
        this.interruptWith('listening', 'LISTENING');
        return;
      case 'REQUEST_PENDING':
        this.interruptWith('thinking', 'THINKING');
        return;
      case 'RESPONSE_RECEIVED':
        this.interruptWith(this.profileForEmotion(this.emotion).key, 'PREPARING_RESPONSE');
        return;
      case 'SPEECH_STARTED':
        this.interruptWith('speaking', 'SPEAKING');
        return;
      case 'SPEECH_ENDED':
        this.interruptWith('waiting', 'WAITING_FOR_USER');
        return;
      case 'REQUEST_TIMEOUT':
      case 'CONNECTION_LOST':
      case 'SERVER_ERROR':
      case 'EMPTY_OR_INVALID_RESPONSE':
      case 'FINAL_FAILURE':
        this.interruptWith('technical_error', 'TECHNICAL_ERROR');
        return;
      case 'RETRYING':
        this.interruptWith('thinking', 'THINKING');
        return;
      case 'RECOVERED':
        this.interruptWith('recovery', 'RECOVERING');
        return;
      case 'RESPONSE_CANCELLED':
      case 'RESET':
        this.interruptWith('waiting', 'WAITING_FOR_USER');
        return;
    }
  }

  private interruptWith(key: string, state: AnimationState): void {
    const next = this.profiles[key] || this.profiles.neutral;
    if (!next) {
      this.safeFallback();
      return;
    }
    if (this.lifecycle === 'PLAYING' && this.activeProfile.interruptPolicy === 'FINISH_NATURALLY' && this.actionElapsed < this.activeProfile.duration * 0.75) {
      this.pending.unshift({ type: 'RESPONSE_RECEIVED', emotion: this.emotion });
      return;
    }
    this.interruptedAction = this.activeProfile.key === next.key ? null : this.activeProfile.key;
    this.state = state;
    this.startProfile(next, state, this.lifecycle !== 'FINISHED');
  }

  private startProfile(next: SemanticMotionProfile, state: AnimationState, blend = false): void {
    this.previousProfile = this.activeProfile;
    this.activeProfile = next || this.profiles.neutral || DEFAULT_MOTION_PROFILES.neutral;
    this.state = state;
    this.actionElapsed = 0;
    this.blendElapsed = blend ? 0 : this.activeProfile.transitionIn;
    this.lifecycle = blend ? 'BLENDING_OUT' : 'REQUESTED';
    this.idleElapsed = 0;
  }

  private maybeScheduleIdle(elapsed: number): void {
    if (this.state !== 'WAITING_FOR_USER' && this.state !== 'NEUTRAL_IDLE' && this.state !== 'ACTIVE_IDLE') return;
    if (this.lifecycle !== 'FINISHED' && this.lifecycle !== 'PLAYING') return;
    if (this.idleElapsed < this.idleCooldown) return;
    this.idleSeed = (this.idleSeed * 1664525 + 1013904223) >>> 0;
    const chooseGlance = ((this.idleSeed + Math.floor(elapsed)) % 3) !== 0;
    this.startProfile(this.profiles[chooseGlance ? 'glance' : 'head_tilt'], 'ACTIVE_IDLE');
    this.idleCooldown = 4.5 + (this.idleSeed % 5000) / 1000;
  }

  private profileForEmotion(emotion?: string): SemanticMotionProfile {
    const key = emotionAliases[(emotion || this.emotion).toUpperCase()] || 'neutral';
    return this.profiles[key] || this.profiles.neutral || DEFAULT_MOTION_PROFILES.neutral;
  }

  private profileForState(state: AnimationState): SemanticMotionProfile {
    const key = state === 'WAITING_FOR_USER' || state === 'NEUTRAL_IDLE' ? 'waiting' : state === 'LISTENING' ? 'listening' : state === 'THINKING' ? 'thinking' : state === 'SPEAKING' ? 'speaking' : state === 'TECHNICAL_ERROR' ? 'technical_error' : state === 'RECOVERING' ? 'recovery' : 'neutral';
    return this.profiles[key] || this.profiles.neutral || DEFAULT_MOTION_PROFILES.neutral;
  }

  private progress(): number {
    return clamp01(this.actionElapsed / Math.max(this.activeProfile.duration, 0.05));
  }

  private makeFrame(): SemanticAnimationFrame {
    return { state: this.state, lifecycle: this.lifecycle, action: this.activeProfile.key, progress: this.progress(), breathing: this.activeProfile.breathing, head: { ...this.activeProfile.head }, torso: { ...this.activeProfile.torso }, arms: { ...this.activeProfile.arms }, gaze: { ...this.activeProfile.gaze }, facialExpression: this.activeProfile.facialExpression, facialIntensity: this.intensity, interruptedAction: this.interruptedAction, safeFallback: this.state === 'SAFE_FALLBACK' };
  }

  private safeFallback(): void {
    this.state = 'SAFE_FALLBACK';
    this.activeProfile = this.profiles.neutral || DEFAULT_MOTION_PROFILES.neutral;
    this.lifecycle = 'BLENDING_OUT';
    this.actionElapsed = 0;
    this.blendElapsed = 0;
    this.interruptedAction = null;
  }
}
