import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const EXT_DIR = join(__dir, 'extension');
const DIST_DIR = join(__dir, 'dist');
const XPI_OUT = join(DIST_DIR, 'noet.xpi');
const XML_OUT = join(DIST_DIR, 'updates.firefox.json');

if (!existsSync(DIST_DIR)) mkdirSync(DIST_DIR, { recursive: true });

const manifest = JSON.parse(readFileSync(join(EXT_DIR, 'manifest.firefox.json'), 'utf8'));
const VERSION = manifest.version;
const EXT_ID = manifest.browser_specific_settings.gecko.id;

// сборка XPI: подменяем manifest.json на firefox-версию
const TMP_DIR = join(DIST_DIR, '_xpi_tmp');
execSync(`rm -rf "${TMP_DIR}" && mkdir -p "${TMP_DIR}"`);
execSync(`cp -r "${EXT_DIR}/." "${TMP_DIR}/"`);
copyFileSync(join(EXT_DIR, 'manifest.firefox.json'), join(TMP_DIR, 'manifest.json'));

execSync(`cd "${TMP_DIR}" && zip -r "${XPI_OUT}" . -x "key.pem" -x "manifest.firefox.json" -x "*.DS_Store" -x "__MACOSX/*" -q`);
execSync(`rm -rf "${TMP_DIR}"`);

console.log(`XPI: ${XPI_OUT} (${(readFileSync(XPI_OUT).length / 1024).toFixed(1)} KB)`);

// updates.firefox.json
const UPDATE_BASE = 'https://noet-scz.github.io/noet/dist';
const json = JSON.stringify({
  addons: {
    [EXT_ID]: {
      updates: [{ version: VERSION, update_link: `${UPDATE_BASE}/noet.xpi` }]
    }
  }
}, null, 2);
writeFileSync(XML_OUT, json);
console.log(`JSON: ${XML_OUT} (v${VERSION})`);
