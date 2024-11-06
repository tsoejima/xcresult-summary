import { BuildResult, TestResult } from './types'

export function generateMarkdownSummary(
  buildResult: BuildResult,
  testResult: TestResult | null
): string {
  const buildDuration = (
    (buildResult.endTime - buildResult.startTime) /
    60
  ).toFixed(2)
  let markdown = ''

  if (buildResult.status !== 'failed' && testResult !== null) {
    markdown += '## Test Statistics\n\n'
    markdown +=
      '| ✅ Passed | ❌ Failed | ⏭️ Skipped | 🔄 Expected | 📊 Total |\n'
    markdown +=
      '|-----------|-----------|------------|-------------|----------|\n'
    markdown += `| ${testResult.passedTests} | ${testResult.failedTests} | ${testResult.skippedTests} | ${testResult.expectedFailures} | ${testResult.totalTestCount} |\n\n`

    markdown += '## Test Results\n\n'
    markdown += `**Duration**: ${((testResult.finishTime - testResult.startTime) / 60).toFixed(2)} minutes\n\n`

    if (testResult.testFailures && testResult.testFailures.length > 0) {
      markdown += '### ❌ Test Failures\n\n'
      markdown += '| Location | Details |\n'
      markdown += '|----------|----------|\n'
      testResult.testFailures.forEach(failure => {
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

        markdown += `| \`${location}\` | ${failureText} |\n`
      })
      markdown += '\n'
    }

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

  markdown += '## Build Results\n\n'
  markdown += `**Status**: ${buildResult.status === 'failed' ? '❌ Failed' : '✅ Passed'}\n`
  markdown += `**Duration**: ${buildDuration} minutes\n\n`

  if (buildResult.destination) {
    markdown += '### Environment\n'
    markdown += `- 📱 Device: ${buildResult.destination.deviceName || 'Unknown'}\n`
    markdown += `- 🖥️ Platform: ${buildResult.destination.platform || 'Unknown'}\n`
    markdown += `- 📦 OS Version: ${buildResult.destination.osVersion || 'Unknown'}\n\n`
  }

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

  if (buildResult.warningCount > 0) {
    markdown += '### ⚠️ Warnings\n\n'
    markdown += `Total Warnings: ${buildResult.warningCount}\n\n`
  }

  if (buildResult.analyzerWarningCount > 0) {
    markdown += '### 🔍 Analyzer Warnings\n\n'
    markdown += `Total Analyzer Warnings: ${buildResult.analyzerWarningCount}\n\n`
  }

  return markdown
}
