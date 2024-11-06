import { jest } from '@jest/globals'

describe('index', () => {
  let mockExit: jest.Mock
  let mockStderrWrite: jest.MockedFunction<typeof process.stderr.write>
  let originalExit: (code?: number) => never
  let mockedRun: jest.MockedFunction<typeof import('../src/main').run>

  beforeEach(async () => {
    // モジュールキャッシュをクリア
    jest.resetModules()
    jest.clearAllMocks()

    // '../src/main'モジュールをモック化
    jest.mock('../src/main')
    // モック化されたrun関数を再インポート
    const mainModule = await import('../src/main')
    mockedRun = jest.mocked(mainModule.run)

    // オリジナルのprocess.exitを保存
    originalExit = process.exit

    // モックの設定
    mockExit = jest.fn()
    mockStderrWrite = jest.fn() as jest.MockedFunction<
      typeof process.stderr.write
    >

    // process.exitをモックに置き換え
    process.exit = mockExit as never

    // process.stderr.writeをモックに置き換え
    jest.spyOn(process.stderr, 'write').mockImplementation(mockStderrWrite)
  })

  afterEach(() => {
    // テスト後に元の実装を復元
    process.exit = originalExit
    jest.restoreAllMocks()
  })

  it('should execute run successfully', async () => {
    // モックの設定をimportの前に行う
    mockedRun.mockResolvedValue()

    // モジュールを読み込む前にモックを設定する必要がある
    const indexModule = await import('../src/index')

    expect(mockedRun).toHaveBeenCalled()
    expect(mockExit).not.toHaveBeenCalled()
    expect(mockStderrWrite).not.toHaveBeenCalled()
  })

  it('should handle error and exit with code 1', async () => {
    const error = new Error('Test error')
    // モックの設定をimportの前に行う
    mockedRun.mockRejectedValue(error)

    // モジュールを読み込む前にモックを設定する必要がある
    const indexModule = await import('../src/index')

    expect(mockedRun).toHaveBeenCalled()
    expect(mockStderrWrite).toHaveBeenCalledWith('Test error\n')
    expect(mockExit).toHaveBeenCalledWith(1)
  })
})
