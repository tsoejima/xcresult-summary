import { expect, test, jest, describe } from '@jest/globals'

jest.mock('@actions/core', () => ({
  getInput: jest.fn().mockReturnValue(''),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  startGroup: jest.fn(),
  endGroup: jest.fn(),
  summary: {
    addRaw: jest.fn().mockReturnThis(),
    addHeading: jest.fn().mockReturnThis(),
    write: async () => Promise.resolve()
  }
}))

jest.mock('@actions/exec')

import * as path from 'path'
import * as fs from 'fs'
import * as exec from '@actions/exec'
import * as core from '@actions/core'
import { run } from '../src/main'

// 成功時のビルド結果モック
const mockSuccessfulBuildResult = {
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
  errorCount: 0,
  errors: [],
  startTime: 1729870805.508,
  status: 'succeeded',
  warningCount: 0,
  warnings: []
}

// 失敗時のビルド結果モック
const mockFailedBuildResult = {
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

// 成功時のテスト結果モック
const mockSuccessfulTestResult = {
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
      failedTests: 0,
      passedTests: 4,
      skippedTests: 0,
      testPlanConfiguration: {
        configurationId: '1',
        configurationName: 'Test Scheme Action'
      }
    }
  ],
  environmentDescription: 'xcresult-summary-app · Built with macOS 14.5',
  expectedFailures: 0,
  failedTests: 0,
  finishTime: 1729873371.36,
  passedTests: 4,
  result: 'succeeded',
  skippedTests: 0,
  startTime: 1729873161.166,
  testFailures: [],
  title: 'Test - xcresult-summary-app',
  totalTestCount: 4
}

// 失敗時のテスト結果モック
const mockFailedTestResult = {
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
      passedTests: 3,
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
  result: 'failed',
  skippedTests: 0,
  startTime: 1729873161.166,
  testFailures: [
    {
      failureText: 'Test failed with error: Something went wrong',
      targetName: 'xcresult-summary-appTests',
      testIdentifier: 1,
      testName: 'testExample()'
    }
  ],
  title: 'Test - xcresult-summary-app',
  totalTestCount: 4
}

describe('xcresult-summary action', () => {
  let testXcresultPath: string
  let mockExec: jest.MockedFunction<typeof exec.exec>
  let mockGetInput: jest.MockedFunction<typeof core.getInput>
  let mockSetOutput: jest.MockedFunction<typeof core.setOutput>

  beforeEach(async () => {
    jest.clearAllMocks()

    testXcresultPath = path.join(__dirname, 'test.xcresult')
    await fs.promises.writeFile(testXcresultPath, '')

    mockExec = jest.mocked(exec.exec)
    mockGetInput = jest.mocked(core.getInput)
    mockSetOutput = jest.mocked(core.setOutput)
  })

  afterEach(async () => {
    if (fs.existsSync(testXcresultPath)) {
      await fs.promises.unlink(testXcresultPath)
    }
    jest.restoreAllMocks()
  })

  test('successfully processes build and test results when both succeed', async () => {
    mockGetInput.mockReturnValue(testXcresultPath)
    let callCount = 0
    mockExec.mockImplementation(async (_, args, options?: exec.ExecOptions) => {
      if (options?.listeners?.stdout) {
        const mockData =
          callCount === 0 ? mockSuccessfulBuildResult : mockSuccessfulTestResult
        await Promise.resolve(
          options.listeners.stdout(Buffer.from(JSON.stringify(mockData)))
        )
        callCount++
      }
      return Promise.resolve(0)
    })

    await run()

    expect(mockExec).toHaveBeenCalledTimes(2)
    expect(mockSetOutput).toHaveBeenCalledWith('build-status', 'succeeded')
    expect(mockSetOutput).toHaveBeenCalledWith('total-tests', 4)
    expect(mockSetOutput).toHaveBeenCalledWith('passed-tests', 4)
    expect(mockSetOutput).toHaveBeenCalledWith('failed-tests', 0)
  })

  test('handles build failure and skips test results', async () => {
    mockGetInput.mockReturnValue(testXcresultPath)
    mockExec.mockImplementation(async (_, args, options?: exec.ExecOptions) => {
      if (options?.listeners?.stdout) {
        await Promise.resolve(
          options.listeners.stdout(
            Buffer.from(JSON.stringify(mockFailedBuildResult))
          )
        )
      }
      return Promise.resolve(0)
    })

    await run()

    expect(mockExec).toHaveBeenCalledTimes(1)
    expect(mockSetOutput).toHaveBeenCalledWith('build-status', 'failed')
    expect(mockSetOutput).toHaveBeenCalledWith('error-count', 1)
  })

  test('handles successful build with failed tests', async () => {
    mockGetInput.mockReturnValue(testXcresultPath)
    let callCount = 0
    mockExec.mockImplementation(async (_, args, options?: exec.ExecOptions) => {
      if (options?.listeners?.stdout) {
        const mockData =
          callCount === 0 ? mockSuccessfulBuildResult : mockFailedTestResult
        await Promise.resolve(
          options.listeners.stdout(Buffer.from(JSON.stringify(mockData)))
        )
        callCount++
      }
      return Promise.resolve(0)
    })

    await run()

    expect(mockExec).toHaveBeenCalledTimes(2)
    expect(mockSetOutput).toHaveBeenCalledWith('build-status', 'succeeded')
    expect(mockSetOutput).toHaveBeenCalledWith('total-tests', 4)
    expect(mockSetOutput).toHaveBeenCalledWith('passed-tests', 3)
    expect(mockSetOutput).toHaveBeenCalledWith('failed-tests', 1)
  })

  test('handles build results without destination info', async () => {
    mockGetInput.mockReturnValue(testXcresultPath)
    const buildResultWithoutDestination = {
      ...mockFailedBuildResult,
      destination: undefined,
      errors: [
        {
          message: 'Build error message',
          issueType: 'Error'
        }
      ]
    }

    mockExec.mockImplementation(async (_, args, options?: exec.ExecOptions) => {
      if (options?.listeners?.stdout) {
        await Promise.resolve(
          options.listeners.stdout(
            Buffer.from(JSON.stringify(buildResultWithoutDestination))
          )
        )
      }
      return Promise.resolve(0)
    })

    await run()

    expect(mockExec).toHaveBeenCalledTimes(1)
    expect(mockSetOutput).toHaveBeenCalledWith('build-status', 'failed')
  })

  test('handles empty test results', async () => {
    mockGetInput.mockReturnValue(testXcresultPath)
    const emptyTestResult = {
      devicesAndConfigurations: [],
      environmentDescription: '',
      expectedFailures: 0,
      failedTests: 0,
      finishTime: 0,
      passedTests: 0,
      result: 'unknown',
      skippedTests: 0,
      startTime: 0,
      testFailures: [],
      title: '',
      totalTestCount: 0
    }

    let callCount = 0
    mockExec.mockImplementation(async (_, args, options?: exec.ExecOptions) => {
      if (options?.listeners?.stdout) {
        const mockData =
          callCount === 0 ? mockSuccessfulBuildResult : emptyTestResult
        await Promise.resolve(
          options.listeners.stdout(Buffer.from(JSON.stringify(mockData)))
        )
        callCount++
      }
      return Promise.resolve(0)
    })

    await run()

    expect(mockExec).toHaveBeenCalledTimes(2)
    expect(mockSetOutput).toHaveBeenCalledWith('total-tests', 0)
    expect(mockSetOutput).toHaveBeenCalledWith('passed-tests', 0)
    expect(mockSetOutput).toHaveBeenCalledWith('failed-tests', 0)
  })

  test('handles invalid xcresult path', async () => {
    mockGetInput.mockReturnValue('invalid/path.xcresult')

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('xcresult file not found')
    )
  })

  test('handles JSON parsing errors', async () => {
    mockGetInput.mockReturnValue(testXcresultPath)
    mockExec.mockImplementation(async (_, args, options?: exec.ExecOptions) => {
      if (options?.listeners?.stdout) {
        await Promise.resolve(
          options.listeners.stdout(Buffer.from('Invalid JSON'))
        )
      }
      return Promise.resolve(0)
    })

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse')
    )
  })
})
