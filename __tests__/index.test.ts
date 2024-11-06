import { jest } from '@jest/globals'

describe('index', () => {
  let mockExit: jest.Mock
  let mockStderrWrite: jest.MockedFunction<typeof process.stderr.write>
  let originalExit: (code?: number) => never
  let mockedRun: jest.MockedFunction<typeof import('../src/main').run>

  beforeEach(async () => {
    jest.resetModules()
    jest.clearAllMocks()

    jest.mock('../src/main')
    const mainModule = (await import(
      '../src/main'
    )) as typeof import('../src/main')
    mockedRun = jest.mocked(mainModule.run)

    mockExit = jest.fn()
    mockStderrWrite = jest.fn() as jest.MockedFunction<
      typeof process.stderr.write
    >

    process.exit = mockExit as never

    jest.spyOn(process.stderr, 'write').mockImplementation(mockStderrWrite)
  })

  afterEach(() => {
    process.exit = originalExit
    jest.restoreAllMocks()
  })

  it('should execute run successfully', async () => {
    mockedRun.mockResolvedValue()

    /* eslint-disable */
    const indexModule = (await import(
      '../src/index'
    )) as typeof import('../src/index')
    /* eslint-enable */

    expect(mockedRun).toHaveBeenCalled()
    expect(mockExit).not.toHaveBeenCalled()
    expect(mockStderrWrite).not.toHaveBeenCalled()
  })

  it('should handle error and exit with code 1', async () => {
    const error = new Error('Test error')
    mockedRun.mockRejectedValue(error)

    /* eslint-disable */
    const indexModule = (await import(
      '../src/index'
    )) as typeof import('../src/index')
    /* eslint-enable */

    expect(mockedRun).toHaveBeenCalled()
    expect(mockStderrWrite).toHaveBeenCalledWith('Test error\n')
    expect(mockExit).toHaveBeenCalledWith(1)
  })
})
