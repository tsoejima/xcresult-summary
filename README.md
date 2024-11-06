# xcresult-summary

![Build Status](https://github.com/tsoejima/xcresult-summary/workflows/CI/badge.svg)
![Release](https://img.shields.io/github/v/release/tsoejima/xcresult-summary)
![License](https://img.shields.io/github/license/tsoejima/xcresult-summary)

This action extracts a summary of test successes and failures from Xcode test results (.xcresult) and generates a summary in Markdown format. This allows you to easily view test results within your CI/CD pipeline.

## Prerequisites
- macOS Runner: This action must be run on a macOS runner because it utilizes Xcode command-line tools to process .xcresult files.
- Xcode 16 or Later: Ensure that Xcode version 16 or higher is installed on the runner. This action supports features and formats introduced in Xcode 16 and may not work with earlier versions.
## Usage
### Example

```yaml
uses: tsoejima/xcresult-summary@v1
  with:
    xcresult-path: './test_results/Test.xcresult'
  if: always()
```
```yaml
- name: Run tests
  run: |
    xcodebuild -scheme App -resultBundlePath Test test
- name: Generate Test Summary
  uses: tsoejima/xcresult-summary@v1
  with:
    xcresult-path: 'Test.xcresult'
  if: always()
```
### Input
```yaml
inputs:
uses: tsoejima/xcresult-summary@v1
  with:
    xcresult-path: 'Test.xcresult'
    # Path to the .xcresult bundle
```
