import test from 'node:test';
import assert from 'node:assert/strict';
import { videoDriverId, videoCamera } from '../public/video-export.js';

test('export defaults to the first human and honors any explicitly selected participant', () => {
  const cars = [{ id: 0, control: 'ai' }, { id: 1, control: 'human' }, { id: 2, control: 'human' }];
  assert.equal(videoDriverId(cars), 1);
  assert.equal(videoDriverId(cars, 0), 0, 'Driver zero is a valid explicit choice.');
  assert.equal(videoDriverId(cars, 2), 2);
  assert.equal(videoDriverId(cars, 99), 1, 'A missing participant falls back to the player.');
  assert.equal(videoDriverId(cars.map(c => ({ ...c, control: 'ai' }))), 0);
});

test('adaptive video framing keeps separated cars clear of the HUD and mini-map', () => {
  const near = [{ id: 0, x: 10, y: 10 }, { id: 1, x: 10, y: 12 }];
  const far = [...near, { id: 2, x: 120, y: 90 }, { id: 3, x: 0, y: 100 }];
  const close = videoCamera(near, 0, 'all'), wide = videoCamera(far, 0, 'all');
  assert.ok(wide.zoom < close.zoom);
  for (const car of far) {
    const x = 640 + ((car.x + .5) * 32 - wide.x) * wide.zoom;
    const y = 360 + ((car.y + .5) * 32 - wide.y) * wide.zoom;
    assert.ok(x > 32 && x < 968 && y > 100 && y < 580, 'Every car remains inside the visible road area.');
  }
  assert.deepEqual(videoCamera(near, 0, 'all'), close, 'Seeking back restores exactly the same framing.');
  assert.equal(videoCamera(far, 1).zoom, 1.65, 'Individual mode stays close regardless of other cars.');
});
