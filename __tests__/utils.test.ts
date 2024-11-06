import {
  isBuildResult,
  isTestResult,
  isDetailedTestResult,
  extractTestFailures
} from '../src/utils'
import {
  BuildResult,
  TestResult,
  DetailedTestResult,
  TestNode
} from '../src/types'

describe('Type Guards', () => {
  describe('isBuildResult', () => {
    it('should return true for valid BuildResult', () => {
      const buildResult: BuildResult = {
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
      expect(isBuildResult(buildResult)).toBe(true)
    })

    it('should return false for invalid BuildResult', () => {
      expect(isBuildResult(null)).toBe(false)
      expect(isBuildResult(undefined)).toBe(false)
      expect(isBuildResult({})).toBe(false)
      expect(isBuildResult({ status: 'succeeded' })).toBe(false)
      expect(isBuildResult({ errorCount: 0, warningCount: 0 })).toBe(false)
    })
  })

  describe('isTestResult', () => {
    it('should return true for valid TestResult', () => {
      const testResult: TestResult = {
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
      expect(isTestResult(testResult)).toBe(true)
    })

    it('should return false for invalid TestResult', () => {
      expect(isTestResult(null)).toBe(false)
      expect(isTestResult(undefined)).toBe(false)
      expect(isTestResult({})).toBe(false)
      expect(isTestResult({ result: 'success' })).toBe(false)
      expect(isTestResult({ totalTestCount: 10 })).toBe(false)
    })
  })

  describe('isDetailedTestResult', () => {
    it('should return true for valid DetailedTestResult', () => {
      const detailedTestResult: DetailedTestResult = {
        testNodes: [],
        devices: [],
        testPlanConfigurations: []
      }
      expect(isDetailedTestResult(detailedTestResult)).toBe(true)
    })

    it('should return false for invalid DetailedTestResult', () => {
      expect(isDetailedTestResult(null)).toBe(false)
      expect(isDetailedTestResult(undefined)).toBe(false)
      expect(isDetailedTestResult({})).toBe(false)
      expect(isDetailedTestResult({ testNodes: [] })).toBe(false)
      expect(isDetailedTestResult({ devices: [] })).toBe(false)
    })
  })
})

describe('extractTestFailures', () => {
  it('should extract test failures from DetailedTestResult', () => {
    const testNodes: TestNode[] = [
      {
        name: 'TestSuite',
        nodeType: 'suite',
        result: 'Failed',
        children: [
          {
            name: 'TestCase1',
            nodeType: 'Test Case',
            result: 'Failed',
            children: [
              {
                name: 'TestFile.swift:42: Test assertion failed',
                nodeType: 'Failure',
                result: 'Failed'
              }
            ]
          }
        ]
      }
    ]

    const detailedTestResult: DetailedTestResult = {
      testNodes,
      devices: [],
      testPlanConfigurations: []
    }

    const failures = extractTestFailures(detailedTestResult)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toEqual({
      testName: 'TestCase1',
      failureText: 'TestFile.swift:42: Test assertion failed',
      sourceCodeContext: {
        location: {
          filePath: 'TestFile.swift',
          lineNumber: 42
        }
      }
    })
  })

  it('should handle missing failure details gracefully', () => {
    const testNodes: TestNode[] = [
      {
        name: 'TestCase',
        nodeType: 'Test Case',
        result: 'Failed'
      }
    ]

    const detailedTestResult: DetailedTestResult = {
      testNodes,
      devices: [],
      testPlanConfigurations: []
    }

    const failures = extractTestFailures(detailedTestResult)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toEqual({
      testName: 'TestCase',
      failureText: 'Unknown failure',
      sourceCodeContext: {
        location: {}
      }
    })
  })

  it('should handle nested test failures', () => {
    const testNodes: TestNode[] = [
      {
        name: 'OuterSuite',
        nodeType: 'suite',
        result: 'Failed',
        children: [
          {
            name: 'InnerSuite',
            nodeType: 'suite',
            result: 'Failed',
            children: [
              {
                name: 'TestCase',
                nodeType: 'Test Case',
                result: 'Failed',
                children: [
                  {
                    name: 'NestedTest.swift:123: Failure message',
                    nodeType: 'Failure',
                    result: 'Failed'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]

    const detailedTestResult: DetailedTestResult = {
      testNodes,
      devices: [],
      testPlanConfigurations: []
    }

    const failures = extractTestFailures(detailedTestResult)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toEqual({
      testName: 'TestCase',
      failureText: 'NestedTest.swift:123: Failure message',
      sourceCodeContext: {
        location: {
          filePath: 'NestedTest.swift',
          lineNumber: 123
        }
      }
    })
  })

  it('should handle multiple test failures', () => {
    const testNodes: TestNode[] = [
      {
        name: 'TestSuite',
        nodeType: 'suite',
        result: 'Failed',
        children: [
          {
            name: 'TestCase1',
            nodeType: 'Test Case',
            result: 'Failed',
            children: [
              {
                name: 'Test1.swift:10: First failure',
                nodeType: 'Failure',
                result: 'Failed'
              }
            ]
          },
          {
            name: 'TestCase2',
            nodeType: 'Test Case',
            result: 'Failed',
            children: [
              {
                name: 'Test2.swift:20: Second failure',
                nodeType: 'Failure',
                result: 'Failed'
              }
            ]
          }
        ]
      }
    ]

    const detailedTestResult: DetailedTestResult = {
      testNodes,
      devices: [],
      testPlanConfigurations: []
    }

    const failures = extractTestFailures(detailedTestResult)
    expect(failures).toHaveLength(2)
    expect(failures[0]).toEqual({
      testName: 'TestCase1',
      failureText: 'Test1.swift:10: First failure',
      sourceCodeContext: {
        location: {
          filePath: 'Test1.swift',
          lineNumber: 10
        }
      }
    })
    expect(failures[1]).toEqual({
      testName: 'TestCase2',
      failureText: 'Test2.swift:20: Second failure',
      sourceCodeContext: {
        location: {
          filePath: 'Test2.swift',
          lineNumber: 20
        }
      }
    })
  })
})
