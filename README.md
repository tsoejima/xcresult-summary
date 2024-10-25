# xcresult-summary

This action generates a markdown summary from Xcode test results (.xcresult).

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `xcresult-path` | Path to the .xcresult bundle | Yes | `build/reports/tests.xcresult` |

## Outputs

| Output | Description |
|--------|-------------|
| `summary` | Test summary in markdown format |
| `total-tests` | Total number of tests |
| `failed-tests` | Number of failed tests |
| `passed-tests` | Number of passed tests |

## Example Usage

```yaml
name: Xcode Test Summary

on: [push, pull_request]

jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      
      # Run your Xcode tests here...
      
      - name: Generate Test Summary
        uses: YourUsername/xcresult-summary@v1
        with:
          xcresult-path: 'path/to/your/test.xcresult'