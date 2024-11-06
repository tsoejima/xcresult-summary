import { getXcresultSummary } from '../src/xcresult-parser'
import * as exec from '@actions/exec'
import * as utils from '../src/utils'
import { BuildResult, TestResult, DetailedTestResult } from '../src/types'

jest.mock('@actions/exec')
jest.mock('../src/utils')

const mockedExec = jest.mocked(exec)
const mockedUtils = jest.mocked(utils)

describe('getXcresultSummary', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('should parse successful build and test results', async () => {
    const mockBuildResult: BuildResult = {
      status: 'succeeded',
      errorCount: 0,
      warningCount: 0,
      analyzerWarningCount: 0,
      startTime: 0,
      endTime: 100,
      errors: [],
      warnings: [],
      analyzerWarnings: []
    }

    const mockTestResult: TestResult = {
      result: 'success',
      totalTestCount: 10,
      failedTests: 0,
      passedTests: 10,
      skippedTests: 0,
      expectedFailures: 0,
      startTime: 0,
      finishTime: 100,
      environmentDescription: '',
      title: ''
    }

    const mockDetailedTestResult: DetailedTestResult = {
      testNodes: [],
      devices: [],
      testPlanConfigurations: []
    }

    mockedExec.exec.mockImplementation((cmd, args, options) => {
      if (args?.includes('build-results')) {
        options?.listeners?.stdout?.(
          Buffer.from(JSON.stringify(mockBuildResult))
        )
      } else if (args?.includes('test-results') && args?.includes('summary')) {
        options?.listeners?.stdout?.(
          Buffer.from(JSON.stringify(mockTestResult))
        )
      } else if (args?.includes('test-results') && args?.includes('tests')) {
        options?.listeners?.stdout?.(
          Buffer.from(JSON.stringify(mockDetailedTestResult))
        )
      }
      return Promise.resolve(0)
    })

    mockedUtils.isBuildResult.mockReturnValue(true)
    mockedUtils.isTestResult.mockReturnValue(true)
    mockedUtils.isDetailedTestResult.mockReturnValue(true)
    mockedUtils.extractTestFailures.mockReturnValue([])

    const result = await getXcresultSummary('/path/to/test.xcresult')

    expect(result).toEqual({
      buildResult: mockBuildResult,
      testResult: mockTestResult
    })
    expect(mockedExec.exec).toHaveBeenCalledTimes(3)
  })

  it('should handle failed build without test results', async () => {
    const mockBuildResult: BuildResult = {
      status: 'failed',
      errorCount: 1,
      warningCount: 0,
      analyzerWarningCount: 0,
      startTime: 0,
      endTime: 100,
      errors: [
        {
          message: 'Build failed'
        }
      ],
      warnings: [],
      analyzerWarnings: []
    }

    mockedExec.exec.mockImplementation((cmd, args, options) => {
      if (args?.includes('build-results')) {
        options?.listeners?.stdout?.(
          Buffer.from(JSON.stringify(mockBuildResult))
        )
      }
      return Promise.resolve(0)
    })

    mockedUtils.isBuildResult.mockReturnValue(true)

    const result = await getXcresultSummary('/path/to/test.xcresult')

    expect(result).toEqual({
      buildResult: mockBuildResult,
      testResult: null
    })
    expect(mockedExec.exec).toHaveBeenCalledTimes(1)
  })

  it('should handle invalid build result JSON', async () => {
    mockedExec.exec.mockImplementation((cmd, args, options) => {
      options?.listeners?.stdout?.(Buffer.from('invalid json'))
      return Promise.resolve(0)
    })

    await expect(getXcresultSummary('/path/to/test.xcresult')).rejects.toThrow(
      'Failed to parse build result JSON'
    )
  })

  it('should handle invalid build result format', async () => {
    mockedExec.exec.mockImplementation((cmd, args, options) => {
      options?.listeners?.stdout?.(Buffer.from('{}'))
      return Promise.resolve(0)
    })

    mockedUtils.isBuildResult.mockReturnValue(false)

    await expect(getXcresultSummary('/path/to/test.xcresult')).rejects.toThrow(
      'Invalid build result format'
    )
  })

  it('should handle invalid test result JSON', async () => {
    const mockBuildResult: BuildResult = {
      status: 'succeeded',
      errorCount: 0,
      warningCount: 0,
      analyzerWarningCount: 0,
      startTime: 0,
      endTime: 100,
      errors: [],
      warnings: [],
      analyzerWarnings: []
    }

    mockedExec.exec.mockImplementation((cmd, args, options) => {
      if (args?.includes('build-results')) {
        options?.listeners?.stdout?.(
          Buffer.from(JSON.stringify(mockBuildResult))
        )
      } else if (args?.includes('test-results')) {
        options?.listeners?.stdout?.(Buffer.from('invalid json'))
      }
      return Promise.resolve(0)
    })

    mockedUtils.isBuildResult.mockReturnValue(true)

    await expect(getXcresultSummary('/path/to/test.xcresult')).rejects.toThrow(
      'Failed to parse test result JSON'
    )
  })

  it('should handle invalid test result format', async () => {
    const mockBuildResult: BuildResult = {
      status: 'succeeded',
      errorCount: 0,
      warningCount: 0,
      analyzerWarningCount: 0,
      startTime: 0,
      endTime: 100,
      errors: [],
      warnings: [],
      analyzerWarnings: []
    }

    mockedExec.exec.mockImplementation((cmd, args, options) => {
      if (args?.includes('build-results')) {
        options?.listeners?.stdout?.(
          Buffer.from(JSON.stringify(mockBuildResult))
        )
      } else if (args?.includes('test-results')) {
        options?.listeners?.stdout?.(Buffer.from('{}'))
      }
      return Promise.resolve(0)
    })

    mockedUtils.isBuildResult.mockReturnValue(true)
    mockedUtils.isTestResult.mockReturnValue(false)

    await expect(getXcresultSummary('/path/to/test.xcresult')).rejects.toThrow(
      'Invalid test result format'
    )
  })
})
