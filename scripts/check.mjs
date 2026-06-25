import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
);

const commands = [
    {
        label: 'Syntax check theme-init.js',
        command: process.execPath,
        args: ['--check', 'js/theme-init.js'],
    },
    {
        label: 'Syntax check main.js',
        command: process.execPath,
        args: ['--check', 'js/main.js'],
    },
    {
        label: 'Run Node test suite',
        command: process.execPath,
        args: ['--test'],
    },
];

for (const { label, command, args } of commands) {
    console.log(`\n> ${label}`);

    const result = spawnSync(command, args, {
        cwd: rootDirectory,
        stdio: 'inherit',
    });

    if (result.error) {
        console.error(`Failed to start ${label}: ${result.error.message}`);
        process.exit(1);
    }

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}
