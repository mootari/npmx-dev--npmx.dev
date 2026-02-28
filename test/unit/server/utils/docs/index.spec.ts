import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock client module
const getDocNodesMock = vi.fn()
const getDocNodesForEntrypointMock = vi.fn()
const getSubpathExportsMock = vi.fn()
const getTypesUrlForSubpathMock = vi.fn()

vi.mock('../../../../../server/utils/docs/client', () => ({
  getDocNodes: (...args: unknown[]) => getDocNodesMock(...args),
  getDocNodesForEntrypoint: (...args: unknown[]) => getDocNodesForEntrypointMock(...args),
  getSubpathExports: (...args: unknown[]) => getSubpathExportsMock(...args),
  getTypesUrlForSubpath: (...args: unknown[]) => getTypesUrlForSubpathMock(...args),
}))

// Mock processing module
vi.mock('../../../../../server/utils/docs/processing', () => ({
  flattenNamespaces: (nodes: unknown[]) => nodes,
  mergeOverloads: (nodes: unknown[]) => nodes,
  buildSymbolLookup: () => new Map(),
}))

// Mock render module
vi.mock('../../../../../server/utils/docs/render', () => ({
  renderDocNodes: async () => '<div>docs</div>',
  renderToc: () => '<nav>toc</nav>',
}))

const { generateDocsWithDeno, getEntrypoints } =
  await import('../../../../../server/utils/docs/index')

describe('docs/index', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getEntrypoints', () => {
    it('returns null for single-entrypoint packages (root has types)', async () => {
      getTypesUrlForSubpathMock.mockResolvedValue('https://esm.sh/ufo@1.5.0/dist/index.d.ts')

      const result = await getEntrypoints('ufo', '1.5.0')

      expect(result).toBeNull()
      expect(getTypesUrlForSubpathMock).toHaveBeenCalledWith('ufo', '1.5.0')
      expect(getSubpathExportsMock).not.toHaveBeenCalled()
    })

    it('returns subpath exports when root has no types', async () => {
      getTypesUrlForSubpathMock.mockResolvedValue(null)
      getSubpathExportsMock.mockResolvedValue(['router.js', 'api.js'])

      const result = await getEntrypoints('@thepassle/app-tools', '0.10.2')

      expect(result).toEqual(['router.js', 'api.js'])
      expect(getSubpathExportsMock).toHaveBeenCalledWith('@thepassle/app-tools', '0.10.2')
    })

    it('returns null when root has no types and no subpath exports', async () => {
      getTypesUrlForSubpathMock.mockResolvedValue(null)
      getSubpathExportsMock.mockResolvedValue([])

      const result = await getEntrypoints('pkg', '1.0.0')

      expect(result).toBeNull()
    })
  })

  describe('generateDocsWithDeno', () => {
    it('calls getDocNodes for packages without entrypoint', async () => {
      getDocNodesMock.mockResolvedValue({
        version: 1,
        nodes: [{ name: 'foo', kind: 'function' }],
      })

      const result = await generateDocsWithDeno('ufo', '1.5.0')

      expect(getDocNodesMock).toHaveBeenCalledWith('ufo', '1.5.0')
      expect(getDocNodesForEntrypointMock).not.toHaveBeenCalled()
      expect(result).toEqual({
        html: '<div>docs</div>',
        toc: '<nav>toc</nav>',
        nodes: [{ name: 'foo', kind: 'function' }],
      })
    })

    it('calls getDocNodesForEntrypoint when entrypoint is specified', async () => {
      getDocNodesForEntrypointMock.mockResolvedValue({
        version: 1,
        nodes: [{ name: 'Router', kind: 'class' }],
      })

      const result = await generateDocsWithDeno('@thepassle/app-tools', '0.10.2', 'router.js')

      expect(getDocNodesForEntrypointMock).toHaveBeenCalledWith(
        '@thepassle/app-tools',
        '0.10.2',
        'router.js',
      )
      expect(getDocNodesMock).not.toHaveBeenCalled()
      expect(result).toEqual({
        html: '<div>docs</div>',
        toc: '<nav>toc</nav>',
        nodes: [{ name: 'Router', kind: 'class' }],
      })
    })

    it('returns null when no doc nodes are found', async () => {
      getDocNodesMock.mockResolvedValue({ version: 1, nodes: [] })

      const result = await generateDocsWithDeno('pkg', '1.0.0')

      expect(result).toBeNull()
    })

    it('returns null when entrypoint has no doc nodes', async () => {
      getDocNodesForEntrypointMock.mockResolvedValue({ version: 1, nodes: [] })

      const result = await generateDocsWithDeno('pkg', '1.0.0', 'missing.js')

      expect(result).toBeNull()
    })
  })
})
