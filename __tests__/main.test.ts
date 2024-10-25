import { expect, test, jest, describe } from '@jest/globals'

jest.mock('@actions/core', () => ({
  getInput: jest.fn().mockReturnValue(''),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  debug: jest.fn(),
  summary: {
    addRaw: jest.fn().mockReturnThis(),
    write: async () => Promise.resolve()
  }
}))

jest.mock('@actions/exec')

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

describe('xcresult-summary action', () => {
  let testXcresultPath: string
  let mockExec: jest.MockedFunction<typeof exec.exec>
  let mockGetInput: jest.MockedFunction<typeof core.getInput>

  beforeEach(async () => {
    jest.clearAllMocks()

    testXcresultPath = path.join(__dirname, 'test.xcresult')
    await fs.promises.writeFile(testXcresultPath, '')

    mockExec = jest.mocked(exec.exec)
    mockGetInput = jest.mocked(core.getInput)

    let callCount = 0
    mockExec.mockImplementation(async (_, args, options?: exec.ExecOptions) => {
      if (options?.listeners?.stdout) {
        const mockData = callCount === 0 ? mockBuildResult : mockTestResult
        await new Promise<void>(resolve => {
          options.listeners?.stdout?.(Buffer.from(JSON.stringify(mockData)))
          resolve()
        })
        callCount++
      }
      return 0
    })
  })

  afterEach(async () => {
    if (fs.existsSync(testXcresultPath)) {
      await fs.promises.unlink(testXcresultPath)
    }
    jest.restoreAllMocks()
  })

  test('executes correct xcrun commands', async () => {
    mockGetInput.mockReturnValue(testXcresultPath)

    await run()

    expect(mockExec).toHaveBeenCalledTimes(2)
    expect(mockExec).toHaveBeenNthCalledWith(
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
  })
})
