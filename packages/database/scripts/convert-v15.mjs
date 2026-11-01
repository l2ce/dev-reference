import { convertSnapshotV15 } from './format-v15.mjs';
import { runConversion } from './conversion-directory.mjs';

await runConversion(convertSnapshotV15, 'convert-v15.mjs', {
  layout: 'separate',
});
