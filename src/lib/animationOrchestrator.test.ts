import assert from 'node:assert/strict';
import { AnimationOrchestrator } from './animationOrchestrator';

const advance = (scheduler: AnimationOrchestrator, seconds: number, start = 0) => {
  let frame = scheduler.update(0, start);
  for (let i = 1; i <= Math.ceil(seconds / 0.05); i += 1) frame = scheduler.update(Math.min(0.05, seconds - (i - 1) * 0.05), start + i * 0.05);
  return frame;
};

// A: long silence produces a living state and eventually an autonomous idle action.
{
  const scheduler = new AnimationOrchestrator();
  scheduler.setConversationState('IDLE');
  advance(scheduler, 2);
  const frame = advance(scheduler, 6, 2);
  assert.ok(['waiting', 'head_tilt', 'glance', 'neutral'].includes(frame.action));
  assert.notEqual(frame.state, 'SAFE_FALLBACK');
}

// B: a message interrupts a gesture through a blend lifecycle, not a pose reset.
{
  const scheduler = new AnimationOrchestrator();
  scheduler.setConversationState('IDLE');
  advance(scheduler, 2);
  scheduler.notify({ type: 'EMOTION_CHANGED', emotion: 'CURIOUS', intensity: 0.8 });
  advance(scheduler, 0.35);
  const before = scheduler.getSnapshot();
  scheduler.notify({ type: 'USER_MESSAGE_RECEIVED', messageId: 'message-1' });
  const during = scheduler.update(0.016, 4);
  assert.equal(during.state, 'LISTENING');
  assert.equal(during.interruptedAction, before.action);
  assert.ok(['BLENDING_OUT', 'REQUESTED', 'STARTING', 'PLAYING'].includes(during.lifecycle));
}

// C: duplicate message events are ignored and cannot grow the queue forever.
{
  const scheduler = new AnimationOrchestrator();
  scheduler.notify({ type: 'USER_MESSAGE_RECEIVED', messageId: 'same-message' });
  scheduler.notify({ type: 'USER_MESSAGE_RECEIVED', messageId: 'same-message' });
  assert.equal(scheduler.getSnapshot().pendingEventCount, 1);
  scheduler.update(0.016, 0);
  assert.equal(scheduler.getSnapshot().pendingEventCount, 0);
}

// D: different emotions map to different semantic motion profiles.
{
  const scheduler = new AnimationOrchestrator();
  scheduler.setEmotion('HAPPY', 0.7);
  const happy = advance(scheduler, 0.1).action;
  scheduler.setEmotion('CONFUSED', 0.7);
  const confused = advance(scheduler, 0.1, 1).action;
  assert.equal(happy, 'happy');
  assert.equal(confused, 'confused');
}

// E/G: technical errors and missing profile requests recover without locking.
{
  const scheduler = new AnimationOrchestrator();
  scheduler.notify({ type: 'SERVER_ERROR' });
  const errorFrame = scheduler.update(0.016, 0);
  assert.equal(errorFrame.state, 'TECHNICAL_ERROR');
  scheduler.notify({ type: 'RECOVERED' });
  const recoveryFrame = advance(scheduler, 0.2);
  assert.equal(recoveryFrame.state, 'RECOVERING');
  assert.notEqual(recoveryFrame.state, 'SAFE_FALLBACK');
}

// Unknown model-generated actions are rejected and recover through a safe pose.
{
  const scheduler = new AnimationOrchestrator();
  assert.equal(scheduler.requestAction('execute_arbitrary_code'), false);
  assert.equal(scheduler.getSnapshot().state, 'SAFE_FALLBACK');
  assert.equal(scheduler.requestAction('happy'), true);
}

console.log('animationOrchestrator tests passed');
