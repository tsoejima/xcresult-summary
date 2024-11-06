import { BuildResult, TestResult } from '../src/types'
import { generateMarkdownSummary } from '../src/markdown-generator'

describe('generateMarkdownSummary', () => {
  it('generates markdown for successful build with test results', () => {
    const buildResult: BuildResult = {
      status: 'succeeded',
      errorCount: 0,
      warningCount: 0,
      analyzerWarningCount: 0,
      startTime: 0,
      endTime: 300,
      errors: [],
      warnings: [],
      analyzerWarnings: [],
      destination: {
        deviceName: 'iPhone 14',
        platform: 'iOS',
        osVersion: '16.0',
        architecture: 'arm64',
        deviceId: 'ABCD1234',
        modelName: 'iPhone14,2'
      }
    }

    const testResult: TestResult = {
      totalTestCount: 100,
      failedTests: 2,
      passedTests: 95,
      skippedTests: 3,
      expectedFailures: 0,
      startTime: 0,
      finishTime: 180,
      result: 'success',
      environmentDescription: '',
      title: '',
      testFailures: [
        {
          failureText: 'Test failed',
          sourceCodeContext: {
            location: {
              filePath: '/path/to/test.swift',
              lineNumber: 42
            }
          }
        }
      ],
      devicesAndConfigurations: [
        {
          device: {
            deviceName: 'iPhone 14',
            platform: 'iOS',
            osVersion: '16.0',
            architecture: 'arm64',
            deviceId: 'ABCD1234',
            modelName: 'iPhone14,2'
          },
          testPlanConfiguration: {
            configurationName: 'Default',
            configurationId: 'default-config-id'
          },
          passedTests: 95,
          failedTests: 2,
          skippedTests: 3,
          expectedFailures: 0
        }
      ]
    }

    const markdown = generateMarkdownSummary(buildResult, testResult)

    expect(markdown).toContain('## Test Statistics\n\n')
    expect(markdown).toContain(
      '| ✅ Passed | ❌ Failed | ⏭️ Skipped | 🔄 Expected | 📊 Total |'
    )
    expect(markdown).toContain(
      '|-----------|-----------|------------|-------------|----------|'
    )
    expect(markdown).toContain('| 95 | 2 | 3 | 0 | 100 |')

    expect(markdown).toContain('## Test Results\n\n')
    expect(markdown).toContain('**Duration**: 3.00 minutes\n\n')

    expect(markdown).toContain('### ❌ Test Failures\n\n')
    expect(markdown).toContain('| Location | Details |')
    expect(markdown).toContain('|----------|----------|')
    expect(markdown).toContain('| `path/to/test.swift:42` | Test failed |')

    expect(markdown).toContain('### 📱 Device Results\n\n')
    expect(markdown).toContain(
      '| Device | Passed | Failed | Skipped | Configuration |'
    )
    expect(markdown).toContain(
      '|---------|---------|---------|----------|---------------|'
    )
    expect(markdown).toContain(
      '| iPhone 14<br>(iOS) | ✅ 95 | ❌ 2 | ⏭️ 3 | Default |'
    )

    expect(markdown).toContain('## Build Results\n\n')
    expect(markdown).toContain('**Status**: ✅ Passed\n')
    expect(markdown).toContain('**Duration**: 5.00 minutes\n\n')

    expect(markdown).toContain('### Environment\n')
    expect(markdown).toContain('- 📱 Device: iPhone 14\n')
    expect(markdown).toContain('- 🖥️ Platform: iOS\n')
    expect(markdown).toContain('- 📦 OS Version: 16.0\n')
  })

  it('generates markdown for failed build without test results', () => {
    const buildResult: BuildResult = {
      status: 'failed',
      errorCount: 2,
      warningCount: 1,
      analyzerWarningCount: 1,
      startTime: 0,
      endTime: 180,
      errors: [
        {
          sourceURL: '/path/to/error.swift',
          message: 'Build error occurred'
        }
      ],
      warnings: [],
      analyzerWarnings: []
    }

    const markdown = generateMarkdownSummary(buildResult, null)

    expect(markdown).not.toContain('## Test Statistics')
    expect(markdown).toContain('## Build Results\n\n')
    expect(markdown).toContain('**Status**: ❌ Failed\n')
    expect(markdown).toContain('**Duration**: 3.00 minutes\n\n')

    expect(markdown).toContain('### ❌ Build Errors\n\n')
    expect(markdown).toContain('| Location | Error |')
    expect(markdown).toContain('|----------|-------|')
    expect(markdown).toContain(
      '| 📍 `path/to/error.swift`| Build error occurred |'
    )

    expect(markdown).toContain('### ⚠️ Warnings\n\n')
    expect(markdown).toContain('Total Warnings: 1\n\n')

    expect(markdown).toContain('### 🔍 Analyzer Warnings\n\n')
    expect(markdown).toContain('Total Analyzer Warnings: 1\n\n')
  })

  it('handles missing device and configuration information', () => {
    const buildResult: BuildResult = {
      status: 'succeeded',
      errorCount: 0,
      warningCount: 0,
      analyzerWarningCount: 0,
      startTime: 0,
      endTime: 60,
      errors: [],
      warnings: [],
      analyzerWarnings: []
    }

    const testResult: TestResult = {
      totalTestCount: 10,
      failedTests: 0,
      passedTests: 10,
      skippedTests: 0,
      expectedFailures: 0,
      startTime: 0,
      finishTime: 30,
      result: 'success',
      environmentDescription: '',
      title: ''
    }

    const markdown = generateMarkdownSummary(buildResult, testResult)

    expect(markdown).toContain('## Test Statistics\n\n')
    expect(markdown).toContain(
      '| ✅ Passed | ❌ Failed | ⏭️ Skipped | 🔄 Expected | 📊 Total |'
    )
    expect(markdown).toContain(
      '|-----------|-----------|------------|-------------|----------|'
    )
    expect(markdown).toContain('| 10 | 0 | 0 | 0 | 10 |')

    expect(markdown).toContain('## Build Results\n\n')
    expect(markdown).toContain('**Status**: ✅ Passed\n')
    expect(markdown).toContain('**Duration**: 1.00 minutes\n\n')

    expect(markdown).not.toContain('### Environment')
    expect(markdown).not.toContain('### 📱 Device Results')
  })

  it('handles test failures without source code context', () => {
    const buildResult: BuildResult = {
      status: 'succeeded',
      errorCount: 0,
      warningCount: 0,
      analyzerWarningCount: 0,
      startTime: 0,
      endTime: 60,
      errors: [],
      warnings: [],
      analyzerWarnings: []
    }

    const testResult: TestResult = {
      totalTestCount: 10,
      failedTests: 1,
      passedTests: 9,
      skippedTests: 0,
      expectedFailures: 0,
      startTime: 0,
      finishTime: 30,
      result: 'failure',
      environmentDescription: '',
      title: '',
      testFailures: [
        {
          failureText: 'Test failed without location'
        }
      ]
    }

    const markdown = generateMarkdownSummary(buildResult, testResult)

    expect(markdown).toContain('### ❌ Test Failures\n\n')
    expect(markdown).toContain('| Location | Details |')
    expect(markdown).toContain('|----------|----------|')
    expect(markdown).toContain(
      '| `Unknown location` | Test failed without location |'
    )
  })
})
