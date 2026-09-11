import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Input, BufferSource, ALL_FORMATS, EncodedPacketSink } from 'mediabunny';

// Read the actual downloaded container, then decode every packet with the
// browser's native decoder. Metadata alone cannot prove frames were retained.
export async function inspectVideo(path, evaluate, sampleTime = 1.5) {
  let bytes;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { bytes = await readFile(path); break; }
    catch (error) { if (error.code !== 'ENOENT' || attempt === 29) throw error; await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack(), config = await track.getDecoderConfig();
    const packets = [];
    for await (const packet of new EncodedPacketSink(track).packets()) packets.push(packet);
    const duration = await track.computeDuration();
    assert.equal(packets.length, Math.round(duration * 60), 'Every 60 fps sample exists in the file.');
    const times = packets.map(p => p.timestamp).sort((a, b) => a - b);
    for (let i = 0; i < times.length; i++) assert.ok(Math.abs(times[i] - i / 60) < .0011, 'No missing or duplicate presentation timestamps.');
    const wire = { ...config, description: config.description ? Array.from(new Uint8Array(config.description.buffer || config.description, config.description.byteOffset || 0, config.description.byteLength)) : undefined };
    await evaluate(`(()=>{
      const config=${JSON.stringify(wire)};if(config.description)config.description=new Uint8Array(config.description);
      window.decodedTimes=[];window.decodeErrors=[];window.nativeColored=0;
      window.checkDecoder=new VideoDecoder({output:frame=>{decodedTimes.push(frame.timestamp);if(Math.abs(frame.timestamp-${Math.round(sampleTime*1e6)})<1100){const c=document.createElement('canvas');c.width=1280;c.height=720;const ctx=c.getContext('2d');ctx.drawImage(frame,0,0);window.nativeDecodedFrame=c.toDataURL();window.nativeDecodedPixels=ctx.getImageData(0,0,1280,720).data;for(let i=0;i<nativeDecodedPixels.length;i+=4)if(nativeDecodedPixels[i]+nativeDecodedPixels[i+1]+nativeDecodedPixels[i+2]>90)nativeColored++;}frame.close()},error:error=>decodeErrors.push(error.message)});
      checkDecoder.configure(config);
    })()`);
    for (let i = 0; i < packets.length; i += 30) {
      const batch = packets.slice(i, i + 30).map(p => ({ type: p.type, timestamp: Math.round(p.timestamp * 1e6), duration: Math.round(p.duration * 1e6), data: Buffer.from(p.data).toString('base64') }));
      await evaluate(`(()=>{for(const p of ${JSON.stringify(batch)}){p.data=Uint8Array.from(atob(p.data),c=>c.charCodeAt(0));checkDecoder.decode(new EncodedVideoChunk(p));}})()`);
      await evaluate('new Promise(resolve=>setTimeout(resolve,0))');
    }
    const decoded = await evaluate('(async()=>{await checkDecoder.flush();checkDecoder.close();return {times:decodedTimes,errors:decodeErrors}})()');
    assert.deepEqual(decoded.errors, []); assert.equal(decoded.times.length, packets.length, 'Every encoded frame decodes successfully.');
    for (let i = 0; i < decoded.times.length; i++) assert.ok(Math.abs(decoded.times[i] / 1e6 - i / 60) < .0011);
    const colored = await evaluate('nativeColored');
    assert.ok(colored > 200000, 'The native decoder produces a visible race frame.');
    return { frames: packets.length, decodedFrames: decoded.times.length, duration, fps: packets.length / duration, codec: config.codec, colored };
  } finally { input.dispose(); }
}
