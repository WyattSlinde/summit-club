import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const media=JSON.parse(await readFile(path.join(root,'app/journey-media.json'),'utf8'));
const batchSize=8;
// Package original WebP bytes; no recompression or visual changes.
for(const shape of ['desktop','mobile']){
 const directory=path.join(root,'public/journey-packs',shape);await mkdir(directory,{recursive:true});
 for(let start=0;start<media.frameCount;start+=batchSize){
  const files=[];
  for(let i=start;i<Math.min(start+batchSize,media.frameCount);i++)files.push(await readFile(path.join(root,'public',i>media.summitFrame?media.revealMotionPath:media.motionPath,shape,String(i).padStart(4,'0')+'.webp')));
  const header=Buffer.alloc(12+files.length*4);header.write('SMT1');header.writeUInt32LE(start,4);header.writeUInt32LE(files.length,8);files.forEach((data,i)=>header.writeUInt32LE(data.length,12+i*4));
  await writeFile(path.join(directory,String(start).padStart(4,'0')+'.bin'),Buffer.concat([header,...files]));
 }
}
console.log(`Packed ${media.frameCount} unchanged motion poses per orientation, ${batchSize} per request.`);
