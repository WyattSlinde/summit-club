import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { journeyFrameUrl } from '../app/journey-source.ts';
import { frameForProgress, trailJourney, WALK_END, DESCENT_START } from '../app/trail-journey.ts';
const media=JSON.parse(await readFile(new URL('../app/journey-media.json',import.meta.url),'utf8'));
const file=url=>new URL('../public'+url.split('?')[0],import.meta.url);

test('the complete published trail has both preview and HD frames for both screen shapes',async()=>{
  for(const portrait of [false,true])for(const preview of [false,true]){
    await Promise.all(Array.from({length:media.frameCount},(_,i)=>access(file(journeyFrameUrl(media,i,portrait,preview)))));
  }
  assert.match(journeyFrameUrl(media,media.summitFrame,false),/^\/ascent-hd\//);
  if(media.revealPath)assert.ok(journeyFrameUrl(media,media.summitFrame+1,false).startsWith(media.revealPath+'/'));
});

test('the final panorama is byte-identical to the scene that becomes the club page',async()=>{
  for(const portrait of [false,true]){
    const last=await readFile(file(journeyFrameUrl(media,media.frameCount-1,portrait)));
    const arrival=await readFile(new URL(`../public/summit-arrival/overlook${portrait?'-mobile':''}.webp`,import.meta.url));
    assert.ok(last.equals(arrival),'reveal and page must use exactly the same landscape and crop');
  }
});

test('the panorama completes before the page reveals, and the invitation waits for the logo',()=>{
  assert.equal(trailJourney(.60).invitation,0);
  assert.equal(trailJourney(.675).invitation,1);
  for(const p of [WALK_END,.60,.675,DESCENT_START])assert.equal(frameForProgress(p,media.frameCount,media.summitFrame),media.summitFrame);
  assert.equal(frameForProgress(.90,media.frameCount,media.summitFrame),media.frameCount-1);
  assert.equal(trailJourney(.90).approach,0);
  assert.equal(trailJourney(.925).approach,0);
  assert.equal(trailJourney(.99).camp,1);
  const held=trailJourney(.962);
  trailJourney(1);trailJourney(.02);assert.deepEqual(trailJourney(.962),held);
});
