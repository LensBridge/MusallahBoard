#!/usr/bin/env node
/**
 * =====================================================
 * Board app package (.mbu) builder
 * =====================================================
 * Turns the Vite build into a signed `app` package the
 * device agent will install, plus the release channel
 * pointer boards poll (agent/docs/architecture.md,
 * sections 4, 9.4 and 15):
 *
 *   release/musallahboard-app-<version>.mbu
 *   release/app-channel.json
 *     {"version","url","sha256","bytes"}
 *
 * Run after `vite build` (`npm run package` does both).
 * Dependency-free on purpose: this script holds the
 * release key in CI, so it is small enough to read in one
 * sitting and pulls nothing from npm. It produces the
 * same format as `mbpack app` in the agent repo.
 *
 * Environment:
 *   MB_RELEASE_SIGNING_KEY  base64 of the 32-byte Ed25519
 *                           seed. Required unless
 *                           --unsigned (tests only: the
 *                           agent refuses such a package).
 *   MB_RELEASE_BASE_URL     where the .mbu is downloaded
 *                           from; default the GitHub
 *                           release for v<version>.
 *
 * Options:
 *   --dir <path>      build output (default: dist/client
 *                     if it holds index.html, else dist)
 *   --out-dir <path>  default: release
 *   --unsigned        write without mbu.sig
 * =====================================================
 */

import {
  createHash, createPrivateKey, createPublicKey, sign as edSign,
} from 'node:crypto';
import {
  existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync,
} from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync } from 'node:zlib';

// ---------------------------------------------------------------------------
// Contract constants (architecture doc, section 4)
// ---------------------------------------------------------------------------

/** The local API version (section 7) this build needs from the agent. */
export const LOCAL_API = 2;

const SIGNING_PREFIX = Buffer.from('musallahboard-mbu-v2\n', 'ascii');

const SEGMENT_RE = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;
const MAX_SEGMENTS = 8;
const MAX_NAME_BYTES = 200;
const MAX_FILES = 20000;
const MAX_TOTAL_FILE_BYTES = 1024 * 1024 * 1024; // sum of files[].bytes
const MAX_PACKAGE_BYTES = 512 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 1024 * 1024;

/**
 * Files the Cloudflare Vite plugin writes into the build output for
 * `wrangler deploy`. They describe the hosted deployment, not the app: a board
 * has no use for them, `wrangler.json` embeds absolute paths from the build
 * machine, and `.assetsignore` is a hidden name the entry rules reject. Left
 * out by name, at the root only; any other file that breaks the rules still
 * fails the build.
 */
const HOSTING_ONLY = new Set(['.assetsignore', 'wrangler.json']);

// ---------------------------------------------------------------------------
// Entry names
// ---------------------------------------------------------------------------

/**
 * Throw unless `name` is a valid package entry name: slash-separated segments
 * matching SEGMENT_RE (so no empty, `.`, `..` or hidden segments), at most 8
 * segments and 200 bytes, no backslash, no leading slash. The agent rejects the
 * whole package over one bad name, so this fails here, loudly, instead.
 * @param {string} name
 */
export function checkEntryName(name) {
  const bad = (why) => { throw new Error(`invalid package entry name ${JSON.stringify(name)}: ${why}`); };
  if (typeof name !== 'string' || name === '') bad('empty');
  if (Buffer.byteLength(name, 'utf8') > MAX_NAME_BYTES) bad(`longer than ${MAX_NAME_BYTES} bytes`);
  if (name.includes('\\')) bad('contains a backslash');
  if (name.startsWith('/')) bad('leading slash');
  const segments = name.split('/');
  if (segments.length > MAX_SEGMENTS) bad(`more than ${MAX_SEGMENTS} segments`);
  for (const s of segments) {
    if (!SEGMENT_RE.test(s)) bad(`segment ${JSON.stringify(s)} must match ${SEGMENT_RE}`);
  }
}

// ---------------------------------------------------------------------------
// Build output
// ---------------------------------------------------------------------------

/**
 * Where the build is. The Cloudflare plugin writes a static-assets-only project
 * straight to dist/, and moves the assets to dist/client/ once the project
 * gains a Worker; take whichever holds the SPA.
 * @param {string} root  repository root
 */
export function findBuildDir(root) {
  const client = join(root, 'dist', 'client');
  if (existsSync(join(client, 'index.html'))) return client;
  return join(root, 'dist');
}

/**
 * Every regular file under `dir`, as sorted slash-separated paths relative to
 * it, minus HOSTING_ONLY at the root. Symlinks and other special files are an
 * error: the package may only carry regular files, and following a link could
 * pull in something from outside the build.
 * @param {string} dir
 * @returns {string[]}
 */
export function listBuildFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, ent.name);
      const rel = relative(dir, full).split(sep).join('/');
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile()) { if (!HOSTING_ONLY.has(rel)) out.push(rel); }
      else throw new Error(`${rel}: not a regular file (symlink or special file)`);
    }
  };
  walk(dir);
  // Byte order, so the manifest is the same on every platform and locale.
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

const sha256hex = (buf) => createHash('sha256').update(buf).digest('hex');

/** RFC 3339 UTC, second precision: `2026-09-24T14:02:11Z`. */
export function rfc3339Seconds(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Build the `app` manifest for a set of files.
 * @param {{ version: string, createdAt: string, files: {path:string, data:Buffer}[] }} args
 * @returns {object}
 */
export function buildAppManifest({ version, createdAt, files }) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`version ${JSON.stringify(version)} must be MAJOR.MINOR.PATCH (digits only)`);
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(createdAt)) {
    throw new Error(`createdAt ${JSON.stringify(createdAt)} must be RFC 3339 UTC with second precision`);
  }
  if (files.length > MAX_FILES) throw new Error(`${files.length} files; the limit is ${MAX_FILES}`);
  const seen = new Set();
  let total = 0;
  for (const f of files) {
    checkEntryName(f.path);
    if (f.path === 'mbu.json' || f.path === 'mbu.sig') {
      throw new Error(`${f.path}: reserved for the package manifest`);
    }
    if (seen.has(f.path)) throw new Error(`${f.path}: listed twice`);
    seen.add(f.path);
    total += f.data.length;
  }
  if (total > MAX_TOTAL_FILE_BYTES) throw new Error(`build is ${total} bytes; the limit is ${MAX_TOTAL_FILE_BYTES}`);
  if (!seen.has('index.html')) throw new Error('index.html is not in the build output');

  return {
    format: 'mbu',
    formatVersion: 2,
    type: 'app',
    createdAt,
    version,
    files: files.map((f) => ({ path: f.path, sha256: sha256hex(f.data), bytes: f.data.length })),
    app: { localApi: LOCAL_API },
  };
}

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

// PKCS#8 wrapper for a raw Ed25519 seed (RFC 8410): SEQUENCE { version 0,
// AlgorithmIdentifier { 1.3.101.112 }, OCTET STRING { OCTET STRING seed } }.
const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

/**
 * @param {string} seedB64  base64 of the 32-byte seed, as the architecture doc
 *   stores private keys (section 4.2)
 */
export function releaseKeyFromSeed(seedB64) {
  const seed = Buffer.from(String(seedB64 ?? '').trim(), 'base64');
  if (seed.length !== 32) {
    throw new Error(`signing key must be the base64 of a 32-byte Ed25519 seed (got ${seed.length} bytes)`);
  }
  const privateKey = createPrivateKey({
    key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]),
    format: 'der',
    type: 'pkcs8',
  });
  // The raw public key is the tail of its SPKI encoding.
  const publicRaw = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).subarray(-32);
  const keyId = createHash('sha256').update(publicRaw).digest().subarray(0, 8).toString('hex');
  return { privateKey, publicRaw: Buffer.from(publicRaw), keyId };
}

/** The exact bytes an Ed25519 signature covers: domain prefix + mbu.json. */
export function signedMessage(manifestBytes) {
  return Buffer.concat([SIGNING_PREFIX, manifestBytes]);
}

/**
 * The mbu.sig document for `manifestBytes`.
 * @param {Buffer} manifestBytes  exactly the bytes stored as mbu.json
 * @param {ReturnType<typeof releaseKeyFromSeed>} key
 */
export function signManifest(manifestBytes, key) {
  const sig = edSign(null, signedMessage(manifestBytes), key.privateKey);
  return { signatures: [{ keyId: key.keyId, sig: sig.toString('base64') }] };
}

// ---------------------------------------------------------------------------
// Zip writer
// ---------------------------------------------------------------------------

const U32_MAX = 0xffffffff;

/** MS-DOS date and time fields for `date` (UTC; the format has no zone). */
function dosDateTime(date) {
  const y = Math.max(1980, date.getUTCFullYear());
  return {
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1),
    date: ((y - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
  };
}

/**
 * Write a zip (PKWARE APPNOTE, no zip64) of `entries`, in order. Each entry is
 * deflated when that makes it smaller and stored otherwise. No directory
 * entries: the agent's reader wants files only, and names imply their
 * directories. Deterministic: the same entries and `modified` give the same
 * bytes, so a rebuild of a tag is byte-identical.
 *
 * Refuses anything that would need zip64 (an entry or the archive past 4 GiB,
 * more than 65535 entries) rather than writing a truncated header.
 *
 * @param {{name: string, data: Buffer}[]} entries
 * @param {Date} modified  timestamp recorded on every entry
 * @returns {Buffer}
 */
export function createZip(entries, modified = new Date()) {
  if (entries.length > 0xffff) throw new Error('too many entries for a zip without zip64');
  const { time, date } = dosDateTime(modified);
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    if (data.length > U32_MAX) throw new Error(`${name}: larger than 4 GiB (zip64 is not supported)`);
    const crc = crc32(data) >>> 0;
    const deflated = deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);   // local file header signature
    local.writeUInt16LE(20, 4);           // version needed: 2.0 (deflate)
    local.writeUInt16LE(0x0800, 6);       // flags: UTF-8 names
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18); // compressed size
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);           // extra field length

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central directory header signature
    central.writeUInt16LE(0x0314, 4);     // made by: Unix, spec 2.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);         // extra field length
    central.writeUInt16LE(0, 32);         // comment length
    central.writeUInt16LE(0, 34);         // disk number start
    central.writeUInt16LE(0, 36);         // internal attributes
    central.writeUInt32LE(((0o100644 << 16) >>> 0), 38); // regular file, rw-r--r--
    central.writeUInt32LE(offset, 42);    // local header offset

    locals.push(local, nameBytes, body);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + body.length;
    if (offset > U32_MAX) throw new Error('archive larger than 4 GiB (zip64 is not supported)');
  }

  const cdSize = centrals.reduce((n, b) => n + b.length, 0);
  if (offset + cdSize + 22 > U32_MAX) throw new Error('archive larger than 4 GiB (zip64 is not supported)');
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);       // end of central directory signature
  end.writeUInt16LE(0, 4);                // this disk
  end.writeUInt16LE(0, 6);                // disk with the central directory
  end.writeUInt16LE(entries.length, 8);   // entries on this disk
  end.writeUInt16LE(entries.length, 10);  // entries in total
  end.writeUInt32LE(cdSize, 12);
  end.writeUInt32LE(offset, 16);          // central directory offset
  end.writeUInt16LE(0, 20);               // comment length

  return Buffer.concat([...locals, ...centrals, end]);
}

// ---------------------------------------------------------------------------
// Package
// ---------------------------------------------------------------------------

/**
 * Build a complete app package in memory.
 * @param {{ version: string, createdAt: string, files: {path:string, data:Buffer}[],
 *           key: ReturnType<typeof releaseKeyFromSeed>|null }} args
 *   `key` null writes an unsigned package (no mbu.sig).
 * @returns {{ zip: Buffer, manifest: object, manifestBytes: Buffer, sig: object|null }}
 */
export function buildAppPackage({ version, createdAt, files, key }) {
  const manifest = buildAppManifest({ version, createdAt, files });
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  if (manifestBytes.length > MAX_MANIFEST_BYTES) throw new Error('mbu.json is larger than 1 MiB');
  const sig = key ? signManifest(manifestBytes, key) : null;

  const entries = [{ name: 'mbu.json', data: manifestBytes }];
  if (sig) entries.push({ name: 'mbu.sig', data: Buffer.from(`${JSON.stringify(sig)}\n`, 'utf8') });
  for (const f of files) entries.push({ name: f.path, data: f.data });

  const zip = createZip(entries, new Date(createdAt));
  if (zip.length > MAX_PACKAGE_BYTES) throw new Error(`package is ${zip.length} bytes; the limit is ${MAX_PACKAGE_BYTES}`);
  return { zip, manifest, manifestBytes, sig };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { dir: null, outDir: 'release', unsigned: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--unsigned') opts.unsigned = true;
    else if (a === '--dir') opts.dir = argv[++i];
    else if (a === '--out-dir') opts.outDir = argv[++i];
    else throw new Error(`unknown argument ${a}`);
  }
  return opts;
}

function main() {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const opts = parseArgs(process.argv.slice(2));
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

  const seed = process.env.MB_RELEASE_SIGNING_KEY;
  let key = null;
  if (seed && seed.trim()) key = releaseKeyFromSeed(seed);
  else if (!opts.unsigned) {
    throw new Error(
      'MB_RELEASE_SIGNING_KEY is not set. Boards refuse unsigned packages; pass --unsigned ' +
      'only to test the packer.'
    );
  }

  const dir = opts.dir ? resolve(opts.dir) : findBuildDir(root);
  if (!existsSync(join(dir, 'index.html')) || !lstatSync(dir).isDirectory()) {
    throw new Error(`${dir} does not hold a build (no index.html). Run vite build first.`);
  }
  const files = listBuildFiles(dir).map((path) => ({ path, data: readFileSync(join(dir, ...path.split('/'))) }));
  const createdAt = rfc3339Seconds(new Date());
  const { zip, manifest } = buildAppPackage({ version, createdAt, files, key });

  const outDir = resolve(opts.outDir);
  mkdirSync(outDir, { recursive: true });
  const name = `musallahboard-app-${version}.mbu`;
  writeFileSync(join(outDir, name), zip);

  const base = (process.env.MB_RELEASE_BASE_URL ||
    `https://github.com/LensBridge/MusallahBoard/releases/download/v${version}`).replace(/\/+$/, '');
  const channel = { version, url: `${base}/${name}`, sha256: sha256hex(zip), bytes: zip.length };
  writeFileSync(join(outDir, 'app-channel.json'), `${JSON.stringify(channel, null, 2)}\n`);

  console.log(`build:    ${relative(root, dir) || '.'} (${manifest.files.length} files)`);
  console.log(`package:  ${join(relative(root, outDir) || '.', name)} (${zip.length} bytes, sha256 ${channel.sha256})`);
  console.log(key ? `signed:   keyId ${key.keyId}` : 'UNSIGNED: boards will refuse this package');
  console.log(`channel:  ${channel.url}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error(`package-mbu: ${e.message}`);
    process.exit(1);
  }
}
