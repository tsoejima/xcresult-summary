import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as fs from 'fs'

interface ExecOptions extends exec.ExecOptions {
  listeners?: {
    stdout?: (data: Buffer) => void
    stderr?: (data: Buffer) => void
  }
}

interface BuildResult {
  analyzerWarningCount: number
  analyzerWarnings: unknown[]
  destination: {
    architecture: string
    deviceId: string
    deviceName: string
    modelName: string
    osVersion: string
    platform: string
  }
  endTime: number
  errorCount: number
  errors: {
    className: string
    issueType: string
    message: string
    sourceURL: string
    targetName: string
  }[]
  startTime: number
  status: string
  warningCount: number
  warnings: unknown[]
}

interface TestResult {
  devicesAndConfigurations: {
    device: {
      architecture: string
      deviceId: string
      deviceName: string
      modelName: string
      osVersion: string
      platform: string
    }
    expectedFailures: number
    failedTests: number
    passedTests: number
    skippedTests: number
    testPlanConfiguration: {
      configurationId: string
      configurationName: string
    }
  }[]
  environmentDescription: string
  expectedFailures: number
  failedTests: number
  finishTime: number
  passedTests: number
  result: string
  skippedTests: number
  startTime: number
  testFailures: {
    failureText: string
    targetName: string
    testIdentifier: number
    testName: string
  }[]
  title: string
  totalTestCount: number
}

async function getXcresultSummary(path: string): Promise<{
  buildResult: BuildResult
  testResult: TestResult | null
}> {
  let buildOutput = ''
  let testOutput = ''

  const execOptions: ExecOptions = {
    listeners: {
      stdout: (data: Buffer) => {
        buildOutput += data.toString()
      }
    }
  }

  // まずビルド結果を取得
  await exec.exec(
    'xcrun',
    ['xcresulttool', 'get', 'build-results', 'summary', '--path', path],
    execOptions
  )

  let parsedBuildResult: unknown
  let parsedTestResult: unknown = null

  try {
    parsedBuildResult = JSON.parse(buildOutput)
  } catch (err) {
    const error =
      err instanceof Error ? err.message : 'Unknown error during JSON parsing'
    throw new Error(`Failed to parse build result JSON: ${error}`)
  }

  if (!isBuildResult(parsedBuildResult)) {
    throw new Error('Invalid build result format')
  }

  // ビルドが成功した場合のみテスト結果を取得
  if (parsedBuildResult.status !== 'failed') {
    const testExecOptions: ExecOptions = {
      listeners: {
        stdout: (data: Buffer) => {
          testOutput += data.toString()
        }
      }
    }

    await exec.exec(
      'xcrun',
      ['xcresulttool', 'get', 'test-results', 'summary', '--path', path],
      testExecOptions
    )

    try {
      parsedTestResult = JSON.parse(testOutput)
    } catch (err) {
      const error =
        err instanceof Error ? err.message : 'Unknown error during JSON parsing'
      throw new Error(`Failed to parse test result JSON: ${error}`)
    }

    if (!isTestResult(parsedTestResult)) {
      throw new Error('Invalid test result format')
    }
  }

  return {
    buildResult: parsedBuildResult,
    testResult: parsedTestResult as TestResult | null
  }
}

function generateMarkdownSummary(
  buildResult: BuildResult,
  testResult: TestResult | null
): string {
  const buildDuration = (
    (buildResult.endTime - buildResult.startTime) /
    60
  ).toFixed(2)
  let markdown = ''

  // ビルドが失敗していない、かつテスト結果が存在する場合のみテスト統計を表示
  if (buildResult.status !== 'failed' && testResult !== null) {
    // Test Statistics - 横並びの表
    markdown += '## Test Statistics\n\n'
    markdown +=
      '| ✅ Passed | ❌ Failed | ⏭️ Skipped | 🔄 Expected | 📊 Total |\n'
    markdown +=
      '|-----------|-----------|------------|-------------|----------|\n'
    markdown += `| ${testResult.passedTests} | ${testResult.failedTests} | ${testResult.skippedTests} | ${testResult.expectedFailures} | ${testResult.totalTestCount} |\n\n`

    // Test Results
    markdown += '## Test Results\n\n'
    markdown += `**Duration**: ${(
      (testResult.finishTime - testResult.startTime) /
      60
    ).toFixed(2)} minutes\n\n`

    // Test Failures - 表形式
    if (testResult.testFailures.length > 0) {
      markdown += '### ❌ Test Failures\n\n'
      markdown += '| Test | Details |\n'
      markdown += '|------|----------|\n'
      testResult.testFailures.forEach(failure => {
        markdown += `| **${failure.testName}**<br>*${failure.targetName}* | ${failure.failureText.replace(/\n/g, '<br>')} |\n`
      })
      markdown += '\n'
    }

    // Device Results - 表形式
    if (testResult.devicesAndConfigurations.length > 0) {
      markdown += '### 📱 Device Results\n\n'
      markdown += '| Device | Passed | Failed | Skipped | Configuration |\n'
      markdown += '|---------|---------|---------|----------|---------------|\n'
      testResult.devicesAndConfigurations.forEach(config => {
        markdown += `| ${config.device.deviceName}<br>(${config.device.platform}) | ✅ ${config.passedTests} | ❌ ${config.failedTests} | ⏭️ ${config.skippedTests} | ${config.testPlanConfiguration.configurationName} |\n`
      })
      markdown += '\n'
    }
  }

  // Build Results
  markdown += '## Build Results\n\n'
  markdown += `**Status**: ${buildResult.status === 'failed' ? '❌ Failed' : '✅ Passed'}\n`
  markdown += `**Duration**: ${buildDuration} minutes\n\n`

  markdown += '### Environment\n'
  markdown += `- 📱 Device: ${buildResult.destination.deviceName}\n`
  markdown += `- 🖥️ Platform: ${buildResult.destination.platform}\n`
  markdown += `- 📦 OS Version: ${buildResult.destination.osVersion}\n\n`

  // Build Errors
  if (buildResult.errorCount > 0) {
    markdown += '### ❌ Build Errors\n\n'
    markdown += '| Location | Error |\n'
    markdown += '|----------|-------|\n'
    buildResult.errors.forEach(error => {
      const workspacePath = process.env.GITHUB_WORKSPACE || ''
      let filePath = 'Unknown location'

      if (error.sourceURL) {
        try {
          filePath =
            error.sourceURL.split('#')[0].replace(workspacePath + '/', '') ||
            'Unknown file'
        } catch {
          filePath = error.sourceURL || 'Unknown file'
        }
      }

      const errorMessage = error.message.replace(/\n/g, '<br>')
      markdown += `| 📍 \`${filePath}\`<br>*${error.issueType}* | ${errorMessage} |\n`
    })
    markdown += '\n'
  }

  return markdown
}

// Type guards
function isBuildResult(value: unknown): value is BuildResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'errorCount' in value &&
    'warningCount' in value
  )
}

function isTestResult(value: unknown): value is TestResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'result' in value &&
    'totalTestCount' in value &&
    'failedTests' in value
  )
}

export async function run(): Promise<void> {
  try {
    const xcresultPath = core.getInput('xcresult-path')

    if (!fs.existsSync(xcresultPath)) {
      throw new Error(`xcresult file not found at path: ${xcresultPath}`)
    }

    process.stdout.write('🔍 Analyzing xcresult...\n')
    const { buildResult, testResult } = await getXcresultSummary(xcresultPath)

    // 結果の概要を出力
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

    // 出力を設定
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

    // Summaryを作成
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
