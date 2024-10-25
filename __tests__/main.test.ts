import { expect, test, jest, describe } from '@jest/globals'

jest.mock('@actions/core', () => ({
  getInput: jest.fn().mockReturnValue(''),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  debug: jest.fn(),
  summary: {
    addRaw: jest.fn().mockReturnThis(),
    write: jest.fn().mockImplementation(() => Promise.resolve())
  }
}))

jest.mock('@actions/exec')

import * as process from 'process'
import * as path from 'path'
import * as fs from 'fs'
import * as exec from '@actions/exec'
import * as core from '@actions/core'
import { run } from '../src/main'

const mockBuildResult = {
  analyzerWarningCount: 0,
  analyzerWarnings: [],
  destination: {
    architecture: 'arm64',
    deviceId: '419F41C8-7B32-43C7-A219-2CD9FE2166A1',
    deviceName: 'iPhone 16 Pro',
    modelName: 'iPhone 16 Pro',
    osVersion: '18.0',
    platform: 'iOS Simulator'
  },
  endTime: 1729870806.836,
  errorCount: 1,
  errors: [
    {
      className: 'DVTTextDocumentLocation',
      issueType: 'Swift Compiler Error',
      message: "Expected ')' in expression list",
      sourceURL: 'file:///path/to/ContentView.swift',
      targetName: 'xcresult-summary-app'
    }
  ],
  startTime: 1729870805.508,
  status: 'failed',
  warningCount: 0,
  warnings: []
}

const mockSuccessBuildResult = {
  ...mockBuildResult,
  errorCount: 0,
  errors: [],
  status: 'succeeded'
}

const mockTestResult = {
  devicesAndConfigurations: [
    {
      device: {
        architecture: 'arm64',
        deviceId: '419F41C8-7B32-43C7-A219-2CD9FE2166A1',
        deviceName: 'iPhone 16 Pro',
        modelName: 'iPhone 16 Pro',
        osVersion: '18.0',
        platform: 'iOS Simulator'
      },
      expectedFailures: 0,
      failedTests: 1,
      passedTests: 6,
      skippedTests: 0,
      testPlanConfiguration: {
        configurationId: '1',
        configurationName: 'Test Scheme Action'
      }
    }
  ],
  environmentDescription: 'xcresult-summary-app · Built with macOS 14.5',
  expectedFailures: 0,
  failedTests: 1,
  finishTime: 1729873371.36,
  passedTests: 3,
  result: 'Failed',
  skippedTests: 0,
  startTime: 1729873161.166,
  testFailures: [
    {
      failureText:
        'The test runner exited with code -1 before finishing running tests.',
      targetName: 'xcresult-summary-appUITests',
      testIdentifier: 2,
      testName: 'testLaunchPerformance()'
    }
  ],
  title: 'Test - xcresult-summary-app',
  totalTestCount: 4
}

const mockSuccessTestResult = {
  ...mockTestResult,
  devicesAndConfigurations: [
    {
      ...mockTestResult.devicesAndConfigurations[0],
      failedTests: 0,
      passedTests: 7
    }
  ],
  failedTests: 0,
  testFailures: [],
  result: 'Success',
  passedTests: 4,
  totalTestCount: 4
}

describe('xcresult-summary action', () => {
  let testXcresultPath: string

  beforeEach(() => {
    jest.clearAllMocks()

    const originalEnv = { ...process.env }
    Object.keys(process.env).forEach(key => {
      delete process.env[key]
    })
    Object.keys(originalEnv).forEach(key => {
      process.env[key] = originalEnv[key]
    })

    testXcresultPath = path.join(__dirname, 'test.xcresult')
    fs.writeFileSync(testXcresultPath, '')

    let callCount = 0
    jest
      .mocked(exec.exec)
      .mockImplementation(async (_, args, options?: exec.ExecOptions) => {
        if (options?.listeners?.stdout) {
          const mockData = callCount === 0 ? mockBuildResult : mockTestResult
          options.listeners.stdout(Buffer.from(JSON.stringify(mockData)))
          callCount++
        }
        return 0
      })
  })

  afterEach(() => {
    if (fs.existsSync(testXcresultPath)) {
      fs.unlinkSync(testXcresultPath)
    }
  })

  test('executes correct xcrun commands', async () => {
    jest.mocked(core.getInput).mockReturnValue(testXcresultPath)

    await run()

    expect(exec.exec).toHaveBeenCalledTimes(2)
    expect(exec.exec).toHaveBeenNthCalledWith(
      1,
      'xcrun',
      [
        'xcresulttool',
        'get',
        'build-results',
        'summary',
        '--path',
        testXcresultPath
      ],
      expect.any(Object)
    )
    expect(exec.exec).toHaveBeenNthCalledWith(
      2,
      'xcrun',
      [
        'xcresulttool',
        'get',
        'test-results',
        'summary',
        '--path',
        testXcresultPath
      ],
      expect.any(Object)
    )
  })

  test('generates complete summary with both build and test results', async () => {
    jest.mocked(core.getInput).mockReturnValue(testXcresultPath)

    await run()

    const summaryCall = jest.mocked(core.summary.addRaw).mock.calls[0][0]

    expect(summaryCall).toContain('## Build Summary')
    expect(summaryCall).toContain('### Build Results')
    expect(summaryCall).toContain('**Status**: ❌ Failed')
    expect(summaryCall).toContain('### Environment')
    expect(summaryCall).toContain('Platform: iOS Simulator')
    expect(summaryCall).toContain('Device: iPhone 16 Pro')
    expect(summaryCall).toContain('OS Version: 18.0')
    expect(summaryCall).toContain('### Build Statistics')
    expect(summaryCall).toContain('Errors: 1')
    expect(summaryCall).toContain('## Test Summary')
    expect(summaryCall).toContain('Total Tests: 4')
    expect(summaryCall).toContain('Passed: 3')
    expect(summaryCall).toContain('Failed: 1')
    expect(summaryCall).toContain('### Device-specific Results')
    expect(summaryCall).toContain('iPhone 16 Pro (iOS Simulator)')
    expect(summaryCall).toContain('### Test Failures')
    expect(summaryCall).toContain('testLaunchPerformance()')
  })

  test('handles successful build and test results', async () => {
    let callCount = 0
    jest
      .mocked(exec.exec)
      .mockImplementation(async (_, args, options?: exec.ExecOptions) => {
        if (options?.listeners?.stdout) {
          const mockData =
            callCount === 0 ? mockSuccessBuildResult : mockSuccessTestResult
          options.listeners.stdout(Buffer.from(JSON.stringify(mockData)))
          callCount++
        }
        return 0
      })

    jest.mocked(core.getInput).mockReturnValue(testXcresultPath)

    await run()

    const summaryCall = jest.mocked(core.summary.addRaw).mock.calls[0][0]
    expect(summaryCall).toContain('**Status**: ✅ Passed')
    expect(summaryCall).not.toContain('### Test Failures')
    expect(summaryCall).toContain('Passed: 4')
    expect(summaryCall).toContain('Failed: 0')
    expect(summaryCall).toContain('### Build Statistics')
    expect(summaryCall).toContain('Errors: 0')
  })

  test('outputs correct test statistics', async () => {
    jest.mocked(core.getInput).mockReturnValue(testXcresultPath)

    await run()

    expect(core.setOutput).toHaveBeenCalledWith('total-tests', 4)
    expect(core.setOutput).toHaveBeenCalledWith('failed-tests', 1)
    expect(core.setOutput).toHaveBeenCalledWith('passed-tests', 3)
  })

  test('handles missing test results gracefully', async () => {
    let callCount = 0
    jest
      .mocked(exec.exec)
      .mockImplementation(async (_, args, options?: exec.ExecOptions) => {
        if (options?.listeners?.stdout) {
          const mockData =
            callCount === 0
              ? mockBuildResult
              : {
                  devicesAndConfigurations: [],
                  failedTests: 0,
                  passedTests: 0,
                  skippedTests: 0,
                  testFailures: [],
                  totalTestCount: 0,
                  result: 'Success',
                  startTime: 0,
                  finishTime: 0
                }
          options.listeners.stdout(Buffer.from(JSON.stringify(mockData)))
          callCount++
        }
        return 0
      })

    jest.mocked(core.getInput).mockReturnValue(testXcresultPath)

    await run()

    const summaryCall = jest.mocked(core.summary.addRaw).mock.calls[0][0]
    expect(summaryCall).toContain('## Test Summary')
    expect(summaryCall).toContain('Total Tests: 0')
    expect(summaryCall).not.toContain('### Device-specific Results')
  })

  test('handles invalid JSON in test results', async () => {
    let callCount = 0
    jest
      .mocked(exec.exec)
      .mockImplementation(async (_, args, options?: exec.ExecOptions) => {
        if (options?.listeners?.stdout) {
          if (callCount === 0) {
            options.listeners.stdout(
              Buffer.from(JSON.stringify(mockBuildResult))
            )
          } else {
            options.listeners.stdout(Buffer.from('Invalid JSON'))
          }
          callCount++
        }
        return 0
      })

    jest.mocked(core.getInput).mockReturnValue(testXcresultPath)

    await run()

    expect(core.setFailed).toHaveBeenCalled()
  })

  test('handles command execution errors', async () => {
    jest
      .mocked(exec.exec)
      .mockRejectedValue(new Error('Command execution failed'))

    jest.mocked(core.getInput).mockReturnValue(testXcresultPath)

    await run()

    expect(core.setFailed).toHaveBeenCalled()
    expect(core.setFailed).toHaveBeenCalledWith('Command execution failed')
  })

  test('handles missing xcresult path', async () => {
    jest.mocked(core.getInput).mockReturnValue('/non/existent/path.xcresult')

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'xcresult file not found at path: /non/existent/path.xcresult'
    )
  })
})
