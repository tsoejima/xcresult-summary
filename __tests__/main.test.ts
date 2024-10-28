import { expect, test, jest, describe } from '@jest/globals'

// モックの設定
const mockAddRaw = jest.fn().mockReturnThis()
const mockWrite = jest.fn().mockImplementation(async () => {})

jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  summary: {
    addRaw: mockAddRaw,
    addHeading: jest.fn().mockReturnThis(),
    write: mockWrite
  }
}))

jest.mock('@actions/exec')

import * as path from 'path'
import * as fs from 'fs'
import * as exec from '@actions/exec'
import * as core from '@actions/core'
import {
  run,
  getXcresultSummary,
  generateMarkdownSummary,
  BuildResult,
  TestResult
} from '../src/main'

// 成功時のビルド結果モック
const mockSuccessfulBuildResult: BuildResult = {
  analyzerWarningCount: 0,
  analyzerWarnings: [],
  destination: {
    architecture: 'arm64',
    deviceId: '123',
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
const mockFailedBuildResult: BuildResult = {
  analyzerWarningCount: 0,
  analyzerWarnings: [],
  destination: {
    architecture: 'arm64',
    deviceId: '123',
    deviceName: 'iPhone 16 Pro',
    modelName: 'iPhone 16 Pro',
    osVersion: '18.0',
    platform: 'iOS Simulator'
  },
  endTime: 1729870806.836,
  errorCount: 1,
  errors: [
    {
      className: 'CompileError',
      issueType: 'Swift Compiler Error',
      message: 'Cannot find type "Missing" in scope',
      sourceURL: 'file:///path/to/error.swift',
      targetName: 'TestTarget'
    }
  ],
  startTime: 1729870805.508,
  status: 'failed',
  warningCount: 0,
  warnings: []
}

// 成功時のテスト結果モック
const mockSuccessfulTestResult: TestResult = {
  devicesAndConfigurations: [
    {
      device: {
        architecture: 'arm64',
        deviceId: '123',
        deviceName: 'iPhone 16 Pro',
        modelName: 'iPhone 16 Pro',
        osVersion: '18.0',
        platform: 'iOS Simulator'
      },
      expectedFailures: 0,
      failedTests: 0,
      passedTests: 3,
      skippedTests: 0,
      testPlanConfiguration: {
        configurationId: '1',
        configurationName: 'Default'
      }
    }
  ],
  environmentDescription: 'Test Environment',
  expectedFailures: 0,
  failedTests: 0,
  finishTime: 1729873371.36,
  passedTests: 3,
  result: 'succeeded',
  skippedTests: 0,
  startTime: 1729873161.166,
  testFailures: [],
  title: 'Test Results',
  totalTestCount: 3
}

// 失敗時のテスト結果モック
const mockFailedTestResult: TestResult = {
  devicesAndConfigurations: [
    {
      device: {
        architecture: 'arm64',
        deviceId: '123',
        deviceName: 'iPhone 16 Pro',
        modelName: 'iPhone 16 Pro',
        osVersion: '18.0',
        platform: 'iOS Simulator'
      },
      expectedFailures: 0,
      failedTests: 1,
      passedTests: 2,
      skippedTests: 0,
      testPlanConfiguration: {
        configurationId: '1',
        configurationName: 'Default'
      }
    }
  ],
  environmentDescription: 'Test Environment',
  expectedFailures: 0,
  failedTests: 1,
  finishTime: 1729873371.36,
  passedTests: 2,
  result: 'failed',
  skippedTests: 0,
  startTime: 1729873161.166,
  testFailures: [
    {
      failureText: 'XCTAssertEqual failed: ("2") is not equal to ("3")',
      targetName: 'TestTarget',
      testName: 'testExample()',
      sourceCodeContext: {
        location: {
          filePath: 'path/to/test.swift', // スラッシュを削除
          lineNumber: 42
        }
      }
    }
  ],
  title: 'Test Results',
  totalTestCount: 3
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
  })

  describe('run', () => {
    test('successfully processes build and test results when both succeed', async () => {
      mockGetInput.mockReturnValue(testXcresultPath)
      let callCount = 0

      mockExec.mockImplementation(async (_, args, options): Promise<number> => {
        if (options?.listeners?.stdout) {
          const mockData =
            callCount === 0
              ? mockSuccessfulBuildResult
              : mockSuccessfulTestResult
          void options.listeners.stdout(Buffer.from(JSON.stringify(mockData)))
          callCount++
        }
        return Promise.resolve(0)
      })

      await run()

      expect(mockExec).toHaveBeenCalledTimes(2)
      expect(mockSetOutput).toHaveBeenCalledWith('build-status', 'succeeded')
      expect(mockSetOutput).toHaveBeenCalledWith('total-tests', 3)
      expect(mockSetOutput).toHaveBeenCalledWith('passed-tests', 3)
      expect(mockSetOutput).toHaveBeenCalledWith('failed-tests', 0)
      expect(mockAddRaw).toHaveBeenCalled()
      expect(mockWrite).toHaveBeenCalled()
    })

    test('handles build failure and skips test results', async () => {
      mockGetInput.mockReturnValue(testXcresultPath)
      mockExec.mockImplementation(async (_, args, options): Promise<number> => {
        if (options?.listeners?.stdout) {
          void options.listeners.stdout(
            Buffer.from(JSON.stringify(mockFailedBuildResult))
          )
        }
        return Promise.resolve(0)
      })

      await run()

      expect(mockExec).toHaveBeenCalledTimes(1)
      expect(mockSetOutput).toHaveBeenCalledWith('build-status', 'failed')
      expect(mockSetOutput).toHaveBeenCalledWith('error-count', 1)
      expect(mockSetOutput).toHaveBeenCalledWith('total-tests', 0)
      expect(mockSetOutput).toHaveBeenCalledWith('failed-tests', 0)
      expect(mockSetOutput).toHaveBeenCalledWith('passed-tests', 0)
    })

    test('handles successful build with failed tests', async () => {
      mockGetInput.mockReturnValue(testXcresultPath)
      let callCount = 0
      mockExec.mockImplementation(async (_, args, options): Promise<number> => {
        if (options?.listeners?.stdout) {
          const mockData =
            callCount === 0 ? mockSuccessfulBuildResult : mockFailedTestResult
          void options.listeners.stdout(Buffer.from(JSON.stringify(mockData)))
          callCount++
        }
        return Promise.resolve(0)
      })

      await run()

      expect(mockExec).toHaveBeenCalledTimes(2)
      expect(mockSetOutput).toHaveBeenCalledWith('build-status', 'succeeded')
      expect(mockSetOutput).toHaveBeenCalledWith('total-tests', 3)
      expect(mockSetOutput).toHaveBeenCalledWith('passed-tests', 2)
      expect(mockSetOutput).toHaveBeenCalledWith('failed-tests', 1)

      const markdownContent = mockAddRaw.mock.calls[0][0] as string
      expect(markdownContent).toContain('Test Failures')
      expect(markdownContent).toContain('XCTAssertEqual failed')
    })

    describe('getXcresultSummary', () => {
      test('successfully parses build and test results', async () => {
        let callCount = 0
        mockExec.mockImplementation(
          async (_, args, options): Promise<number> => {
            if (options?.listeners?.stdout) {
              const mockData =
                callCount === 0
                  ? mockSuccessfulBuildResult
                  : mockSuccessfulTestResult
              void options.listeners.stdout(
                Buffer.from(JSON.stringify(mockData))
              )
              callCount++
            }
            return Promise.resolve(0)
          }
        )

        const result = await getXcresultSummary(testXcresultPath)
        expect(result.buildResult.status).toBe('succeeded')
        expect(result.testResult).toBeDefined()
        expect(result.testResult?.totalTestCount).toBe(3)
      })

      test('handles invalid JSON', async () => {
        mockExec.mockImplementation(
          async (_, args, options): Promise<number> => {
            if (options?.listeners?.stdout) {
              void options.listeners.stdout(Buffer.from('invalid json'))
            }
            return Promise.resolve(0)
          }
        )

        await expect(getXcresultSummary(testXcresultPath)).rejects.toThrow(
          'Failed to parse'
        )
      })
    })

    describe('generateMarkdownSummary', () => {
      test('generates full summary for successful results', () => {
        const summary = generateMarkdownSummary(
          mockSuccessfulBuildResult,
          mockSuccessfulTestResult
        )
        expect(summary).toContain('Test Statistics')
        expect(summary).toContain('Build Results')
        expect(summary).toContain('✅ Passed')
        expect(summary).not.toContain('Test Failures')
      })

      test('includes test failures in summary', () => {
        const summary = generateMarkdownSummary(
          mockSuccessfulBuildResult,
          mockFailedTestResult
        )
        expect(summary).toContain('Test Failures')
        expect(summary).toContain('XCTAssertEqual failed')
      })

      test('includes build errors in summary', () => {
        const summary = generateMarkdownSummary(mockFailedBuildResult, null)
        expect(summary).toContain('Build Errors')
        expect(summary).toContain('Swift Compiler Error')
        expect(summary).toContain('Cannot find type')
      })
    })
  })
})
