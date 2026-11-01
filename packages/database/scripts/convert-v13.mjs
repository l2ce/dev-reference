import { convertSnapshotV13 } from './format-v13.mjs'
import { runConversion } from './conversion-directory.mjs'

await runConversion(convertSnapshotV13, 'convert-v13.mjs')
