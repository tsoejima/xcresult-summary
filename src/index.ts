// src/index.ts
import { run } from './main'

void (async () => {
  try {
    await run()
  } catch (error) {
    // エラーがあれば標準エラー出力に書き込む
    if (error instanceof Error) {
      process.stderr.write(error.message + '\n')
      process.exit(1)
    }
  }
})()
