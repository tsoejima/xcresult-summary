import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as fs from 'fs'

interface ExecOptions extends exec.ExecOptions {
  listeners?: {
    stdout?: (data: Buffer) => void
    stderr?: (data: Buffer) => void
  }
}

export interface BuildResult {
  analyzerWarningCount: number
  analyzerWarnings: unknown[]
  destination?: {
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
    className?: string
    issueType?: string
    message?: string
    sourceURL?: string
    targetName?: string
  }[]
  startTime: number
  status: string
  warningCount: number
  warnings: unknown[]
}

export interface TestResult {
  devicesAndConfigurations?: {
    device?: {
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
    testPlanConfiguration?: {
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
  testFailures?: TestFailure[]
  title: string
  totalTestCount: number
}

interface TestNode {
  children?: TestNode[]
  duration?: string
  name: string
  nodeIdentifier?: string
  nodeType: string
  result: string
}

interface TestDevice {
  architecture: string
  deviceId: string
  deviceName: string
  modelName: string
  osVersion: string
  platform: string
}

interface TestPlanConfiguration {
  configurationId: string
  configurationName: string
}

interface DetailedTestResult {
  devices: TestDevice[]
  testNodes: TestNode[]
  testPlanConfigurations: TestPlanConfiguration[]
}

interface TestFailure {
  failureText?: string
  targetName?: string
  testIdentifier?: number
  testName?: string
  sourceCodeContext?: {
    location?: {
      filePath?: string
      lineNumber?: number
    }
  }
}

export interface XcresultSummaryResult {
  buildResult: BuildResult
  testResult: TestResult | null
}

export async function getXcresultSummary(
  path: string
): Promise<XcresultSummaryResult> {
  let buildOutput = ''
  let testSummaryOutput = ''
  let testDetailsOutput = ''

  const execOptions: ExecOptions = {
    listeners: {
      stdout: (data: Buffer): void => {
        buildOutput += data.toString()
      }
    }
  }

  // ビルド結果を取得
  await exec.exec(
    'xcrun',
    ['xcresulttool', 'get', 'build-results', 'summary', '--path', path],
    execOptions
  )

  let parsedBuildResult: unknown
  let parsedTestResult: unknown = null
  let parsedTestDetails: unknown = null

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
    const testSummaryOptions: ExecOptions = {
      listeners: {
        stdout: (data: Buffer): void => {
          testSummaryOutput += data.toString()
        }
      }
    }

    const testDetailsOptions: ExecOptions = {
      listeners: {
        stdout: (data: Buffer): void => {
          testDetailsOutput += data.toString()
        }
      }
    }

    // テスト結果のサマリーを取得
    await exec.exec(
      'xcrun',
      ['xcresulttool', 'get', 'test-results', 'summary', '--path', path],
      testSummaryOptions
    )

    // テスト結果の詳細を取得
    await exec.exec(
      'xcrun',
      ['xcresulttool', 'get', 'test-results', 'tests', '--path', path],
      testDetailsOptions
    )

    try {
      parsedTestResult = JSON.parse(testSummaryOutput)
      parsedTestDetails = JSON.parse(testDetailsOutput)
    } catch (err) {
      const error =
        err instanceof Error ? err.message : 'Unknown error during JSON parsing'
      throw new Error(`Failed to parse test result JSON: ${error}`)
    }

    if (
      !isTestResult(parsedTestResult) ||
      !isDetailedTestResult(parsedTestDetails)
    ) {
      throw new Error('Invalid test result format')
    }

    // テスト結果に詳細な失敗情報を追加
    if (parsedTestResult.testFailures) {
      parsedTestResult.testFailures = extractTestFailures(parsedTestDetails)
    }
  }

  return {
    buildResult: parsedBuildResult,
    testResult: parsedTestResult as TestResult | null
  }
}

function extractTestFailures(details: DetailedTestResult): TestFailure[] {
  const failures: TestFailure[] = []

  function traverseNodes(nodes: TestNode[]): void {
    for (const node of nodes) {
      if (node.nodeType === 'Test Case' && node.result === 'Failed') {
        const failure: TestFailure = {
          testName: node.name,
          failureText: node.children?.[0]?.name || 'Unknown failure',
          sourceCodeContext: {
            location: extractLocationFromFailureMessage(
              node.children?.[0]?.name || ''
            )
          }
        }
        failures.push(failure)
      }
      if (node.children) {
        traverseNodes(node.children)
      }
    }
  }

  traverseNodes(details.testNodes)
  return failures
}

function extractLocationFromFailureMessage(message: string): {
  filePath?: string
  lineNumber?: number
} {
  const match = message.match(/([^:]+\.swift):(\d+):/)
  if (match) {
    return {
      filePath: match[1],
      lineNumber: parseInt(match[2], 10)
    }
  }
  return {}
}

function isDetailedTestResult(value: unknown): value is DetailedTestResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'testNodes' in value &&
    'devices' in value &&
    'testPlanConfigurations' in value
  )
}

export function generateMarkdownSummary(
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
    if (testResult.testFailures && testResult.testFailures.length > 0) {
      markdown += '### ❌ Test Failures\n\n'
      markdown += '| Test | Location | Details |\n'
      markdown += '|------|----------|----------|\n'
      testResult.testFailures.forEach(failure => {
        const testName = failure.testName || 'Unknown Test'
        const targetName = failure.targetName || 'Unknown Target'
        const failureText = (
          failure.failureText || 'No failure details'
        ).replace(/\n/g, '<br>')

        let location = 'Unknown location'
        if (failure.sourceCodeContext?.location) {
          const workspacePath = process.env.GITHUB_WORKSPACE || ''
          const filePath = failure.sourceCodeContext.location.filePath || ''
          const lineNumber = failure.sourceCodeContext.location.lineNumber
          const relativePath = filePath.replace(workspacePath + '/', '')
          location = lineNumber ? `${relativePath}:${lineNumber}` : relativePath
        }

        markdown += `| **${testName}**<br>*${targetName}* | 📍 \`${location}\` | ${failureText} |\n`
      })
      markdown += '\n'
    }

    // Device Results - 表形式
    if (
      testResult.devicesAndConfigurations &&
      testResult.devicesAndConfigurations.length > 0
    ) {
      markdown += '### 📱 Device Results\n\n'
      markdown += '| Device | Passed | Failed | Skipped | Configuration |\n'
      markdown += '|---------|---------|---------|----------|---------------|\n'
      testResult.devicesAndConfigurations.forEach(config => {
        if (config.device) {
          const deviceName = config.device.deviceName || 'Unknown Device'
          const platform = config.device.platform || 'Unknown Platform'
          const configName =
            config.testPlanConfiguration?.configurationName ||
            'Default Configuration'
          markdown += `| ${deviceName}<br>(${platform}) | ✅ ${config.passedTests} | ❌ ${config.failedTests} | ⏭️ ${config.skippedTests} | ${configName} |\n`
        }
      })
      markdown += '\n'
    }
  }

  // Build Results
  markdown += '## Build Results\n\n'
  markdown += `**Status**: ${buildResult.status === 'failed' ? '❌ Failed' : '✅ Passed'}\n`
  markdown += `**Duration**: ${buildDuration} minutes\n\n`

  // Environment情報が存在する場合のみ表示
  if (buildResult.destination) {
    markdown += '### Environment\n'
    markdown += `- 📱 Device: ${buildResult.destination.deviceName || 'Unknown'}\n`
    markdown += `- 🖥️ Platform: ${buildResult.destination.platform || 'Unknown'}\n`
    markdown += `- 📦 OS Version: ${buildResult.destination.osVersion || 'Unknown'}\n\n`
  }

  // Build Errors
  if (buildResult.errorCount > 0 && buildResult.errors) {
    markdown += '### ❌ Build Errors\n\n'
    markdown += '| Location | Error |\n'
    markdown += '|----------|-------|\n'
    buildResult.errors.forEach(error => {
      const workspacePath = process.env.GITHUB_WORKSPACE || ''
      let filePath = 'Unknown location'

      if (error.sourceURL) {
        const url = error.sourceURL.split('#')[0]
        filePath = url.replace(workspacePath + '/', '') || 'Unknown file'
      }

      const errorMessage = (error.message || 'Unknown error').replace(
        /\n/g,
        '<br>'
      )
      markdown += `| 📍 \`${filePath}\`| ${errorMessage} |\n`
    })
    markdown += '\n'
  }

  // Warning Count
  if (buildResult.warningCount > 0) {
    markdown += '### ⚠️ Warnings\n\n'
    markdown += `Total Warnings: ${buildResult.warningCount}\n\n`
  }

  // Analyzer Warning Count
  if (buildResult.analyzerWarningCount > 0) {
    markdown += '### 🔍 Analyzer Warnings\n\n'
    markdown += `Total Analyzer Warnings: ${buildResult.analyzerWarningCount}\n\n`
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
