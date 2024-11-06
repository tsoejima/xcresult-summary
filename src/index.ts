import { run } from './main'

void (async () => {
  try {
    await run()
  } catch (error) {
    if (error instanceof Error) {
      process.stderr.write(error.message + '\n')
      process.exit(1)
    }
  }
})()
