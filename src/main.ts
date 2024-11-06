import * as core from '@actions/core'
import * as fs from 'fs'
import { getXcresultSummary } from './xcresult-parser'
import { generateMarkdownSummary } from './markdown-generator'
import { BuildResult, TestResult } from './types'

export { getXcresultSummary, generateMarkdownSummary, BuildResult, TestResult }

export async function run(): Promise<void> {
  try {
    const xcresultPath = core.getInput('xcresult-path')

    if (!fs.existsSync(xcresultPath)) {
      throw new Error(`xcresult file not found at path: ${xcresultPath}`)
    }

    process.stdout.write('🔍 Analyzing xcresult...\n')
    const { buildResult, testResult } = await getXcresultSummary(xcresultPath)

    if (buildResult.errorCount > 0) {
      process.stdout.write(
        `❌ Build failed with ${buildResult.errorCount} errors\n`
      )
    } else if (testResult && testResult.failedTests > 0) {
      process.stdout.write(
        `❌ Tests completed with ${testResult.failedTests} failures\n`
      )
    } else if (testResult) {
      process.stdout.write('✅ All tests passed successfully\n')
    }

    const markdownSummary = generateMarkdownSummary(buildResult, testResult)

    if (testResult) {
      core.setOutput('total-tests', testResult.totalTestCount)
      core.setOutput('failed-tests', testResult.failedTests)
      core.setOutput('passed-tests', testResult.passedTests)
    } else {
      core.setOutput('total-tests', 0)
      core.setOutput('failed-tests', 0)
      core.setOutput('passed-tests', 0)
    }
    core.setOutput('build-status', buildResult.status)
    core.setOutput('error-count', buildResult.errorCount)
    core.setOutput('warning-count', buildResult.warningCount)

    await core.summary.addRaw(markdownSummary).write()
  } catch (error) {
    if (error instanceof Error) {
      process.stderr.write(`❌ Error: ${error.message}\n`)
      await core.summary
        .addHeading('Error')
        .addRaw(`❌ ${error.message}`)
        .write()
      core.setFailed(error.message)
    }
  }
}
