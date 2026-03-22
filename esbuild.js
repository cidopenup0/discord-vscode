const esbuild = require('esbuild');
const { rmSync, mkdirSync } = require('node:fs');

async function build() {
    rmSync('out', { recursive: true, force: true });
    mkdirSync('out', { recursive: true });

    await esbuild.build({
        entryPoints: ['src/extension.ts'],
        bundle: true,
        minify: true,
        platform: 'node',
        format: 'cjs',
        target: 'node20',
        outfile: 'out/extension.js',
        external: ['vscode'],
        sourcemap: false,
    });
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
