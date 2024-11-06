import { run } from '../src/main'
import { BuildResult, TestResult } from '../src/types'
import * as core from '@actions/core'
import * as fs from 'fs'
import { getXcresultSummary } from '../src/xcresult-parser'
import { generateMarkdownSummary } from '../src/markdown-generator'

jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  summary: {
    addRaw: jest.fn().mockReturnThis(),
    write: jest.fn().mockResolvedValue(undefined),
    addHeading: jest.fn().mockReturnThis()
  }
}))

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  promises: {
    access: jest.fn(),
    writeFile: jest.fn()
  }
}))

jest.mock('@actions/exec', () => ({
  exec: jest.fn()
}))

jest.mock('../src/xcresult-parser')
jest.mock('../src/markdown-generator')

const mockedCore = jest.mocked(core)
const mockedFs = jest.mocked(fs)
const mockedGetXcresultSummary = jest.mocked(getXcresultSummary)
const mockedGenerateMarkdownSummary = jest.mocked(generateMarkdownSummary)

describe('run function', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should process xcresult successfully', async () => {
    const mockXcresultPath = '/path/to/xcresult'
    mockedCore.getInput.mockReturnValue(mockXcresultPath)
    mockedFs.existsSync.mockReturnValue(true)

    const mockBuildResult: BuildResult = {
      status: 'succeeded',
      errorCount: 0,
      warningCount: 0,
      analyzerWarningCount: 0,
      analyzerWarnings: [],
      endTime: 0,
      startTime: 0,
      warnings: [],
      errors: []
    }

    const mockTestResult: TestResult = {
      totalTestCount: 10,
      failedTests: 0,
      passedTests: 10,
      skippedTests: 0,
      expectedFailures: 0,
      result: 'success',
      startTime: 0,
      finishTime: 0,
      environmentDescription: '',
      title: ''
    }

    mockedGetXcresultSummary.mockResolvedValue({
      buildResult: mockBuildResult,
      testResult: mockTestResult
    })

    const mockMarkdown = '# Test Summary'
    mockedGenerateMarkdownSummary.mockReturnValue(mockMarkdown)

    await run()

    expect(mockedCore.getInput).toHaveBeenCalledWith('xcresult-path')
    expect(mockedFs.existsSync).toHaveBeenCalledWith(mockXcresultPath)
    expect(mockedGetXcresultSummary).toHaveBeenCalledWith(mockXcresultPath)
    expect(mockedGenerateMarkdownSummary).toHaveBeenCalledWith(
      mockBuildResult,
      mockTestResult
    )
    expect(mockedCore.setOutput).toHaveBeenCalledWith('total-tests', 10)
    expect(mockedCore.setOutput).toHaveBeenCalledWith('failed-tests', 0)
    expect(mockedCore.setOutput).toHaveBeenCalledWith('passed-tests', 10)
    expect(mockedCore.setOutput).toHaveBeenCalledWith(
      'build-status',
      'succeeded'
    )
    expect(mockedCore.setOutput).toHaveBeenCalledWith('error-count', 0)
    expect(mockedCore.setOutput).toHaveBeenCalledWith('warning-count', 0)
    expect(mockedCore.summary.addRaw).toHaveBeenCalledWith(mockMarkdown)
    expect(mockedCore.summary.write).toHaveBeenCalled()
  })

  it('should handle xcresult file not found', async () => {
    const mockXcresultPath = '/path/to/nonexistent/xcresult'
    mockedCore.getInput.mockReturnValue(mockXcresultPath)
    mockedFs.existsSync.mockReturnValue(false)

    await run()

    expect(mockedCore.setFailed).toHaveBeenCalledWith(
      `xcresult file not found at path: ${mockXcresultPath}`
    )
    expect(mockedCore.summary.addHeading).toHaveBeenCalledWith('Error')
    expect(mockedCore.summary.addRaw).toHaveBeenCalledWith(
      expect.stringContaining('❌')
    )
    expect(mockedCore.summary.write).toHaveBeenCalled()
  })

  it('should handle build failure', async () => {
    const mockXcresultPath = '/path/to/xcresult'
    mockedCore.getInput.mockReturnValue(mockXcresultPath)
    mockedFs.existsSync.mockReturnValue(true)

    const mockBuildResult: BuildResult = {
      status: 'failed',
      errorCount: 2,
      warningCount: 1,
      analyzerWarningCount: 0,
      analyzerWarnings: [],
      endTime: 0,
      startTime: 0,
      warnings: [],
      errors: []
    }

    mockedGetXcresultSummary.mockResolvedValue({
      buildResult: mockBuildResult,
      testResult: null
    })

    const mockMarkdown = '# Build Failed Summary'
    mockedGenerateMarkdownSummary.mockReturnValue(mockMarkdown)

    await run()

    expect(mockedCore.setOutput).toHaveBeenCalledWith('build-status', 'failed')
    expect(mockedCore.setOutput).toHaveBeenCalledWith('error-count', 2)
    expect(mockedCore.setOutput).toHaveBeenCalledWith('warning-count', 1)
    expect(mockedCore.summary.addRaw).toHaveBeenCalledWith(mockMarkdown)
    expect(mockedCore.summary.write).toHaveBeenCalled()
  })

  it('should handle errors during execution', async () => {
    const mockError = new Error('Test error')
    mockedCore.getInput.mockImplementation(() => {
      throw mockError
    })

    await run()

    expect(mockedCore.setFailed).toHaveBeenCalledWith(mockError.message)
    expect(mockedCore.summary.addHeading).toHaveBeenCalledWith('Error')
    expect(mockedCore.summary.addRaw).toHaveBeenCalledWith(
      expect.stringContaining('❌')
    )
    expect(mockedCore.summary.write).toHaveBeenCalled()
  })
})
