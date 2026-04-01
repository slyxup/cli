/**
 * Framework Adapter
 * 
 * Provides framework-specific configurations and file path mappings
 * to intelligently place files in the correct locations for each framework.
 */

import { AnalyzedProject, FrameworkType } from './project-analyzer.js';

// ============================================================================
// Types
// ============================================================================

export interface FilePathMapping {
  // Standard path -> Framework-specific path
  source: string;
  target: string;
  condition?: (project: AnalyzedProject) => boolean;
}

export interface FileModification {
  file: string;
  action: 'prepend' | 'append' | 'merge' | 'replace' | 'insert-import' | 'wrap-provider' | 'create' | 'copy' | 'insert-code' | 'modify-config';
  content: string;
  marker?: string;
  position?: 'top' | 'bottom' | 'after-imports' | 'before-exports' | 'at-marker';
}

export interface FrameworkConfig {
  name: string;
  displayName: string;
  
  // Path mappings for files
  pathMappings: FilePathMapping[];
  
  // Standard paths
  paths: {
    components: string;
    lib: string;
    utils: string;
    hooks: string;
    styles: string;
    pages: string;
    api: string;
    config: string;
    types: string;
    store: string;
    services: string;
  };
  
  // Entry files
  entryFiles: {
    main: string;
    styles: string;
    app: string;
    layout?: string;
  };
  
  // Config files
  configFiles: {
    bundler?: string;
    typescript?: string;
    framework?: string;
    styles?: string;
    postcss?: string;
    tailwind?: string;
    eslint?: string;
  };
  
  // Import styles
  importStyle: {
    extension: boolean;       // Include file extension in imports
    aliasPrefix: string;      // e.g., '@/', '~/', '$lib/'
    defaultExport: boolean;   // Prefer default exports
  };
  
  // Component conventions
  componentConventions: {
    extension: string;        // .tsx, .jsx, .vue, .svelte
    nameCase: 'pascal' | 'kebab' | 'camel';
    indexFile: boolean;       // Use index.ts files
    separateStyles: boolean;  // Separate style files
  };
  
  // Feature-specific adaptations
  featureAdaptations: Record<string, FeatureAdaptation>;
}

export interface FeatureAdaptation {
  // Override paths for this feature
  pathOverrides?: Record<string, string>;
  
  // Additional files to create
  additionalFiles?: Array<{
    source: string;
    target: string;
  }>;
  
  // Files to skip
  skipFiles?: string[];
  
  // Modifications specific to this framework
  modifications?: FileModification[];
  
  // Additional dependencies
  additionalDeps?: Record<string, string>;
  additionalDevDeps?: Record<string, string>;
  
  // Post-install commands
  postInstallCommands?: string[];
}

// ============================================================================
// Framework Configurations
// ============================================================================

const frameworkConfigs: Record<FrameworkType, FrameworkConfig> = {
  // React (Vite)
  react: {
    name: 'react',
    displayName: 'React',
    pathMappings: [
      { source: 'src/components', target: 'src/components' },
      { source: 'src/lib', target: 'src/lib' },
      { source: 'src/hooks', target: 'src/hooks' },
      { source: 'src/utils', target: 'src/utils' },
      { source: 'src/styles', target: 'src/styles' },
    ],
    paths: {
      components: 'src/components',
      lib: 'src/lib',
      utils: 'src/utils',
      hooks: 'src/hooks',
      styles: 'src/styles',
      pages: 'src/pages',
      api: 'src/api',
      config: 'src/config',
      types: 'src/types',
      store: 'src/store',
      services: 'src/services',
    },
    entryFiles: {
      main: 'src/main.tsx',
      styles: 'src/index.css',
      app: 'src/App.tsx',
    },
    configFiles: {
      bundler: 'vite.config.ts',
      typescript: 'tsconfig.json',
      tailwind: 'tailwind.config.js',
      postcss: 'postcss.config.js',
      eslint: 'eslint.config.js',
    },
    importStyle: {
      extension: false,
      aliasPrefix: '@/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.tsx',
      nameCase: 'pascal',
      indexFile: true,
      separateStyles: false,
    },
    featureAdaptations: {
      tailwind: {
        modifications: [
          {
            file: 'src/index.css',
            action: 'prepend',
            content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n',
            marker: '@tailwind',
          },
        ],
      },
      shadcn: {
        pathOverrides: {
          'components/ui': 'src/components/ui',
          'lib/utils.ts': 'src/lib/utils.ts',
        },
      },
      zustand: {
        pathOverrides: {
          'store': 'src/store',
        },
      },
    },
  },

  // Next.js (App Router)
  next: {
    name: 'next',
    displayName: 'Next.js',
    pathMappings: [
      { source: 'src/components', target: 'src/components', condition: (p) => p.structure.sourceDir === 'src' },
      { source: 'src/components', target: 'components', condition: (p) => p.structure.sourceDir === '' },
      { source: 'src/lib', target: 'src/lib', condition: (p) => p.structure.sourceDir === 'src' },
      { source: 'src/lib', target: 'lib', condition: (p) => p.structure.sourceDir === '' },
      { source: 'src/styles', target: 'src/styles', condition: (p) => p.structure.sourceDir === 'src' },
      { source: 'src/styles', target: 'styles', condition: (p) => p.structure.sourceDir === '' },
    ],
    paths: {
      components: 'src/components',
      lib: 'src/lib',
      utils: 'src/lib/utils',
      hooks: 'src/hooks',
      styles: 'src/styles',
      pages: 'src/app',
      api: 'src/app/api',
      config: 'src/config',
      types: 'src/types',
      store: 'src/store',
      services: 'src/services',
    },
    entryFiles: {
      main: 'src/app/layout.tsx',
      styles: 'src/app/globals.css',
      app: 'src/app/page.tsx',
      layout: 'src/app/layout.tsx',
    },
    configFiles: {
      framework: 'next.config.mjs',
      typescript: 'tsconfig.json',
      tailwind: 'tailwind.config.ts',
      postcss: 'postcss.config.mjs',
      eslint: 'eslint.config.mjs',
    },
    importStyle: {
      extension: false,
      aliasPrefix: '@/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.tsx',
      nameCase: 'pascal',
      indexFile: false,
      separateStyles: false,
    },
    featureAdaptations: {
      tailwind: {
        modifications: [
          {
            file: 'src/app/globals.css',
            action: 'prepend',
            content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n',
            marker: '@tailwind',
          },
        ],
        pathOverrides: {
          'tailwind.config.js': 'tailwind.config.ts',
        },
      },
      shadcn: {
        pathOverrides: {
          'components/ui': 'src/components/ui',
          'lib/utils.ts': 'src/lib/utils.ts',
        },
        additionalFiles: [
          { source: 'components.json', target: 'components.json' },
        ],
      },
      'next-auth': {
        pathOverrides: {
          'lib/auth.ts': 'src/lib/auth.ts',
        },
        additionalFiles: [
          { source: 'app/api/auth/[...nextauth]/route.ts', target: 'src/app/api/auth/[...nextauth]/route.ts' },
        ],
      },
      prisma: {
        pathOverrides: {
          'lib/prisma.ts': 'src/lib/prisma.ts',
        },
      },
      trpc: {
        pathOverrides: {
          'server/trpc.ts': 'src/server/trpc.ts',
          'server/routers': 'src/server/routers',
        },
        additionalFiles: [
          { source: 'app/api/trpc/[trpc]/route.ts', target: 'src/app/api/trpc/[trpc]/route.ts' },
        ],
      },
    },
  },

  // Vue 3 (Vite)
  vue: {
    name: 'vue',
    displayName: 'Vue',
    pathMappings: [
      { source: 'src/components', target: 'src/components' },
      { source: 'src/lib', target: 'src/lib' },
      { source: 'src/composables', target: 'src/composables' },
      { source: 'src/stores', target: 'src/stores' },
    ],
    paths: {
      components: 'src/components',
      lib: 'src/lib',
      utils: 'src/utils',
      hooks: 'src/composables',
      styles: 'src/assets/styles',
      pages: 'src/views',
      api: 'src/api',
      config: 'src/config',
      types: 'src/types',
      store: 'src/stores',
      services: 'src/services',
    },
    entryFiles: {
      main: 'src/main.ts',
      styles: 'src/assets/main.css',
      app: 'src/App.vue',
    },
    configFiles: {
      bundler: 'vite.config.ts',
      typescript: 'tsconfig.json',
      tailwind: 'tailwind.config.js',
      postcss: 'postcss.config.js',
      eslint: 'eslint.config.js',
    },
    importStyle: {
      extension: true,
      aliasPrefix: '@/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.vue',
      nameCase: 'pascal',
      indexFile: false,
      separateStyles: false,
    },
    featureAdaptations: {
      tailwind: {
        modifications: [
          {
            file: 'src/assets/main.css',
            action: 'prepend',
            content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n',
            marker: '@tailwind',
          },
        ],
      },
      pinia: {
        pathOverrides: {
          'store': 'src/stores',
        },
        modifications: [
          {
            file: 'src/main.ts',
            action: 'insert-import',
            content: "import { createPinia } from 'pinia'",
            position: 'top',
          },
        ],
      },
    },
  },

  // Nuxt 3
  nuxt: {
    name: 'nuxt',
    displayName: 'Nuxt',
    pathMappings: [
      { source: 'src/components', target: 'components' },
      { source: 'src/lib', target: 'utils' },
      { source: 'src/composables', target: 'composables' },
      { source: 'src/stores', target: 'stores' },
    ],
    paths: {
      components: 'components',
      lib: 'utils',
      utils: 'utils',
      hooks: 'composables',
      styles: 'assets/css',
      pages: 'pages',
      api: 'server/api',
      config: 'config',
      types: 'types',
      store: 'stores',
      services: 'server/services',
    },
    entryFiles: {
      main: 'app.vue',
      styles: 'assets/css/main.css',
      app: 'app.vue',
    },
    configFiles: {
      framework: 'nuxt.config.ts',
      typescript: 'tsconfig.json',
      tailwind: 'tailwind.config.js',
    },
    importStyle: {
      extension: true,
      aliasPrefix: '~/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.vue',
      nameCase: 'pascal',
      indexFile: false,
      separateStyles: false,
    },
    featureAdaptations: {
      tailwind: {
        additionalDevDeps: {
          '@nuxtjs/tailwindcss': '^6.11.0',
        },
        modifications: [
          {
            file: 'nuxt.config.ts',
            action: 'merge',
            content: "modules: ['@nuxtjs/tailwindcss']",
          },
        ],
      },
      prisma: {
        pathOverrides: {
          'lib/prisma.ts': 'server/utils/prisma.ts',
        },
      },
    },
  },

  // Angular
  angular: {
    name: 'angular',
    displayName: 'Angular',
    pathMappings: [
      { source: 'src/components', target: 'src/app/components' },
      { source: 'src/lib', target: 'src/app/services' },
      { source: 'src/services', target: 'src/app/services' },
    ],
    paths: {
      components: 'src/app/components',
      lib: 'src/app/lib',
      utils: 'src/app/utils',
      hooks: 'src/app/services',
      styles: 'src/styles',
      pages: 'src/app/pages',
      api: 'src/app/api',
      config: 'src/app/config',
      types: 'src/app/types',
      store: 'src/app/store',
      services: 'src/app/services',
    },
    entryFiles: {
      main: 'src/main.ts',
      styles: 'src/styles.css',
      app: 'src/app/app.component.ts',
    },
    configFiles: {
      framework: 'angular.json',
      typescript: 'tsconfig.json',
      tailwind: 'tailwind.config.js',
      postcss: 'postcss.config.js',
    },
    importStyle: {
      extension: false,
      aliasPrefix: '@/',
      defaultExport: false,
    },
    componentConventions: {
      extension: '.component.ts',
      nameCase: 'kebab',
      indexFile: false,
      separateStyles: true,
    },
    featureAdaptations: {
      tailwind: {
        modifications: [
          {
            file: 'src/styles.css',
            action: 'prepend',
            content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n',
            marker: '@tailwind',
          },
        ],
      },
    },
  },

  // Svelte (Vite)
  svelte: {
    name: 'svelte',
    displayName: 'Svelte',
    pathMappings: [
      { source: 'src/components', target: 'src/lib/components' },
      { source: 'src/lib', target: 'src/lib' },
    ],
    paths: {
      components: 'src/lib/components',
      lib: 'src/lib',
      utils: 'src/lib/utils',
      hooks: 'src/lib/stores',
      styles: 'src/styles',
      pages: 'src/routes',
      api: 'src/lib/api',
      config: 'src/lib/config',
      types: 'src/lib/types',
      store: 'src/lib/stores',
      services: 'src/lib/services',
    },
    entryFiles: {
      main: 'src/main.ts',
      styles: 'src/app.css',
      app: 'src/App.svelte',
    },
    configFiles: {
      bundler: 'vite.config.ts',
      typescript: 'tsconfig.json',
      tailwind: 'tailwind.config.js',
      postcss: 'postcss.config.js',
    },
    importStyle: {
      extension: true,
      aliasPrefix: '$lib/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.svelte',
      nameCase: 'pascal',
      indexFile: false,
      separateStyles: false,
    },
    featureAdaptations: {
      tailwind: {
        modifications: [
          {
            file: 'src/app.css',
            action: 'prepend',
            content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n',
            marker: '@tailwind',
          },
        ],
      },
    },
  },

  // SvelteKit
  sveltekit: {
    name: 'sveltekit',
    displayName: 'SvelteKit',
    pathMappings: [
      { source: 'src/components', target: 'src/lib/components' },
      { source: 'src/lib', target: 'src/lib' },
    ],
    paths: {
      components: 'src/lib/components',
      lib: 'src/lib',
      utils: 'src/lib/utils',
      hooks: 'src/lib/stores',
      styles: 'src/styles',
      pages: 'src/routes',
      api: 'src/routes/api',
      config: 'src/lib/config',
      types: 'src/lib/types',
      store: 'src/lib/stores',
      services: 'src/lib/server',
    },
    entryFiles: {
      main: 'src/app.html',
      styles: 'src/app.css',
      app: 'src/routes/+layout.svelte',
      layout: 'src/routes/+layout.svelte',
    },
    configFiles: {
      framework: 'svelte.config.js',
      bundler: 'vite.config.ts',
      typescript: 'tsconfig.json',
      tailwind: 'tailwind.config.js',
      postcss: 'postcss.config.js',
    },
    importStyle: {
      extension: true,
      aliasPrefix: '$lib/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.svelte',
      nameCase: 'pascal',
      indexFile: false,
      separateStyles: false,
    },
    featureAdaptations: {
      tailwind: {
        modifications: [
          {
            file: 'src/app.css',
            action: 'prepend',
            content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n',
            marker: '@tailwind',
          },
        ],
      },
      prisma: {
        pathOverrides: {
          'lib/prisma.ts': 'src/lib/server/prisma.ts',
        },
      },
    },
  },

  // Astro
  astro: {
    name: 'astro',
    displayName: 'Astro',
    pathMappings: [
      { source: 'src/components', target: 'src/components' },
      { source: 'src/lib', target: 'src/lib' },
    ],
    paths: {
      components: 'src/components',
      lib: 'src/lib',
      utils: 'src/lib/utils',
      hooks: 'src/lib',
      styles: 'src/styles',
      pages: 'src/pages',
      api: 'src/pages/api',
      config: 'src/config',
      types: 'src/types',
      store: 'src/stores',
      services: 'src/lib/services',
    },
    entryFiles: {
      main: 'src/pages/index.astro',
      styles: 'src/styles/global.css',
      app: 'src/layouts/Layout.astro',
      layout: 'src/layouts/Layout.astro',
    },
    configFiles: {
      framework: 'astro.config.mjs',
      typescript: 'tsconfig.json',
      tailwind: 'tailwind.config.mjs',
    },
    importStyle: {
      extension: true,
      aliasPrefix: '@/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.astro',
      nameCase: 'pascal',
      indexFile: false,
      separateStyles: false,
    },
    featureAdaptations: {
      tailwind: {
        additionalDevDeps: {
          '@astrojs/tailwind': '^5.1.0',
        },
        modifications: [
          {
            file: 'astro.config.mjs',
            action: 'merge',
            content: "import tailwind from '@astrojs/tailwind';\n// Add to integrations: tailwind()",
          },
        ],
      },
    },
  },

  // Solid
  solid: {
    name: 'solid',
    displayName: 'SolidJS',
    pathMappings: [
      { source: 'src/components', target: 'src/components' },
      { source: 'src/lib', target: 'src/lib' },
    ],
    paths: {
      components: 'src/components',
      lib: 'src/lib',
      utils: 'src/lib/utils',
      hooks: 'src/lib/signals',
      styles: 'src/styles',
      pages: 'src/pages',
      api: 'src/api',
      config: 'src/config',
      types: 'src/types',
      store: 'src/stores',
      services: 'src/services',
    },
    entryFiles: {
      main: 'src/index.tsx',
      styles: 'src/index.css',
      app: 'src/App.tsx',
    },
    configFiles: {
      bundler: 'vite.config.ts',
      typescript: 'tsconfig.json',
      tailwind: 'tailwind.config.js',
      postcss: 'postcss.config.js',
    },
    importStyle: {
      extension: false,
      aliasPrefix: '~/',
      defaultExport: false,
    },
    componentConventions: {
      extension: '.tsx',
      nameCase: 'pascal',
      indexFile: true,
      separateStyles: false,
    },
    featureAdaptations: {
      tailwind: {
        modifications: [
          {
            file: 'src/index.css',
            action: 'prepend',
            content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n',
            marker: '@tailwind',
          },
        ],
      },
    },
  },

  // Remix
  remix: {
    name: 'remix',
    displayName: 'Remix',
    pathMappings: [
      { source: 'src/components', target: 'app/components' },
      { source: 'src/lib', target: 'app/lib' },
    ],
    paths: {
      components: 'app/components',
      lib: 'app/lib',
      utils: 'app/utils',
      hooks: 'app/hooks',
      styles: 'app/styles',
      pages: 'app/routes',
      api: 'app/routes/api',
      config: 'app/config',
      types: 'app/types',
      store: 'app/stores',
      services: 'app/services',
    },
    entryFiles: {
      main: 'app/entry.client.tsx',
      styles: 'app/tailwind.css',
      app: 'app/root.tsx',
    },
    configFiles: {
      bundler: 'vite.config.ts',
      typescript: 'tsconfig.json',
      tailwind: 'tailwind.config.ts',
      postcss: 'postcss.config.js',
    },
    importStyle: {
      extension: false,
      aliasPrefix: '~/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.tsx',
      nameCase: 'pascal',
      indexFile: false,
      separateStyles: false,
    },
    featureAdaptations: {
      tailwind: {
        modifications: [
          {
            file: 'app/tailwind.css',
            action: 'prepend',
            content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n',
            marker: '@tailwind',
          },
        ],
      },
    },
  },

  // Express
  express: {
    name: 'express',
    displayName: 'Express.js',
    pathMappings: [
      { source: 'src/routes', target: 'src/routes' },
      { source: 'src/controllers', target: 'src/controllers' },
      { source: 'src/middleware', target: 'src/middleware' },
      { source: 'src/lib', target: 'src/lib' },
    ],
    paths: {
      components: 'src/controllers',
      lib: 'src/lib',
      utils: 'src/utils',
      hooks: 'src/middleware',
      styles: '',
      pages: 'src/routes',
      api: 'src/routes',
      config: 'src/config',
      types: 'src/types',
      store: 'src/services',
      services: 'src/services',
    },
    entryFiles: {
      main: 'src/index.ts',
      styles: '',
      app: 'src/app.ts',
    },
    configFiles: {
      typescript: 'tsconfig.json',
      eslint: 'eslint.config.js',
    },
    importStyle: {
      extension: true,
      aliasPrefix: '@/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.ts',
      nameCase: 'kebab',
      indexFile: true,
      separateStyles: false,
    },
    featureAdaptations: {
      prisma: {
        pathOverrides: {
          'lib/prisma.ts': 'src/lib/prisma.ts',
        },
      },
      swagger: {
        pathOverrides: {
          'config/swagger.ts': 'src/config/swagger.ts',
        },
      },
    },
  },

  // Fastify
  fastify: {
    name: 'fastify',
    displayName: 'Fastify',
    pathMappings: [
      { source: 'src/routes', target: 'src/routes' },
      { source: 'src/plugins', target: 'src/plugins' },
      { source: 'src/lib', target: 'src/lib' },
    ],
    paths: {
      components: 'src/routes',
      lib: 'src/lib',
      utils: 'src/utils',
      hooks: 'src/plugins',
      styles: '',
      pages: 'src/routes',
      api: 'src/routes',
      config: 'src/config',
      types: 'src/types',
      store: 'src/services',
      services: 'src/services',
    },
    entryFiles: {
      main: 'src/index.ts',
      styles: '',
      app: 'src/app.ts',
    },
    configFiles: {
      typescript: 'tsconfig.json',
      eslint: 'eslint.config.js',
    },
    importStyle: {
      extension: true,
      aliasPrefix: '@/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.ts',
      nameCase: 'kebab',
      indexFile: true,
      separateStyles: false,
    },
    featureAdaptations: {},
  },

  // NestJS
  nestjs: {
    name: 'nestjs',
    displayName: 'NestJS',
    pathMappings: [
      { source: 'src/modules', target: 'src/modules' },
      { source: 'src/common', target: 'src/common' },
      { source: 'src/lib', target: 'src/common' },
    ],
    paths: {
      components: 'src/modules',
      lib: 'src/common',
      utils: 'src/common/utils',
      hooks: 'src/common/interceptors',
      styles: '',
      pages: 'src/modules',
      api: 'src/modules',
      config: 'src/config',
      types: 'src/common/types',
      store: 'src/modules',
      services: 'src/common/services',
    },
    entryFiles: {
      main: 'src/main.ts',
      styles: '',
      app: 'src/app.module.ts',
    },
    configFiles: {
      framework: 'nest-cli.json',
      typescript: 'tsconfig.json',
      eslint: 'eslint.config.js',
    },
    importStyle: {
      extension: false,
      aliasPrefix: '@/',
      defaultExport: false,
    },
    componentConventions: {
      extension: '.ts',
      nameCase: 'kebab',
      indexFile: true,
      separateStyles: false,
    },
    featureAdaptations: {
      prisma: {
        pathOverrides: {
          'lib/prisma.ts': 'src/prisma/prisma.service.ts',
        },
        additionalFiles: [
          { source: 'prisma.module.ts', target: 'src/prisma/prisma.module.ts' },
        ],
      },
    },
  },

  // Gatsby
  gatsby: {
    name: 'gatsby',
    displayName: 'Gatsby',
    pathMappings: [
      { source: 'src/components', target: 'src/components' },
      { source: 'src/lib', target: 'src/lib' },
    ],
    paths: {
      components: 'src/components',
      lib: 'src/lib',
      utils: 'src/utils',
      hooks: 'src/hooks',
      styles: 'src/styles',
      pages: 'src/pages',
      api: 'src/api',
      config: 'src/config',
      types: 'src/types',
      store: 'src/store',
      services: 'src/services',
    },
    entryFiles: {
      main: 'gatsby-browser.js',
      styles: 'src/styles/global.css',
      app: 'src/pages/index.tsx',
    },
    configFiles: {
      framework: 'gatsby-config.ts',
      typescript: 'tsconfig.json',
      tailwind: 'tailwind.config.js',
      postcss: 'postcss.config.js',
    },
    importStyle: {
      extension: false,
      aliasPrefix: '@/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.tsx',
      nameCase: 'pascal',
      indexFile: true,
      separateStyles: false,
    },
    featureAdaptations: {
      tailwind: {
        additionalDevDeps: {
          'gatsby-plugin-postcss': '^6.0.0',
        },
      },
    },
  },

  // Default configs for other frameworks
  preact: {
    name: 'preact',
    displayName: 'Preact',
    pathMappings: [],
    paths: {
      components: 'src/components',
      lib: 'src/lib',
      utils: 'src/utils',
      hooks: 'src/hooks',
      styles: 'src/styles',
      pages: 'src/pages',
      api: 'src/api',
      config: 'src/config',
      types: 'src/types',
      store: 'src/store',
      services: 'src/services',
    },
    entryFiles: {
      main: 'src/index.tsx',
      styles: 'src/index.css',
      app: 'src/App.tsx',
    },
    configFiles: {
      bundler: 'vite.config.ts',
      typescript: 'tsconfig.json',
    },
    importStyle: {
      extension: false,
      aliasPrefix: '@/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.tsx',
      nameCase: 'pascal',
      indexFile: true,
      separateStyles: false,
    },
    featureAdaptations: {},
  },

  qwik: {
    name: 'qwik',
    displayName: 'Qwik',
    pathMappings: [],
    paths: {
      components: 'src/components',
      lib: 'src/lib',
      utils: 'src/lib/utils',
      hooks: 'src/hooks',
      styles: 'src/global.css',
      pages: 'src/routes',
      api: 'src/routes/api',
      config: 'src/config',
      types: 'src/types',
      store: 'src/stores',
      services: 'src/services',
    },
    entryFiles: {
      main: 'src/entry.ssr.tsx',
      styles: 'src/global.css',
      app: 'src/root.tsx',
    },
    configFiles: {
      bundler: 'vite.config.ts',
      typescript: 'tsconfig.json',
    },
    importStyle: {
      extension: false,
      aliasPrefix: '~/',
      defaultExport: false,
    },
    componentConventions: {
      extension: '.tsx',
      nameCase: 'pascal',
      indexFile: false,
      separateStyles: false,
    },
    featureAdaptations: {},
  },

  // Backend/Other frameworks
  hono: {
    name: 'hono',
    displayName: 'Hono',
    pathMappings: [],
    paths: {
      components: 'src/routes',
      lib: 'src/lib',
      utils: 'src/utils',
      hooks: 'src/middleware',
      styles: '',
      pages: 'src/routes',
      api: 'src/routes',
      config: 'src/config',
      types: 'src/types',
      store: 'src/services',
      services: 'src/services',
    },
    entryFiles: {
      main: 'src/index.ts',
      styles: '',
      app: 'src/app.ts',
    },
    configFiles: {
      typescript: 'tsconfig.json',
    },
    importStyle: {
      extension: true,
      aliasPrefix: '@/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.ts',
      nameCase: 'kebab',
      indexFile: true,
      separateStyles: false,
    },
    featureAdaptations: {},
  },

  elysia: {
    name: 'elysia',
    displayName: 'Elysia',
    pathMappings: [],
    paths: {
      components: 'src/routes',
      lib: 'src/lib',
      utils: 'src/utils',
      hooks: 'src/plugins',
      styles: '',
      pages: 'src/routes',
      api: 'src/routes',
      config: 'src/config',
      types: 'src/types',
      store: 'src/services',
      services: 'src/services',
    },
    entryFiles: {
      main: 'src/index.ts',
      styles: '',
      app: 'src/app.ts',
    },
    configFiles: {
      typescript: 'tsconfig.json',
    },
    importStyle: {
      extension: true,
      aliasPrefix: '@/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.ts',
      nameCase: 'kebab',
      indexFile: true,
      separateStyles: false,
    },
    featureAdaptations: {},
  },

  koa: {
    name: 'koa',
    displayName: 'Koa',
    pathMappings: [],
    paths: {
      components: 'src/routes',
      lib: 'src/lib',
      utils: 'src/utils',
      hooks: 'src/middleware',
      styles: '',
      pages: 'src/routes',
      api: 'src/routes',
      config: 'src/config',
      types: 'src/types',
      store: 'src/services',
      services: 'src/services',
    },
    entryFiles: {
      main: 'src/index.ts',
      styles: '',
      app: 'src/app.ts',
    },
    configFiles: {
      typescript: 'tsconfig.json',
    },
    importStyle: {
      extension: true,
      aliasPrefix: '@/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.ts',
      nameCase: 'kebab',
      indexFile: true,
      separateStyles: false,
    },
    featureAdaptations: {},
  },

  hapi: {
    name: 'hapi',
    displayName: 'Hapi',
    pathMappings: [],
    paths: {
      components: 'src/routes',
      lib: 'src/lib',
      utils: 'src/utils',
      hooks: 'src/plugins',
      styles: '',
      pages: 'src/routes',
      api: 'src/routes',
      config: 'src/config',
      types: 'src/types',
      store: 'src/services',
      services: 'src/services',
    },
    entryFiles: {
      main: 'src/index.ts',
      styles: '',
      app: 'src/server.ts',
    },
    configFiles: {
      typescript: 'tsconfig.json',
    },
    importStyle: {
      extension: true,
      aliasPrefix: '@/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.ts',
      nameCase: 'kebab',
      indexFile: true,
      separateStyles: false,
    },
    featureAdaptations: {},
  },

  // Mobile/Desktop
  'react-native': {
    name: 'react-native',
    displayName: 'React Native',
    pathMappings: [],
    paths: {
      components: 'src/components',
      lib: 'src/lib',
      utils: 'src/utils',
      hooks: 'src/hooks',
      styles: 'src/styles',
      pages: 'src/screens',
      api: 'src/api',
      config: 'src/config',
      types: 'src/types',
      store: 'src/store',
      services: 'src/services',
    },
    entryFiles: {
      main: 'index.js',
      styles: '',
      app: 'App.tsx',
    },
    configFiles: {
      typescript: 'tsconfig.json',
      framework: 'app.json',
    },
    importStyle: {
      extension: false,
      aliasPrefix: '@/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.tsx',
      nameCase: 'pascal',
      indexFile: true,
      separateStyles: false,
    },
    featureAdaptations: {},
  },

  expo: {
    name: 'expo',
    displayName: 'Expo',
    pathMappings: [],
    paths: {
      components: 'src/components',
      lib: 'src/lib',
      utils: 'src/utils',
      hooks: 'src/hooks',
      styles: 'src/styles',
      pages: 'app',
      api: 'src/api',
      config: 'src/config',
      types: 'src/types',
      store: 'src/store',
      services: 'src/services',
    },
    entryFiles: {
      main: 'app/_layout.tsx',
      styles: '',
      app: 'app/_layout.tsx',
    },
    configFiles: {
      typescript: 'tsconfig.json',
      framework: 'app.json',
    },
    importStyle: {
      extension: false,
      aliasPrefix: '@/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.tsx',
      nameCase: 'pascal',
      indexFile: true,
      separateStyles: false,
    },
    featureAdaptations: {},
  },

  ionic: {
    name: 'ionic',
    displayName: 'Ionic',
    pathMappings: [],
    paths: {
      components: 'src/components',
      lib: 'src/lib',
      utils: 'src/utils',
      hooks: 'src/hooks',
      styles: 'src/theme',
      pages: 'src/pages',
      api: 'src/api',
      config: 'src/config',
      types: 'src/types',
      store: 'src/store',
      services: 'src/services',
    },
    entryFiles: {
      main: 'src/main.tsx',
      styles: 'src/theme/variables.css',
      app: 'src/App.tsx',
    },
    configFiles: {
      framework: 'ionic.config.json',
      typescript: 'tsconfig.json',
    },
    importStyle: {
      extension: false,
      aliasPrefix: '@/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.tsx',
      nameCase: 'pascal',
      indexFile: true,
      separateStyles: false,
    },
    featureAdaptations: {},
  },

  capacitor: {
    name: 'capacitor',
    displayName: 'Capacitor',
    pathMappings: [],
    paths: {
      components: 'src/components',
      lib: 'src/lib',
      utils: 'src/utils',
      hooks: 'src/hooks',
      styles: 'src/styles',
      pages: 'src/pages',
      api: 'src/api',
      config: 'src/config',
      types: 'src/types',
      store: 'src/store',
      services: 'src/services',
    },
    entryFiles: {
      main: 'src/main.tsx',
      styles: 'src/index.css',
      app: 'src/App.tsx',
    },
    configFiles: {
      framework: 'capacitor.config.ts',
      typescript: 'tsconfig.json',
    },
    importStyle: {
      extension: false,
      aliasPrefix: '@/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.tsx',
      nameCase: 'pascal',
      indexFile: true,
      separateStyles: false,
    },
    featureAdaptations: {},
  },

  electron: {
    name: 'electron',
    displayName: 'Electron',
    pathMappings: [],
    paths: {
      components: 'src/renderer/components',
      lib: 'src/lib',
      utils: 'src/utils',
      hooks: 'src/renderer/hooks',
      styles: 'src/renderer/styles',
      pages: 'src/renderer/pages',
      api: 'src/main',
      config: 'src/config',
      types: 'src/types',
      store: 'src/renderer/store',
      services: 'src/main/services',
    },
    entryFiles: {
      main: 'src/main/index.ts',
      styles: 'src/renderer/index.css',
      app: 'src/renderer/App.tsx',
    },
    configFiles: {
      typescript: 'tsconfig.json',
      bundler: 'electron-builder.yml',
    },
    importStyle: {
      extension: false,
      aliasPrefix: '@/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.tsx',
      nameCase: 'pascal',
      indexFile: true,
      separateStyles: false,
    },
    featureAdaptations: {},
  },

  tauri: {
    name: 'tauri',
    displayName: 'Tauri',
    pathMappings: [],
    paths: {
      components: 'src/components',
      lib: 'src/lib',
      utils: 'src/utils',
      hooks: 'src/hooks',
      styles: 'src/styles',
      pages: 'src/pages',
      api: 'src-tauri',
      config: 'src/config',
      types: 'src/types',
      store: 'src/store',
      services: 'src/services',
    },
    entryFiles: {
      main: 'src/main.tsx',
      styles: 'src/styles.css',
      app: 'src/App.tsx',
    },
    configFiles: {
      framework: 'src-tauri/tauri.conf.json',
      typescript: 'tsconfig.json',
      bundler: 'vite.config.ts',
    },
    importStyle: {
      extension: false,
      aliasPrefix: '@/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.tsx',
      nameCase: 'pascal',
      indexFile: true,
      separateStyles: false,
    },
    featureAdaptations: {},
  },

  // Full-stack
  t3: {
    name: 't3',
    displayName: 'T3 Stack',
    pathMappings: [
      { source: 'src/components', target: 'src/components' },
      { source: 'src/lib', target: 'src/lib' },
    ],
    paths: {
      components: 'src/components',
      lib: 'src/lib',
      utils: 'src/lib/utils',
      hooks: 'src/hooks',
      styles: 'src/styles',
      pages: 'src/app',
      api: 'src/server/api',
      config: 'src/config',
      types: 'src/types',
      store: 'src/store',
      services: 'src/server/services',
    },
    entryFiles: {
      main: 'src/app/layout.tsx',
      styles: 'src/styles/globals.css',
      app: 'src/app/page.tsx',
      layout: 'src/app/layout.tsx',
    },
    configFiles: {
      framework: 'next.config.mjs',
      typescript: 'tsconfig.json',
      tailwind: 'tailwind.config.ts',
    },
    importStyle: {
      extension: false,
      aliasPrefix: '~/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.tsx',
      nameCase: 'pascal',
      indexFile: false,
      separateStyles: false,
    },
    featureAdaptations: {},
  },

  blitz: {
    name: 'blitz',
    displayName: 'Blitz.js',
    pathMappings: [],
    paths: {
      components: 'src/components',
      lib: 'src/lib',
      utils: 'src/utils',
      hooks: 'src/hooks',
      styles: 'src/styles',
      pages: 'src/pages',
      api: 'src/api',
      config: 'src/config',
      types: 'src/types',
      store: 'src/store',
      services: 'src/services',
    },
    entryFiles: {
      main: 'src/blitz-client.ts',
      styles: 'src/styles/globals.css',
      app: 'src/pages/_app.tsx',
    },
    configFiles: {
      framework: 'blitz.config.ts',
      typescript: 'tsconfig.json',
    },
    importStyle: {
      extension: false,
      aliasPrefix: 'src/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.tsx',
      nameCase: 'pascal',
      indexFile: false,
      separateStyles: false,
    },
    featureAdaptations: {},
  },

  redwood: {
    name: 'redwood',
    displayName: 'RedwoodJS',
    pathMappings: [],
    paths: {
      components: 'web/src/components',
      lib: 'web/src/lib',
      utils: 'web/src/lib',
      hooks: 'web/src/hooks',
      styles: 'web/src/index.css',
      pages: 'web/src/pages',
      api: 'api/src',
      config: 'web/config',
      types: 'web/types',
      store: 'web/src/store',
      services: 'api/src/services',
    },
    entryFiles: {
      main: 'web/src/App.tsx',
      styles: 'web/src/index.css',
      app: 'web/src/App.tsx',
    },
    configFiles: {
      framework: 'redwood.toml',
      typescript: 'tsconfig.json',
    },
    importStyle: {
      extension: false,
      aliasPrefix: 'src/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.tsx',
      nameCase: 'pascal',
      indexFile: false,
      separateStyles: false,
    },
    featureAdaptations: {},
  },

  // Generic/Unknown
  node: {
    name: 'node',
    displayName: 'Node.js',
    pathMappings: [],
    paths: {
      components: 'src',
      lib: 'src/lib',
      utils: 'src/utils',
      hooks: 'src/middleware',
      styles: '',
      pages: 'src',
      api: 'src',
      config: 'src/config',
      types: 'src/types',
      store: 'src/services',
      services: 'src/services',
    },
    entryFiles: {
      main: 'src/index.ts',
      styles: '',
      app: 'src/app.ts',
    },
    configFiles: {
      typescript: 'tsconfig.json',
    },
    importStyle: {
      extension: true,
      aliasPrefix: '@/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.ts',
      nameCase: 'kebab',
      indexFile: true,
      separateStyles: false,
    },
    featureAdaptations: {},
  },

  unknown: {
    name: 'unknown',
    displayName: 'Unknown',
    pathMappings: [],
    paths: {
      components: 'src/components',
      lib: 'src/lib',
      utils: 'src/utils',
      hooks: 'src/hooks',
      styles: 'src/styles',
      pages: 'src/pages',
      api: 'src/api',
      config: 'src/config',
      types: 'src/types',
      store: 'src/store',
      services: 'src/services',
    },
    entryFiles: {
      main: 'src/index.ts',
      styles: 'src/styles/index.css',
      app: 'src/App.tsx',
    },
    configFiles: {
      typescript: 'tsconfig.json',
    },
    importStyle: {
      extension: false,
      aliasPrefix: '@/',
      defaultExport: true,
    },
    componentConventions: {
      extension: '.tsx',
      nameCase: 'pascal',
      indexFile: true,
      separateStyles: false,
    },
    featureAdaptations: {},
  },
};

// ============================================================================
// Framework Adapter Class
// ============================================================================

export class FrameworkAdapter {
  private project: AnalyzedProject;
  private config: FrameworkConfig;

  constructor(project: AnalyzedProject) {
    this.project = project;
    this.config = frameworkConfigs[project.framework] || frameworkConfigs.unknown;
  }

  /**
   * Get the framework configuration
   */
  getConfig(): FrameworkConfig {
    return this.config;
  }

  /**
   * Get the target path for a source path based on framework conventions
   */
  getTargetPath(sourcePath: string): string {
    // Check path mappings first
    for (const mapping of this.config.pathMappings) {
      if (sourcePath.startsWith(mapping.source)) {
        // Check condition if present
        if (mapping.condition && !mapping.condition(this.project)) {
          continue;
        }
        return sourcePath.replace(mapping.source, mapping.target);
      }
    }

    // Apply standard path transformations
    const pathMap: Record<string, string> = {
      'src/components': this.config.paths.components,
      'src/lib': this.config.paths.lib,
      'src/utils': this.config.paths.utils,
      'src/hooks': this.config.paths.hooks,
      'src/styles': this.config.paths.styles,
      'src/pages': this.config.paths.pages,
      'src/api': this.config.paths.api,
      'src/config': this.config.paths.config,
      'src/types': this.config.paths.types,
      'src/store': this.config.paths.store,
      'src/services': this.config.paths.services,
    };

    for (const [src, target] of Object.entries(pathMap)) {
      if (sourcePath.startsWith(src) && target) {
        return sourcePath.replace(src, target);
      }
    }

    return sourcePath;
  }

  /**
   * Get feature-specific adaptation for this framework
   */
  getFeatureAdaptation(featureName: string): FeatureAdaptation | undefined {
    return this.config.featureAdaptations[featureName];
  }

  /**
   * Get the main entry file path
   */
  getMainEntry(): string {
    return this.config.entryFiles.main;
  }

  /**
   * Get the main styles file path
   */
  getMainStyles(): string {
    return this.config.entryFiles.styles;
  }

  /**
   * Get the app component path
   */
  getAppComponent(): string {
    return this.config.entryFiles.app;
  }

  /**
   * Get the layout component path (if applicable)
   */
  getLayoutComponent(): string | undefined {
    return this.config.entryFiles.layout;
  }

  /**
   * Get config file path by type
   */
  getConfigFile(type: keyof FrameworkConfig['configFiles']): string | undefined {
    return this.config.configFiles[type];
  }

  /**
   * Get the component extension for this framework
   */
  getComponentExtension(): string {
    return this.config.componentConventions.extension;
  }

  /**
   * Get the import alias prefix for this framework
   */
  getImportAlias(): string {
    return this.config.importStyle.aliasPrefix;
  }

  /**
   * Check if imports should include file extensions
   */
  shouldIncludeExtension(): boolean {
    return this.config.importStyle.extension;
  }

  /**
   * Get all paths for a specific path type
   */
  getPath(type: keyof FrameworkConfig['paths']): string {
    return this.config.paths[type];
  }

  /**
   * Transform a generic file path to framework-specific path
   */
  transformFilePath(genericPath: string, featureName?: string): string {
    // Check feature-specific overrides first
    if (featureName) {
      const adaptation = this.getFeatureAdaptation(featureName);
      if (adaptation?.pathOverrides) {
        for (const [src, target] of Object.entries(adaptation.pathOverrides)) {
          if (genericPath === src || genericPath.endsWith(src)) {
            return genericPath.replace(src, target);
          }
        }
      }
    }

    // Use general path transformation
    return this.getTargetPath(genericPath);
  }

  /**
   * Get modifications for a feature
   */
  getFeatureModifications(featureName: string): FileModification[] {
    const adaptation = this.getFeatureAdaptation(featureName);
    return adaptation?.modifications || [];
  }

  /**
   * Get additional dependencies for a feature
   */
  getAdditionalDependencies(featureName: string): { deps: Record<string, string>; devDeps: Record<string, string> } {
    const adaptation = this.getFeatureAdaptation(featureName);
    return {
      deps: adaptation?.additionalDeps || {},
      devDeps: adaptation?.additionalDevDeps || {},
    };
  }

  /**
   * Get files to skip for a feature
   */
  getSkipFiles(featureName: string): string[] {
    const adaptation = this.getFeatureAdaptation(featureName);
    return adaptation?.skipFiles || [];
  }

  /**
   * Get additional files for a feature
   */
  getAdditionalFiles(featureName: string): Array<{ source: string; target: string }> {
    const adaptation = this.getFeatureAdaptation(featureName);
    return adaptation?.additionalFiles || [];
  }

  /**
   * Check if framework is frontend
   */
  isFrontend(): boolean {
    const frontendFrameworks: FrameworkType[] = [
      'react', 'next', 'vue', 'nuxt', 'angular', 'svelte', 'sveltekit',
      'astro', 'solid', 'remix', 'gatsby', 'preact', 'qwik',
    ];
    return frontendFrameworks.includes(this.project.framework);
  }

  /**
   * Check if framework is backend
   */
  isBackend(): boolean {
    const backendFrameworks: FrameworkType[] = [
      'express', 'fastify', 'nestjs', 'koa', 'hono', 'elysia', 'hapi', 'node',
    ];
    return backendFrameworks.includes(this.project.framework);
  }

  /**
   * Check if framework is full-stack
   */
  isFullStack(): boolean {
    const fullStackFrameworks: FrameworkType[] = [
      'next', 'nuxt', 'sveltekit', 'remix', 't3', 'blitz', 'redwood',
    ];
    return fullStackFrameworks.includes(this.project.framework);
  }

  /**
   * Check if framework supports a feature
   */
  supportsFeature(featureName: string): boolean {
    // Check known incompatibilities
    const incompatibilities: Record<string, FrameworkType[]> = {
      'pinia': ['react', 'next', 'solid', 'svelte', 'sveltekit', 'astro', 'angular'],
      'zustand': ['vue', 'nuxt', 'angular', 'svelte', 'sveltekit'],
      'react-query': ['vue', 'nuxt', 'angular', 'svelte', 'sveltekit'],
      'swr': ['vue', 'nuxt', 'angular', 'svelte', 'sveltekit'],
      'next-auth': ['react', 'vue', 'nuxt', 'angular', 'svelte', 'sveltekit', 'solid', 'astro'],
      'shadcn': ['vue', 'nuxt', 'angular', 'svelte', 'sveltekit', 'solid', 'astro'],
    };

    const incompatibleFrameworks = incompatibilities[featureName];
    if (incompatibleFrameworks && incompatibleFrameworks.includes(this.project.framework)) {
      return false;
    }

    return true;
  }
}

// ============================================================================
// Factory function
// ============================================================================

export function createFrameworkAdapter(project: AnalyzedProject): FrameworkAdapter {
  return new FrameworkAdapter(project);
}

// ============================================================================
// Exports
// ============================================================================

export { frameworkConfigs };
