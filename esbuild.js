const esbuild = require('esbuild')
const watch = process.argv.includes('--watch')

async function build() {
  const baseConfig = {
    bundle: true,
    minify: false,
    sourcemap: true,
  }

  const configs = [
    {
      ...baseConfig,
      entryPoints: ['src/extension.ts'],
      platform: 'node',
      target: 'node20',
      outfile: 'dist/extension.js',
      external: ['vscode'],
      format: 'cjs',
    },
    {
      ...baseConfig,
      entryPoints: ['src/webview/renderer.ts'],
      platform: 'browser',
      outfile: 'dist/renderer.js',
      format: 'iife',
    },
  ]

  if (watch) {
    const contexts = await Promise.all(configs.map(c => esbuild.context(c)))
    await Promise.all(contexts.map(ctx => ctx.watch()))
    console.log('Watching for changes...')
  } else {
    await Promise.all(configs.map(c => esbuild.build(c)))
    console.log('Build complete')
  }
}

build().catch(() => process.exit(1))
