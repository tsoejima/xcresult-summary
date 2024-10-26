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
  testResult: TestResult
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

  const testExecOptions: ExecOptions = {
    listeners: {
      stdout: (data: Buffer) => {
        testOutput += data.toString()
      }
    }
  }

  await exec.exec(
    'xcrun',
    ['xcresulttool', 'get', 'build-results', 'summary', '--path', path],
    execOptions
  )

  await exec.exec(
    'xcrun',
    ['xcresulttool', 'get', 'test-results', 'summary', '--path', path],
    testExecOptions
  )

  let parsedBuildResult: unknown
  let parsedTestResult: unknown

  try {
    parsedBuildResult = JSON.parse(buildOutput)
    parsedTestResult = JSON.parse(testOutput)
  } catch (err) {
    const error =
      err instanceof Error ? err.message : 'Unknown error during JSON parsing'
    throw new Error(`Failed to parse JSON output: ${error}`)
  }

  if (!isBuildResult(parsedBuildResult)) {
    throw new Error('Invalid build result format')
  }

  if (!isTestResult(parsedTestResult)) {
    throw new Error('Invalid test result format')
  }

  return {
    buildResult: parsedBuildResult,
    testResult: parsedTestResult
  }
}

function generateMarkdownSummary(
  buildResult: BuildResult,
  testResult: TestResult
): string {
  const buildDuration = (
    (buildResult.endTime - buildResult.startTime) /
    60
  ).toFixed(2)
  const testDuration = (
    (testResult.finishTime - testResult.startTime) /
    60
  ).toFixed(2)
  let markdown = ''

  // ビルドが失敗した場合はテスト統計を表示しない
  if (buildResult.status !== 'failed') {
    // Test Statistics Table
    markdown += '## Test Statistics\n\n'
    markdown += '| Status | Count |\n'
    markdown += '|--------|-------|\n'
    markdown += `| ✅ Passed | ${testResult.passedTests} |\n`
    markdown += `| ❌ Failed | ${testResult.failedTests} |\n`
    markdown += `| ⏭️ Skipped | ${testResult.skippedTests} |\n`
    markdown += `| 🔄 Expected Failures | ${testResult.expectedFailures} |\n`
    markdown += `| 📊 Total | ${testResult.totalTestCount} |\n\n`
  }

  // Build Results
  markdown += '## Build Results\n\n'
  markdown += `**Status**: ${buildResult.status === 'failed' ? '❌ Failed' : '✅ Passed'}\n`
  markdown += `**Duration**: ${buildDuration} minutes\n\n`

  // Build Environment
  markdown += '### Environment\n'
  markdown += `- 📱 Device: ${buildResult.destination.deviceName}\n`
  markdown += `- 🖥️ Platform: ${buildResult.destination.platform}\n`
  markdown += `- 📦 OS Version: ${buildResult.destination.osVersion}\n\n`

  // Build Errors (if any)
  if (buildResult.errorCount > 0) {
    markdown += '### ❌ Build Errors\n\n'
    markdown += '| Location | Error |\n'
    markdown += '|----------|-------|\n'
    buildResult.errors.forEach(error => {
      // ファイルパスをプロジェクトルートからの相対パスに変換
      const filePath = error.sourceURL.split('/').slice(-3).join('/')
      // エラーメッセージを整形（必要に応じて改行を置換）
      const errorMessage = error.message.replace(/\n/g, '<br>')
      markdown += `| 📍 \`${filePath}\`<br>*${error.issueType}* | ${errorMessage} |\n`
    })
    markdown += '\n'
  }

  // Test Results (only if build succeeded)
  if (buildResult.status !== 'failed') {
    markdown += '## Test Results\n\n'
    markdown += `**Duration**: ${testDuration} minutes\n\n`

    // Test Failures (if any)
    if (testResult.testFailures.length > 0) {
      markdown += '### Test Failures\n\n'
      testResult.testFailures.forEach(failure => {
        markdown += `❌ **${failure.testName}** (${failure.targetName})\n`
        markdown += `${failure.failureText}\n\n`
      })
    }

    // Device-specific results
    if (testResult.devicesAndConfigurations.length > 0) {
      markdown += '### Device Results\n\n'
      testResult.devicesAndConfigurations.forEach(config => {
        markdown += `#### ${config.device.deviceName} (${config.device.platform})\n`
        markdown += `- ✅ Passed: ${config.passedTests}\n`
        markdown += `- ❌ Failed: ${config.failedTests}\n`
        markdown += `- ⏭️ Skipped: ${config.skippedTests}\n`
        markdown += `- ⚙️ Configuration: ${config.testPlanConfiguration.configurationName}\n\n`
      })
    }
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
    } else if (testResult.failedTests > 0) {
      process.stdout.write(
        `❌ Tests completed with ${testResult.failedTests} failures\n`
      )
    } else {
      process.stdout.write('✅ All tests passed successfully\n')
    }

    const markdownSummary = generateMarkdownSummary(buildResult, testResult)

    // 出力を設定
    core.setOutput('total-tests', testResult.totalTestCount)
    core.setOutput('failed-tests', testResult.failedTests)
    core.setOutput('passed-tests', testResult.passedTests)
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
