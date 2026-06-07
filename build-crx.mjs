// Сборщик CRX3 для расширения noet.
// Использование: node build-crx.mjs
// Результат: dist/noet.crx + dist/updates.xml
import { createSign, createPublicKey } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const EXT_DIR = join(__dir, 'extension');
const DIST_DIR = join(__dir, 'dist');
const KEY_FILE = join(EXT_DIR, 'key.pem');
const CRX_OUT = join(DIST_DIR, 'noet.crx');
const XML_OUT = join(DIST_DIR, 'updates.xml');

if (!existsSync(KEY_FILE)) { console.error('key.pem не найден'); process.exit(1); }
if (!existsSync(DIST_DIR)) mkdirSync(DIST_DIR, { recursive: true });

// --- читаем версию ---
const manifest = JSON.parse(readFileSync(join(EXT_DIR, 'manifest.json'), 'utf8'));
const VERSION = manifest.version;

// --- собираем ZIP расширения (без key.pem и лишнего) ---
const ZIP_TMP = join(DIST_DIR, '_ext.zip');
execSync(`cd "${EXT_DIR}" && zip -r "${ZIP_TMP}" . -x "key.pem" -x "*.DS_Store" -x "__MACOSX/*" -q`);
const zipData = readFileSync(ZIP_TMP);

// --- получаем DER публичного ключа ---
const privPem = readFileSync(KEY_FILE);
const pubKey = createPublicKey(privPem);
const pubDer = pubKey.export({ type: 'spki', format: 'der' });

// --- вычисляем extension ID (первые 16 байт SHA256(pubDer), в алфавите a-p) ---
import { createHash } from 'node:crypto';
const idBytes = createHash('sha256').update(pubDer).digest().subarray(0, 16);
const extId = Array.from(idBytes).map(b => String.fromCharCode(97 + (b >> 4)) + String.fromCharCode(97 + (b & 0xf))).join('');
console.log('Extension ID:', extId);

// --- CRX3: строим SignedData protobuf ---
// SignedData { crx_id (field 1, bytes) = idBytes }
function encodeVarint(n) {
  const out = [];
  while (n > 0x7f) { out.push((n & 0x7f) | 0x80); n >>>= 7; }
  out.push(n & 0x7f);
  return Buffer.from(out);
}
function protoBytes(field, data) {
  const tag = Buffer.from([(field << 3) | 2]);
  return Buffer.concat([tag, encodeVarint(data.length), data]);
}
const signedData = protoBytes(1, idBytes); // SignedData.crx_id

// --- подписываем: "CRX3 SignedData\x00" + varint(len(signedData)) + signedData + zip ---
const prefix = Buffer.from('CRX3 SignedData\x00');
const toSign = Buffer.concat([prefix, encodeVarint(signedData.length), signedData, zipData]);
const signer = createSign('RSA-SHA256');
signer.update(toSign);
const sig = signer.sign(privPem);

// --- строим CrxFileHeader protobuf ---
// AsymmetricKeyProof { public_key (1), signature (2) }
const proof = Buffer.concat([protoBytes(1, pubDer), protoBytes(2, sig)]);
// CrxFileHeader { sha256_with_rsa (2) = proof, signed_header_data (10000) = signedData }
const header = Buffer.concat([protoBytes(2, proof), protoBytes(10000, signedData)]);

// --- финальный CRX3 ---
const magic = Buffer.from('Cr24');
const version = Buffer.allocUnsafe(4); version.writeUInt32LE(3);
const headerLen = Buffer.allocUnsafe(4); headerLen.writeUInt32LE(header.length);
const crx = Buffer.concat([magic, version, headerLen, header, zipData]);
writeFileSync(CRX_OUT, crx);
console.log(`CRX: ${CRX_OUT} (${(crx.length / 1024).toFixed(1)} KB)`);

// --- updates.xml ---
const UPDATE_BASE = 'https://noet-scz.github.io/noet/dist';
const xml = `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${extId}'>
    <updatecheck codebase='${UPDATE_BASE}/noet.crx' version='${VERSION}' />
  </app>
</gupdate>`;
writeFileSync(XML_OUT, xml);
console.log(`XML: ${XML_OUT} (v${VERSION})`);
console.log('\nGotcha. Установи расширение из dist/noet.crx, и оно будет автообновляться.');
