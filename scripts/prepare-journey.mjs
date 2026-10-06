/** Build local, independently addressable WebP frames. The site never plays the source clip. */
import { spawn } from 'node:child_process';
import { mkdir, readdir, copyFile, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
const source = process.argv[2];
if (!source) throw new Error('Usage: FFMPEG_PATH=/path/to/ffmpeg node scripts/prepare-journey.mjs /path/to/source.mp4');
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const directory = process.argv[3] || 'journey';
if (!/^[a-z0-9-]+$/.test(directory)) throw new Error('Use a simple media directory name');
const summitFrame = process.argv[4] === undefined ? undefined : Number(process.argv[4]);
if (summitFrame !== undefined && (!Number.isInteger(summitFrame) || summitFrame < 0)) throw new Error('Invalid summit frame');
const fps = 24;
const root = resolve('public', directory);
// Match frameFocalX: keep the opening deer visible before centering on the climb.
const focal = "0.5*pow(min(t/3,1),2)*(3-2*min(t/3,1))";
const variants = [
  {name:'desktop',width:2560,height:1440,quality:84,filter:'scale=2560:1440:flags=lanczos'},
  {name:'mobile',width:1008,height:1792,quality:82,filter:`crop=ih*9/16:ih:x='(iw-ow)*(${focal})':y=0,scale=1008:1792:flags=lanczos`},
];
for (const variant of variants) {
  const destination = resolve(root,variant.name);
  await mkdir(destination,{recursive:true});
  // Do not mix a new sequence with stale frames. Existing outputs require a new destination.
  if ((await readdir(destination)).some(name => name.endsWith('.webp'))) throw new Error(`${destination} already contains a sequence.`);
  await new Promise((done,fail) => {
    const child=spawn(ffmpeg,['-hide_banner','-loglevel','warning','-i',resolve(source),'-an','-vf',`fps=${fps},${variant.filter}`,'-c:v','libwebp','-q:v',String(variant.quality),'-compression_level','5','-threads','2','-start_number','0',resolve(destination,'%04d.webp')],{stdio:'inherit'});
    child.on('error',fail); child.on('exit',code=>code===0?done():fail(new Error(`ffmpeg exited ${code}`)));
  });
}
const files=(await readdir(resolve(root,'desktop'))).filter(name=>name.endsWith('.webp')).sort();
const mobile=(await readdir(resolve(root,'mobile'))).filter(name=>name.endsWith('.webp')).sort();
if (files.length!==mobile.length || files.length<2) throw new Error('Incomplete variants');
await copyFile(resolve(root,'desktop',files[0]),resolve(root,'trailhead.webp'));
const peak = Math.min(files.length - 1, Math.max(0, summitFrame ?? files.length - 1));
await copyFile(resolve(root,'desktop',files[peak]),resolve(root,'overlook.webp'));
await copyFile(resolve(root,'desktop',files[peak]),resolve(root,'summit.webp'));
const manifest={frameCount:files.length,width:2560,height:1440,mobileWidth:1008,mobileHeight:1792,fps,summitFrame:peak,path:`/${directory}`,version:'sunset-hd-3'};
await writeFile('app/journey-media.json',JSON.stringify(manifest,null,2)+'\n');
for (const variant of variants) {
  const bytes=(await Promise.all(files.map(file=>stat(resolve(root,variant.name,file))))).reduce((sum,file)=>sum+file.size,0);
  console.log(`${variant.name}: ${files.length} frames, ${(bytes/1024/1024).toFixed(1)} MiB`);
}
console.log('Restart the development server to refresh its public-asset index.');
