import {
  BuildResult,
  TestResult,
  DetailedTestResult,
  TestFailure,
  TestNode
} from './types'

export function isBuildResult(value: unknown): value is BuildResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'errorCount' in value &&
    'warningCount' in value
  )
}

export function isTestResult(value: unknown): value is TestResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'result' in value &&
    'totalTestCount' in value &&
    'failedTests' in value
  )
}

export function isDetailedTestResult(
  value: unknown
): value is DetailedTestResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'testNodes' in value &&
    'devices' in value &&
    'testPlanConfigurations' in value
  )
}

export function extractTestFailures(
  details: DetailedTestResult
): TestFailure[] {
  const failures: TestFailure[] = []

  function traverseNodes(nodes: TestNode[]): void {
    for (const node of nodes) {
      if (node.nodeType === 'Test Case' && node.result === 'Failed') {
        const failure: TestFailure = {
          testName: node.name,
          failureText: node.children?.[0]?.name || 'Unknown failure',
          sourceCodeContext: {
            location: extractLocationFromFailureMessage(
              node.children?.[0]?.name || ''
            )
          }
        }
        failures.push(failure)
      }
      if (node.children) {
        traverseNodes(node.children)
      }
    }
  }

  traverseNodes(details.testNodes)
  return failures
}

function extractLocationFromFailureMessage(message: string): {
  filePath?: string
  lineNumber?: number
} {
  const match = message.match(/([^:]+\.swift):(\d+):/)
  if (match) {
    return {
      filePath: match[1],
      lineNumber: parseInt(match[2], 10)
    }
  }
  return {}
}
