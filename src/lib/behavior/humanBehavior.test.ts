import assert from 'node:assert/strict';
import * as THREE from 'three';
import { HumanBehaviorController } from './HumanBehaviorController';
import { BreathingController } from './BreathingController';
import { EyeBehaviorController } from './EyeBehaviorController';
import { PostureController } from './PostureController';
import { HeadMotionController } from './HeadMotionController';
import { SpeechAnimationController } from './SpeechAnimationController';
import { EmotionController } from './EmotionController';

// 1. Respiration Engine Test
{
  const breathing = new BreathingController();
  const sample1 = breathing.update(0.016, 'NEUTRAL', 0.5, 'IDLE', false);
  assert.ok(sample1.lungVolume >= 0 && sample1.lungVolume <= 1.0);
  assert.ok(sample1.chestExpansion >= 0);

  // Advance 2 seconds into cycle
  let currentVolume = sample1.lungVolume;
  for (let i = 0; i < 120; i++) {
    const s = breathing.update(0.016, 'NEUTRAL', 0.5, 'IDLE', false);
    currentVolume = s.lungVolume;
  }
  assert.ok(currentVolume > 0);

  // Trigger preparatory speech inhale
  breathing.prepareSpeechInhale();
  const prep = breathing.update(0.05, 'NEUTRAL', 0.5, 'SPEAKING', true);
  assert.ok(prep.lungVolume > 0.3);

  // Gasp trigger on surprise
  breathing.triggerGasp();
  const gasp = breathing.update(0.016, 'SURPRISED', 0.8, 'IDLE', false);
  assert.equal(gasp.isGasp, true);
}

// 2. Eye Behavior & Gaze Saccade Test
{
  const eye = new EyeBehaviorController();
  const s1 = eye.update(0.016, 'NEUTRAL', 0.5, 'IDLE');
  assert.ok(typeof s1.leftBlink === 'number');
  assert.ok(typeof s1.gazeOffset.x === 'number');

  // Thinking state induces gaze aversion
  let averted = false;
  for (let i = 0; i < 50; i++) {
    const s = eye.update(0.016, 'THINKING', 0.6, 'THINKING');
    if (Math.abs(s.gazeOffset.x) > 0.05 || Math.abs(s.gazeOffset.y) > 0.05) {
      averted = true;
    }
  }
  assert.ok(averted, 'Thinking state must exhibit cognitive gaze aversion');
}

// 3. Posture & Contrapposto Weight Shift Test
{
  const posture = new PostureController();
  const p1 = posture.update(0.016, 0, 'NEUTRAL', 0.5, 'IDLE');
  assert.ok(Math.abs(p1.weightShift) > 0, 'Character must start in a natural contrapposto weight-bearing stance');
  assert.ok(p1.hipTiltZ !== 0);
  // Spinal curve must counter-balance hip tilt
  assert.ok(Math.sign(p1.spineCurve.z) === -Math.sign(p1.hipTiltZ));
}

// 4. Head Motion & Attentive Listening Nods
{
  const head = new HeadMotionController();
  const h1 = head.update(0.016, 0, 'NEUTRAL', 0.5, 'IDLE', 0);
  assert.ok(h1.rotation instanceof THREE.Vector3);

  // Trigger nod
  head.triggerNod(1);
  let nodded = false;
  for (let i = 0; i < 30; i++) {
    const s = head.update(0.016, i * 0.016, 'NEUTRAL', 0.5, 'LISTENING', 0);
    if (s.isNodding) nodded = true;
  }
  assert.ok(nodded, 'Head controller must execute active affirming nod');
}

// 5. Speech Animation & Length Awareness Test
{
  const speech = new SpeechAnimationController();

  // Short response
  speech.onSpeechStart('نعم');
  const shortFrame = speech.update(0.1, 'SPEAKING', 'NEUTRAL', 0.5, 0.5);
  assert.equal(shortFrame.activeGestureName, 'SHORT');

  // Long explanatory response
  speech.onSpeechStart('هذا شرح تفصيلي كامل لكيفية عمل النظام وتفاصيله الحركية والإنسانية العميقة');
  const longFrame = speech.update(0.1, 'SPEAKING', 'HAPPY', 0.7, 0.6);
  assert.equal(longFrame.activeGestureName, 'EXPLANATORY');
  assert.ok(longFrame.weight > 0);
}

// 6. Emotional Momentum & Decay
{
  const emotionCtrl = new EmotionController();
  emotionCtrl.setEmotion('HAPPY', 0.9);
  const snap1 = emotionCtrl.update(0.016);
  assert.equal(snap1.targetEmotion, 'HAPPY');

  // Advance past transition duration
  let snapFinal = snap1;
  for (let i = 0; i < 90; i++) {
    snapFinal = emotionCtrl.update(0.02);
  }
  assert.equal(snapFinal.currentEmotion, 'HAPPY');

  // Switch to ANGRY
  emotionCtrl.setEmotion('ANGRY', 0.8);
  const snap2 = emotionCtrl.update(0.016);
  assert.equal(snap2.previousEmotion, 'HAPPY');
  assert.ok(snap2.transitionProgress < 1.0, 'Opposite emotions must transition smoothly with momentum');
}

// 7. Full Integrated Human Behavior Frame Test
{
  const controller = new HumanBehaviorController();
  controller.setEmotion('AFFECTIONATE', 0.8);
  controller.setState('SPEAKING');
  controller.onSpeechStart('أنا سعيدة بوجودك معي دائماً');

  const frame = controller.update(
    0.016,
    1.5,
    new THREE.Vector3(0, 1.45, 3.4),
    new THREE.Vector3(0, 0, 0),
    0.15
  );

  assert.equal(frame.targetEmotion, 'AFFECTIONATE');
  assert.equal(frame.conversationState, 'SPEAKING');
  assert.ok(frame.respiration.lungVolume >= 0);
  assert.ok(frame.lookAtTarget instanceof THREE.Vector3);
  assert.ok(frame.speech.weight > 0);
}

console.log('humanBehavior test suite passed completely!');
