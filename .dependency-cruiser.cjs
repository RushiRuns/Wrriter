/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'shared-no-outer-imports',
      comment: 'src/shared is pure TypeScript domain logic and cannot import from other layers (ARCHITECTURE.md)',
      severity: 'error',
      from: { path: '^src/shared' },
      to: {
        path: '^src/(main|workers|preload|renderer)'
      }
    },
    {
      name: 'shared-no-node-or-electron',
      comment: 'src/shared cannot import Node builtins or Electron (ARCHITECTURE.md rule 22)',
      severity: 'error',
      from: { path: '^src/shared' },
      to: {
        dependencyTypes: ['core'],
        path: '^(node:|fs|path|crypto|child_process|electron)'
      }
    },
    {
      name: 'renderer-no-main-or-workers-or-preload',
      comment: 'src/renderer cannot import from main, workers, or preload (ARCHITECTURE.md rule 1)',
      severity: 'error',
      from: { path: '^src/renderer' },
      to: {
        path: '^src/(main|workers|preload)'
      }
    },
    {
      name: 'renderer-no-node-or-electron',
      comment: 'src/renderer runs in a sandboxed browser environment with Node off (ARCHITECTURE.md)',
      severity: 'error',
      from: { path: '^src/renderer' },
      to: {
        dependencyTypes: ['core'],
        path: '^(node:|fs|child_process|electron)'
      }
    },
    {
      name: 'preload-no-main-or-workers-or-renderer',
      comment: 'src/preload cannot import from main, workers, or renderer (ARCHITECTURE.md)',
      severity: 'error',
      from: { path: '^src/preload' },
      to: {
        path: '^src/(main|workers|renderer)'
      }
    },
    {
      name: 'main-no-renderer',
      comment: 'src/main cannot import from src/renderer (ARCHITECTURE.md)',
      severity: 'error',
      from: { path: '^src/main' },
      to: {
        path: '^src/renderer'
      }
    }
  ],
  options: {
    doNotFollow: {
      path: 'node_modules'
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json'
    }
  }
};
