import { convertSnapshotV17 } from './format-v17.mjs'
import { runConversion } from './conversion-directory.mjs'

await runConversion(convertSnapshotV17, 'convert-v17.mjs', {
  layout: 'separate'
})
