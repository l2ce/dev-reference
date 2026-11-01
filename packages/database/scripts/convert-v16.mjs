import { convertSnapshotV16 } from './format-v16.mjs';
import { runConversion } from './conversion-directory.mjs';

await runConversion(convertSnapshotV16, 'convert-v16.mjs', {
  layout: 'separate',
  collectionRenames: { 'chronicle-implementations': 'chronicle-releases' },
});
