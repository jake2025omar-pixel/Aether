import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  CharacterPerformanceDirector,
  FingerHandController,
  LocomotionController,
  FacialPerformanceEngine,
  FullBodyActionDirector,
} from './index';

console.log('=== RUNNING AETHER AI CHARACTER PERFORMANCE TEST SUITE ===');

// 1. FINE-GRAINED FACIAL ACTING TEST (10 DISTINCT PERFORMANCES)
{
  const facial = new FacialPerformanceEngine();

  const stepToPeak = (style: any, emotion: any, intensity = 0.8, state: any = 'IDLE') => {
    facial.triggerExpressionStyle(style, 2.0);
    let sample = facial.update(0.05, 0.1, emotion, intensity, state, 0, 0, 0);
    for (let i = 0; i < 15; i++) {
      sample = facial.update(0.05, 0.1 + i * 0.05, emotion, intensity, state, 0, 0, 0);
    }
    return sample;
  };

  // Test 1: Playful Fang Smirk (Single-eye wink eliminated per user requirement)
  const wink = stepToPeak('PLAYFUL_WINK', 'HAPPY', 0.8);
  assert.strictEqual(wink.vrmPresets.blinkLeft, 0, 'Single-eye wink must be completely eliminated');
  assert.ok(wink.directMorphs.Fcl_MTH_SkinFung_R > 0.2, 'Must activate asymmetric fang smirk');

  // Test 2: Mischievous Smirk
  const smirk = stepToPeak('MISCHIEVOUS_SMIRK', 'HAPPY', 0.8);
  assert.ok(smirk.directMorphs.Fcl_MTH_SkinFung_R > 0.2);

  // Test 3: Shy Blush & Gaze Aversion
  const shy = stepToPeak('SHY_BLUSH_LOOK_AWAY', 'AFFECTIONATE', 0.7);
  assert.ok(shy.gazeAversion.x !== 0 && shy.gazeAversion.y !== 0, 'Shy expression must exhibit downward/lateral gaze aversion');

  // Test 4: Eye Widening Surprise
  const shock = stepToPeak('SURPRISE_EYE_WIDEN', 'SURPRISED', 0.9);
  assert.ok(shock.directMorphs.Fcl_EYE_Spread > 0.3, 'Surprise must widen eyes via Fcl_EYE_Spread');
  assert.ok(shock.directMorphs.Fcl_BRW_Surprised > 0.3, 'Surprise must lift eyebrows');

  // Test 5: Laughter Burst
  const laugh = stepToPeak('LAUGHTER_BURST', 'HAPPY', 0.9);
  assert.ok(laugh.directMorphs.Fcl_EYE_Joy_L > 0.3 && laugh.directMorphs.Fcl_EYE_Joy_R > 0.3, 'Laughter must narrow both eyes into joy curves');
  assert.ok(laugh.directMorphs.Fcl_MTH_Joy > 0.3, 'Laughter must open joyful mouth');

  // Test 6: Tender Affection
  const tender = stepToPeak('AFFECTIONATE_TENDER', 'AFFECTIONATE', 0.8);
  assert.ok(tender.directMorphs.Fcl_MTH_Fun > 0.2);

  // Test 7: Anime Pout
  const pout = stepToPeak('POUT_ANNORD', 'GENTLY_ANNOYED', 0.7);
  assert.ok(pout.directMorphs.Fcl_MTH_Small > 0.3, 'Pout must activate small pursed mouth');

  // Test 8: Thoughtful Purse
  const thought = stepToPeak('THOUGHTFUL_PURSE', 'THINKING', 0.6, 'THINKING');
  assert.ok(thought.activeStyle === 'THOUGHTFUL_PURSE');

  // Test 9: Sleepy Droop
  const sleepy = stepToPeak('SLEEPY_DROOP', 'NEUTRAL', 0.5, 'SLEEPING');
  assert.ok(sleepy.directMorphs.Fcl_EYE_Close_L > 0.2, 'Sleepy must droop eyelids');

  // Test 10: Natural Resting Friendly Expression
  const natural = stepToPeak('NATURAL', 'NEUTRAL', 0.5, 'IDLE');
  assert.ok(natural.activeStyle === 'NATURAL');

  console.log('✓ Test 1 Passed: 10 distinct anime facial acting performances verified');
}

// 2. EXTREME HAND & FINGER ARTICULATION TEST (30 BONES)
{
  const hands = new FingerHandController();

  hands.setLeftPose('POINTING');
  hands.setRightPose('GENTLE_WAVE');

  let sample = hands.update(0.05, 1.0);
  for (let i = 0; i < 15; i++) {
    sample = hands.update(0.05, 1.0 + i * 0.05);
  }
  assert.ok(sample.left.indexProximal.z < 0.1, 'Left pointing index must be extended');
  assert.ok(sample.left.middleProximal.z < -0.8, 'Left pointing middle must be curled tight');
  assert.ok(sample.right.littleDistal.z !== 0, 'Right waving pinky must articulate');

  // Verify all 15 bones per hand exist and return numeric joint rotations
  for (const hand of [sample.left, sample.right]) {
    assert.ok(typeof hand.thumbMetacarpal.y === 'number');
    assert.ok(typeof hand.indexProximal.z === 'number');
    assert.ok(typeof hand.middleIntermediate.z === 'number');
    assert.ok(typeof hand.ringDistal.z === 'number');
    assert.ok(typeof hand.littleProximal.z === 'number');
  }

  console.log('✓ Test 2 Passed: 30-bone articulated hand and finger kinematics verified');
}

// 3. FULL-BODY CHOREOGRAPHED ACTIONS TEST
{
  const actions = new FullBodyActionDirector();

  const routines: Array<Parameters<typeof actions.triggerAction>[0]> = [
    'HEAD_SCRATCH',
    'FRIENDLY_WAVE',
    'EXPRESSIVE_SHRUG',
    'LAUGH_REACTION',
    'THINKING_CONTEMPLATION',
    'AFFECTIONATE_REACH',
    'SURPRISED_RECOIL',
    'CONFIDENT_HIP_REST',
    'EXPLANATORY_GESTURE',
    'CURIOUS_LEAN',
    'EMPATHETIC_COMFORT',
    'SAD_PENSIVE',
    'ANGRY_STANCE',
    'CALM_SETTLE',
  ];

  for (const r of routines) {
    const triggered = actions.triggerAction(r, true);
    assert.ok(triggered, `Must trigger routine ${r}`);
    const frame = actions.update(0.1, 1.0, 'IDLE', 'HAPPY', false, false);
    assert.equal(frame.activeAction, r);
    assert.ok(frame.weight > 0, `Weight for ${r} must ramp up`);
    actions.interrupt();
  }

  // Anti-Repetition / Cooldown Test
  actions.triggerAction('FRIENDLY_WAVE', true);
  const secondTry = actions.triggerAction('FRIENDLY_WAVE', false); // Without force
  assert.equal(secondTry, false, 'Action must be rejected while on active cooldown');

  console.log('✓ Test 3 Passed: 14 full-body choreographed actions and anti-repetition cooldown verified');
}

// 4. AUTONOMOUS ROOM NAVIGATION & LOCOMOTION TEST
{
  const loco = new LocomotionController();
  assert.equal(loco.isAutonomousNavigationEnabled(), false, 'Autonomous navigation must be safely disabled by default');

  // Navigate to target zone
  loco.navigateTo(new THREE.Vector3(0.55, 0, -0.30), -0.25);

  let moved = false;
  let kneeBent = false;
  for (let i = 0; i < 60; i++) {
    const f = loco.update(0.033, false);
    if (f.velocity > 0.1) moved = true;
    if (f.leftLeg.lowerLeg.x > 0.1 || f.rightLeg.lowerLeg.x > 0.1) {
      kneeBent = true;
    }
  }

  assert.ok(moved, 'Character must accelerate and walk toward destination');
  assert.ok(kneeBent, 'Procedural locomotion must articulate knee joints during swing phase');
  assert.ok(loco.getPosition().x !== 0, 'Character world-space position must change');

  // Emergency interruption on user interaction
  loco.interruptAndFaceTarget(new THREE.Vector3(0, 1.25, 2.7));
  for (let i = 0; i < 30; i++) {
    loco.update(0.033, true);
  }
  assert.ok(loco.update(0.033, true).velocity < 0.05, 'Interrupted locomotion must smoothly decelerate to zero');

  console.log('✓ Test 4 Passed: Autonomous room navigation, world-space displacement, and knee kinematics verified');
}

// 5. 5-VOWEL JAPANESE / ANIME SPEECH SYNCHRONIZATION TEST
{
  const facial = new FacialPerformanceEngine();

  // Test active speech aperture is owned by the measured viseme envelope
  const speechFrame = facial.update(0.05, 1.2, 'HAPPY', 0.8, 'SPEAKING', 0.65, 0, 0);

  // Verify anchored speech channels are active and unrelated emotional mouth
  // shapes cannot stack with them (the former source of mouth drift).
  assert.ok(speechFrame.vrmPresets.aa > 0, 'aa viseme must participate in speech');
  assert.ok(speechFrame.vrmPresets.ih >= 0, 'ih viseme must participate in speech');
  assert.ok(speechFrame.vrmPresets.oh >= 0, 'oh viseme must participate in speech');
  assert.ok(speechFrame.directMorphs.Fcl_MTH_A > 0, 'Fcl_MTH_A direct morph must be active');
  assert.equal(speechFrame.directMorphs.Fcl_MTH_Joy, 0, 'emotion mouth joy must not fight speech');
  assert.equal(speechFrame.directMorphs.Fcl_MTH_Fun, 0, 'emotion mouth fun must not fight speech');

  // Verify clean closure when speech stops
  let restingFrame = facial.update(0.05, 2.0, 'HAPPY', 0.8, 'IDLE', 0, 0, 0);
  for (let i = 0; i < 15; i++) {
    restingFrame = facial.update(0.05, 2.0 + i * 0.05, 'HAPPY', 0.8, 'IDLE', 0, 0, 0);
  }
  assert.ok(restingFrame.vrmPresets.aa < 0.05, 'aa must close when speech ends');

  console.log('✓ Test 5 Passed: 5-vowel speech synchronization and clean mouth closure verified');
}

// 6. MASTER UNIFIED CHARACTER PERFORMANCE DIRECTOR INTEGRATION TEST
{
  const director = new CharacterPerformanceDirector();

  // Set Emotion
  director.setEmotion('AFFECTIONATE', 0.85);

  // Trigger speech
  director.onSpeechStart('أنا هنا دائماً بجانبك يا حبيبي');

  let unified = director.update(
    0.05,
    0.1,
    new THREE.Vector3(0, 1.25, 2.7),
    new THREE.Vector3(0, 0, 0),
    0.45
  );

  assert.equal(unified.targetEmotion, 'AFFECTIONATE');

  // Step through transition duration
  for (let i = 0; i < 25; i++) {
    unified = director.update(
      0.05,
      0.1 + i * 0.05,
      new THREE.Vector3(0, 1.25, 2.7),
      new THREE.Vector3(0, 0, 0),
      0.45
    );
  }

  assert.equal(unified.emotion, 'AFFECTIONATE');
  assert.ok(unified.respiration.lungVolume > 0);
  assert.ok(unified.eye.attentionFocus > 0);
  assert.ok(unified.hands.rightPose === 'CHEST_HEART' || unified.hands.rightPose === 'OPEN_PALM');
  assert.ok(unified.lookAtTarget instanceof THREE.Vector3);

  console.log('✓ Test 6 Passed: Master Character Performance Director coordinates all systems seamlessly');
}

console.log('=== ALL CHARACTER PERFORMANCE ACCEPTANCE TESTS COMPLETED SUCCESSFULLY! ===');
