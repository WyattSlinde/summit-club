import test from 'node:test';
import assert from 'node:assert/strict';
import { trailJourney, walkerEyeHeight, WALK_END, CLUB_START } from '../app/trail-journey.ts';
import { trailX, terrainHeight } from '../app/trail-terrain.ts';

test('a paused scroll holds the same position regardless of prior travel', () => {
  const paused = trailJourney(.36);
  for (const position of [.9, .05, 1, .36, .65, 0]) {
    trailJourney(position);
    assert.deepEqual(trailJourney(.36), paused);
  }
});

test('scrolling back retraces exactly the same path', () => {
  const outward = Array.from({ length: 201 }, (_, i) => trailJourney(i / 200));
  for (let i = 200; i >= 0; i--) {
    assert.deepEqual(trailJourney(i / 200), outward[i]);
    if (i > 0) assert.ok(outward[i].z <= outward[i - 1].z);
  }
});

test('the walker stays at human height for the complete route', () => {
  for (let i = 0; i <= 1000; i++) {
    const frame = trailJourney(i / 1000);
    const ground = terrainHeight(trailX(frame.z), frame.z);
    const clearance = walkerEyeHeight(ground, frame.walk) - ground;
    assert.ok(Number.isFinite(clearance));
    assert.ok(clearance >= 1.74 && clearance <= 1.82, `Eye clearance: ${clearance}`);
  }
});

test('the overlook holds still while the club page appears', () => {
  const overlook = trailJourney(WALK_END);
  for (const p of [WALK_END, .85, CLUB_START, 1, 10]) {
    assert.equal(trailJourney(p).z, overlook.z);
    assert.equal(trailJourney(p).walk, 1);
  }
  assert.equal(trailJourney(WALK_END).title, 0);
  assert.equal(trailJourney(.80).title, 1);
  assert.equal(trailJourney(1).title, 0);
  assert.equal(trailJourney(1).camp, 1);
  assert.equal(trailJourney(1).accessible, true);
  assert.equal(trailJourney(1).lookFreedom, 0);
});

test('reduced motion exposes the club without requiring a walking sequence', () => {
  for (const p of [0, .5, 1]) {
    const frame = trailJourney(p, true);
    assert.equal(frame.walk, 1);
    assert.equal(frame.accessible, true);
    assert.equal(frame.camp, 1);
    assert.equal(frame.exploring, false);
    assert.equal(frame.controls, 0);
    assert.equal(walkerEyeHeight(100, frame.walk, true), 101.78);
  }
});

test('scroll overshoot and invalid input never put the camera outside the route', () => {
  assert.deepEqual(trailJourney(-1), trailJourney(0));
  assert.deepEqual(trailJourney(2), trailJourney(1));
  assert.deepEqual(trailJourney(NaN), trailJourney(0));
  assert.deepEqual(trailJourney(Infinity), trailJourney(0));
});
