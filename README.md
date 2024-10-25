# xcresult-summary

This action generates a markdown summary from Xcode test results (.xcresult).

## Features

- Generates a markdown summary from xcresult
- Shows build and test results
- Provides test statistics
- Displays device-specific results
- Lists build errors and test failures

## Usage

```yaml
- uses: tsoejima/xcresult-summary@v1
  with:
    xcresult-path: 'path/to/your/test.xcresult'
Inputs
Input	Description	Required	Default
xcresult-path	Path to the .xcresult bundle	true	build/reports/tests.xcresult
Outputs
Output	Description	Example
summary	Test summary in markdown format	See example below
total-tests	Total number of tests	10
failed-tests	Number of failed tests	2
passed-tests	Number of passed tests	8
build-status	Build status	succeeded/failed
error-count	Number of build errors	0
warning-count	Number of build warnings	2
Example Workflow
yaml
name: Test

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: macos-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Select Xcode
      uses: maxim-lobanov/setup-xcode@v1
      with:
        xcode-version: latest-stable
    
    - name: Build and Test
      run: |
        xcodebuild test \
          -scheme YourScheme \
          -destination 'platform=iOS Simulator,name=iPhone 15' \
          -resultBundlePath build/reports/tests.xcresult
    
    - name: Generate Test Summary
      uses: YourUsername/xcresult-summary@v1
      with:
        xcresult-path: build/reports/tests.xcresult
    
    - name: Check Test Results
      if: always()
      run: |
        if [[ "${{ steps.test-summary.outputs.failed-tests }}" != "0" ]]; then
          exit 1
        fi
Example Output
The action will create a summary like this:

Build Summary
Status: ✅ Passed
Duration: 2.15 minutes

Environment
Platform: iOS Simulator
Device: iPhone 15
OS Version: 17.0
Build Statistics
Errors: 0
Warnings: 2
Analyzer Warnings: 0
Test Summary
Status: ✅ Passed
Duration: 1.45 minutes

Test Statistics
Total Tests: 10
Passed: 8
Failed: 2
Skipped: 0
Expected Failures: 0
Device-specific Results
iPhone 15 (iOS Simulator)

Passed: 8
Failed: 2
Skipped: 0
Configuration: Test Scheme Action