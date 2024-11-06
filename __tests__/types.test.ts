import {
  BuildResult,
  TestResult,
  TestNode,
  TestDevice,
  TestPlanConfiguration,
  DetailedTestResult,
  TestFailure,
  XcresultSummaryResult
} from '../src/types'

describe('Types', () => {
  it('should create valid BuildResult object', () => {
    const buildResult: BuildResult = {
      analyzerWarningCount: 0,
      analyzerWarnings: [],
      destination: {
        architecture: 'arm64',
        deviceId: 'iPhone14,3',
        deviceName: 'iPhone 13 Pro Max',
        modelName: 'iPhone',
        osVersion: '15.0',
        platform: 'iOS'
      },
      endTime: 1000,
      errorCount: 0,
      errors: [],
      startTime: 0,
      status: 'succeeded',
      warningCount: 0,
      warnings: []
    }

    expect(buildResult).toBeDefined()
    expect(buildResult.status).toBe('succeeded')
    expect(buildResult.destination?.platform).toBe('iOS')
  })

  it('should create valid TestResult object', () => {
    const testResult: TestResult = {
      devicesAndConfigurations: [
        {
          device: {
            architecture: 'arm64',
            deviceId: 'iPhone14,3',
            deviceName: 'iPhone 13 Pro Max',
            modelName: 'iPhone',
            osVersion: '15.0',
            platform: 'iOS'
          },
          expectedFailures: 0,
          failedTests: 0,
          passedTests: 10,
          skippedTests: 0,
          testPlanConfiguration: {
            configurationId: 'config1',
            configurationName: 'Default'
          }
        }
      ],
      environmentDescription: 'iOS 15.0',
      expectedFailures: 0,
      failedTests: 0,
      finishTime: 1000,
      passedTests: 10,
      result: 'success',
      skippedTests: 0,
      startTime: 0,
      testFailures: [],
      title: 'Test Suite',
      totalTestCount: 10
    }

    expect(testResult).toBeDefined()
    expect(testResult.result).toBe('success')
    expect(testResult.devicesAndConfigurations?.[0].device?.platform).toBe(
      'iOS'
    )
  })

  it('should create valid TestNode object', () => {
    const testNode: TestNode = {
      name: 'Test Case',
      nodeType: 'test',
      result: 'success',
      duration: '1.5s',
      children: []
    }

    expect(testNode).toBeDefined()
    expect(testNode.nodeType).toBe('test')
  })

  it('should create valid TestDevice object', () => {
    const testDevice: TestDevice = {
      architecture: 'arm64',
      deviceId: 'iPhone14,3',
      deviceName: 'iPhone 13 Pro Max',
      modelName: 'iPhone',
      osVersion: '15.0',
      platform: 'iOS'
    }

    expect(testDevice).toBeDefined()
    expect(testDevice.platform).toBe('iOS')
  })

  it('should create valid TestPlanConfiguration object', () => {
    const testPlanConfig: TestPlanConfiguration = {
      configurationId: 'config1',
      configurationName: 'Default'
    }

    expect(testPlanConfig).toBeDefined()
    expect(testPlanConfig.configurationName).toBe('Default')
  })

  it('should create valid DetailedTestResult object', () => {
    const detailedTestResult: DetailedTestResult = {
      devices: [
        {
          architecture: 'arm64',
          deviceId: 'iPhone14,3',
          deviceName: 'iPhone 13 Pro Max',
          modelName: 'iPhone',
          osVersion: '15.0',
          platform: 'iOS'
        }
      ],
      testNodes: [
        {
          name: 'Test Suite',
          nodeType: 'suite',
          result: 'success'
        }
      ],
      testPlanConfigurations: [
        {
          configurationId: 'config1',
          configurationName: 'Default'
        }
      ]
    }

    expect(detailedTestResult).toBeDefined()
    expect(detailedTestResult.devices[0].platform).toBe('iOS')
    expect(detailedTestResult.testNodes[0].nodeType).toBe('suite')
  })

  it('should create valid TestFailure object', () => {
    const testFailure: TestFailure = {
      failureText: 'Test failed',
      targetName: 'MyTarget',
      testIdentifier: 123,
      testName: 'testCase',
      sourceCodeContext: {
        location: {
          filePath: 'Tests/MyTests.swift',
          lineNumber: 42
        }
      }
    }

    expect(testFailure).toBeDefined()
    expect(testFailure.sourceCodeContext?.location?.lineNumber).toBe(42)
  })

  it('should create valid XcresultSummaryResult object', () => {
    const xcresultSummary: XcresultSummaryResult = {
      buildResult: {
        analyzerWarningCount: 0,
        analyzerWarnings: [],
        endTime: 1000,
        errorCount: 0,
        errors: [],
        startTime: 0,
        status: 'succeeded',
        warningCount: 0,
        warnings: []
      },
      testResult: null
    }

    expect(xcresultSummary).toBeDefined()
    expect(xcresultSummary.buildResult.status).toBe('succeeded')
    expect(xcresultSummary.testResult).toBeNull()
  })
})
