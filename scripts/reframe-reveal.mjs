/** Align the generated continuation to the approved peak and avoid its left-side artifact. */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error('Usage: FFMPEG_PATH=/path/to/ffmpeg node scripts/reframe-reveal.mjs source.mp4 output.mp4');
// This generated take revisited the reference pose at frame 65, not at its first frame.
// Start there, settle the small geometry difference, then look toward the stable wall.
const zoom='1+if(lte(in,24),pow(in/24,2)*(3-2*in/24),if(lt(in,112),1,1-pow(min((in-112)/79,1),2)*(3-2*min((in-112)/79,1))))';
const filters=`[0:v]trim=start_frame=65,setpts=1.5*(PTS-STARTPTS),minterpolate=fps=24:mi_mode=blend,tpad=stop_mode=clone:stop_duration=0.2,trim=duration=8,scale=1920:1080[a];[1:v]scale=1920:1080,setpts=PTS-STARTPTS[b];[a][b]blend=all_expr='A*min(N/8,1)+B*(1-min(N/8,1))':shortest=1,scale=3840:2160:flags=lanczos,zoompan=z='${zoom}':x='iw-iw/zoom':y='(ih-ih/zoom)*0.38':d=1:s=1920x1080:fps=24[out]`;
const child=spawn(process.env.FFMPEG_PATH||'ffmpeg',['-hide_banner','-loglevel','error','-i',resolve(source),'-loop','1','-framerate','24','-i',resolve('public/ascent-hd/desktop/0340.webp'),'-filter_complex',filters,'-map','[out]','-an','-c:v','libx264','-preset','fast','-crf','15','-pix_fmt','yuv420p',resolve(destination)],{stdio:'inherit'});
child.on('error',error=>{console.error(error);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
