/** Append a photographed summit reveal without re-encoding the approved climb. */
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile, copyFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
const [source, directory = 'reveal-hd'] = process.argv.slice(2);
if (!source || !/^[a-z0-9-]+$/.test(directory)) throw new Error('Usage: FFMPEG_PATH=/path/to/ffmpeg node scripts/prepare-reveal.mjs clip.mp4 fresh-reveal-hd');
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const manifest = JSON.parse(await readFile('app/journey-media.json', 'utf8'));
const first = manifest.summitFrame + 1;
const motionDirectory = directory.replace(/-hd$/, '') + '-motion';
if (directory === motionDirectory) throw new Error('Use an -hd suffix for the detail directory');
const variants = [
  {dir: directory, name: 'desktop', width: manifest.width, height: manifest.height, quality: 86},
  {dir: directory, name: 'mobile', width: manifest.mobileWidth, height: manifest.mobileHeight, quality: 84},
  {dir: motionDirectory, name: 'desktop', width: manifest.motionWidth, height: manifest.motionHeight, quality: 65},
  {dir: motionDirectory, name: 'mobile', width: manifest.motionMobileWidth, height: manifest.motionMobileHeight, quality: 65},
];
async function exportVariant(variant) {
  const destination = resolve('public', variant.dir, variant.name);
  await mkdir(destination, {recursive:true});
  if ((await readdir(destination)).length) throw new Error(`Choose a fresh directory: ${destination}`);
  // The first reference frame is already the original summit pose. Don't duplicate it.
  const crop = variant.name === 'mobile' ? 'crop=ih*9/16:ih:(iw-ow)/2:0,' : '';
  await new Promise((done, fail) => {
    const process = spawn(ffmpeg, ['-hide_banner','-loglevel','error','-i',resolve(source),'-an','-vf',`fps=${manifest.fps},select='gte(n,1)',${crop}scale=${variant.width}:${variant.height}:flags=lanczos`,'-fps_mode','passthrough','-c:v','libwebp','-q:v',String(variant.quality),'-compression_level','5','-threads','2','-start_number',String(first),resolve(destination,'%04d.webp')],{stdio:'inherit'});
    process.on('error',fail);process.on('exit',code=>code===0?done():fail(new Error(`Export failed: ${code}`)));
  });
  const files=(await readdir(destination)).filter(name=>name.endsWith('.webp')).sort();
  const bytes=(await Promise.all(files.map(file=>stat(resolve(destination,file))))).reduce((sum,file)=>sum+file.size,0);
  console.log(`${variant.dir}/${variant.name}: ${files.length} frames, ${(bytes/1024/1024).toFixed(1)} MiB`);
  return files.length;
}
const counts = await Promise.all(variants.map(exportVariant));
if (!counts[0] || counts.some(count=>count!==counts[0])) throw new Error('Incomplete frame variants');
manifest.frameCount=first+counts[0];
manifest.revealPath=`/${directory}`;
manifest.revealMotionPath=`/${motionDirectory}`;
manifest.version='summit-reveal-5';
const last=String(manifest.frameCount-1).padStart(4,'0')+'.webp';
await mkdir('public/summit-arrival',{recursive:true});
// Exact final decoded pose, exact crop, exact color: no scenic jump into the page.
await copyFile(resolve('public',directory,'desktop',last),'public/summit-arrival/overlook.webp');
await copyFile(resolve('public',directory,'mobile',last),'public/summit-arrival/overlook-mobile.webp');
await writeFile('app/journey-media.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Manifest and matching arrival stills saved. Restart the local server for new assets.');
