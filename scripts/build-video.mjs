import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('public/vendor', { recursive: true });
await build({
  stdin: { contents: "export { Output, BufferTarget, CanvasSource, Mp4OutputFormat, WebMOutputFormat, canEncodeVideo } from 'mediabunny';", resolveDir: process.cwd() },
  bundle: true, format: 'esm', minify: true, target: 'es2022',
  outfile: 'public/vendor/video-codecs.js', legalComments: 'eof',
  banner: { js: '// Mediabunny 1.56.1 · MPL-2.0 · source: https://github.com/Vanilagy/mediabunny/tree/v1.56.1 · see mediabunny-LICENSE.txt' },
});
await copyFile('node_modules/mediabunny/LICENSE', 'public/vendor/mediabunny-LICENSE.txt');
