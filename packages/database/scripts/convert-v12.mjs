import { convertSnapshotV12 } from './format-v12.mjs'
import { runConversion } from './conversion-directory.mjs'

await runConversion(convertSnapshotV12, 'convert-v12.mjs')
