export interface BuildResult {
  analyzerWarningCount: number
  analyzerWarnings: unknown[]
  destination?: {
    architecture: string
    deviceId: string
    deviceName: string
    modelName: string
    osVersion: string
    platform: string
  }
  endTime: number
  errorCount: number
  errors: {
    className?: string
    issueType?: string
    message?: string
    sourceURL?: string
    targetName?: string
  }[]
  startTime: number
  status: string
  warningCount: number
  warnings: unknown[]
}

export interface TestResult {
  devicesAndConfigurations?: {
    device?: {
      architecture: string
      deviceId: string
      deviceName: string
      modelName: string
      osVersion: string
      platform: string
    }
    expectedFailures: number
    failedTests: number
    passedTests: number
    skippedTests: number
    testPlanConfiguration?: {
      configurationId: string
      configurationName: string
    }
  }[]
  environmentDescription: string
  expectedFailures: number
  failedTests: number
  finishTime: number
  passedTests: number
  result: string
  skippedTests: number
  startTime: number
  testFailures?: TestFailure[]
  title: string
  totalTestCount: number
}

export interface TestNode {
  children?: TestNode[]
  duration?: string
  name: string
  nodeIdentifier?: string
  nodeType: string
  result: string
}

export interface TestDevice {
  architecture: string
  deviceId: string
  deviceName: string
  modelName: string
  osVersion: string
  platform: string
}

export interface TestPlanConfiguration {
  configurationId: string
  configurationName: string
}

export interface DetailedTestResult {
  devices: TestDevice[]
  testNodes: TestNode[]
  testPlanConfigurations: TestPlanConfiguration[]
}

export interface TestFailure {
  failureText?: string
  targetName?: string
  testIdentifier?: number
  testName?: string
  sourceCodeContext?: {
    location?: {
      filePath?: string
      lineNumber?: number
    }
  }
}

export interface XcresultSummaryResult {
  buildResult: BuildResult
  testResult: TestResult | null
}
