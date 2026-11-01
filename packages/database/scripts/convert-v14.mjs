import { convertSnapshotV14 } from './format-v14.mjs';
import { runConversion } from './conversion-directory.mjs';

await runConversion(convertSnapshotV14, 'convert-v14.mjs', {
  layout: 'separate',
});
