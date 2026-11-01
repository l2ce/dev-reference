import { convertSnapshotV11 } from './format-v11.mjs'
import { runConversion } from './conversion-directory.mjs'

await runConversion(convertSnapshotV11, 'convert-v11.mjs')
