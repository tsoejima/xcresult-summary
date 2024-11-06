import * as exec from '@actions/exec'
import {
  BuildResult,
  TestResult,
  DetailedTestResult,
  XcresultSummaryResult
} from './types'
import * as utils from './utils'

export async function getXcresultSummary(
  path: string
): Promise<XcresultSummaryResult> {
  let buildOutput = ''
  let testSummaryOutput = ''
  let testDetailsOutput = ''

  const execOptions = {
    listeners: {
      stdout: (data: Buffer): void => {
        buildOutput += data.toString()
      }
    }
  }

  await exec.exec(
    'xcrun',
    ['xcresulttool', 'get', 'build-results', 'summary', '--path', path],
    execOptions
  )

  let parsedBuildResult: BuildResult
  let parsedTestResult: TestResult | null = null
  let parsedTestDetails: DetailedTestResult | null = null

  try {
    parsedBuildResult = JSON.parse(buildOutput) as BuildResult
  } catch (err) {
    const error =
      err instanceof Error ? err.message : 'Unknown error during JSON parsing'
    throw new Error(`Failed to parse build result JSON: ${error}`)
  }

  if (!utils.isBuildResult(parsedBuildResult)) {
    throw new Error('Invalid build result format')
  }

  if (parsedBuildResult.status !== 'failed') {
    const testSummaryOptions = {
      listeners: {
        stdout: (data: Buffer): void => {
          testSummaryOutput += data.toString()
        }
      }
    }

    const testDetailsOptions = {
      listeners: {
        stdout: (data: Buffer): void => {
          testDetailsOutput += data.toString()
        }
      }
    }

    await exec.exec(
      'xcrun',
      ['xcresulttool', 'get', 'test-results', 'summary', '--path', path],
      testSummaryOptions
    )

    await exec.exec(
      'xcrun',
      ['xcresulttool', 'get', 'test-results', 'tests', '--path', path],
      testDetailsOptions
    )

    try {
      parsedTestResult = JSON.parse(testSummaryOutput) as TestResult
      parsedTestDetails = JSON.parse(testDetailsOutput) as DetailedTestResult
    } catch (err) {
      const error =
        err instanceof Error ? err.message : 'Unknown error during JSON parsing'
      throw new Error(`Failed to parse test result JSON: ${error}`)
    }

    if (
      !utils.isTestResult(parsedTestResult) ||
      !utils.isDetailedTestResult(parsedTestDetails)
    ) {
      throw new Error('Invalid test result format')
    }

    if (parsedTestResult.testFailures) {
      parsedTestResult.testFailures =
        utils.extractTestFailures(parsedTestDetails)
    }
  }

  return {
    buildResult: parsedBuildResult,
    testResult: parsedTestResult
  }
}
