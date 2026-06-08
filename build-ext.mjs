// Сборка пакетов расширения. Один код в ext/, два манифеста.
//   node build-ext.mjs
// Результат:
//   dist/firefox/         — распакованное для Firefox (manifest.json = firefox-вариант)
//   dist/noet-firefox.xpi — упакованное для Firefox
// Chrome/Vivaldi грузят саму папку ext/ как есть (Load unpacked).

import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, cpSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const EXT = join(__dir, 'ext');
const DIST = join(__dir, 'dist');
const FF = join(DIST, 'firefox');

rmSync(FF, { recursive: true, force: true });
mkdirSync(FF, { recursive: true });
cpSync(EXT, FF, { recursive: true });
// manifest.json у Firefox = firefox-вариант; исходный chrome-манифест и тестовое убрать
copyFileSync(join(FF, 'manifest.firefox.json'), join(FF, 'manifest.json'));
rmSync(join(FF, 'manifest.firefox.json'), { force: true });

const XPI = join(DIST, 'noet-firefox.xpi');
rmSync(XPI, { force: true });
execSync(`cd "${FF}" && zip -r -q "${XPI}" . -x "*.DS_Store" -x "harness.html"`);

console.log('Firefox: dist/firefox/  и  dist/noet-firefox.xpi');
console.log('Chrome/Vivaldi: грузить папку ext/ как есть.');
