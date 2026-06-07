/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'This dependency is part of a circular relationship. You might want to revise ' +
        'your solution (i.e. use dependency inversion, make sure the modules have a single responsibility) ',
      from: {},
      to: {
        circular: true
      }
    },
    {
      name: 'no-orphans',
      comment:
        "This is an orphan module - it's likely not used (anymore?). Either use it or remove it. If it's " +
        "logical this module is an orphan (i.e. it's a config file), add an exception for it in your " +
        'dependency-cruiser configuration. By default dependency-cruiser will ignore dotfiles.',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          String.raw`(^|/)\.[^/]+\.(c?js|ts|mjs|cjs)$`, // dot files
          String.raw`\.d\.ts$`,                         // TypeScript declaration files
          String.raw`(^|/)tsconfig\..*\.json$`,         // tsconfig files
          String.raw`(^|/)(babel|jest|webpack)\..*\.(c?js|ts|mjs|cjs|json)$`, // tool configurations
          String.raw`(^|/)packages/core/src/index\.(c?js|ts|mjs|cjs)$`, // index files
          String.raw`(^|/)packages/core/src/main\.ts$`                 // main entry point
        ]
      },
      to: {}
    },
    {
      name: 'not-to-deprecated',
      comment:
        'This module uses a (version of an) npm module that has been deprecated. Either upgrade to a later ' +
        'version of that module, or find an alternative. The npm site (https://www.npmjs.com) and npmtrends ' +
        '(https://www.npmtrends.com) can help you with this.',
      severity: 'warn',
      from: {},
      to: {
        dependencyTypes: [
          'deprecated'
        ]
      }
    }
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
      dependencyTypes: [
        'npm',
        'npm-dev',
        'npm-optional',
        'npm-peer',
        'npm-bundled',
        'npm-no-pkg'
      ]
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json'
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings']
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/(@[^/]+/[^/]+|[^/]+)',
        theme: {
          graph: {
            bgcolor: 'lightgray',
            color: 'black',
            fontcolor: 'black',
            fillcolor: 'transparent',
            splines: 'ortho'
          },
          modules: [
            {
              criteria: { source: '^packages/core/src/core' },
              attributes: { fillcolor: '#ccccff' }
            },
            {
              criteria: { source: '^packages/core/src/director' },
              attributes: { fillcolor: '#ccffcc' }
            },
            {
              criteria: { source: '^packages/core/src/editor' },
              attributes: { fillcolor: '#ffcccc' }
            },
            {
              criteria: { source: '^packages/core/src/platform' },
              attributes: { fillcolor: '#ffffcc' }
            },
            {
              criteria: { source: '^packages/core/src/shared' },
              attributes: { fillcolor: '#ffccff' }
            }
          ],
          dependencies: [
            {
              criteria: { resolved: '^packages/core/src/core' },
              attributes: { color: '#0000ff77' }
            },
            {
              criteria: { resolved: '^packages/core/src/director' },
              attributes: { color: '#00770077' }
            },
            {
              criteria: { resolved: '^packages/core/src/editor' },
              attributes: { color: '#ff000077' }
            },
            {
              criteria: { resolved: '^packages/core/src/platform' },
              attributes: { color: '#ffff0077' }
            },
            {
              criteria: { resolved: '^packages/core/src/shared' },
              attributes: { color: '#ff00ff77' }
            }
          ]
        }
      }
    }
  }
};
