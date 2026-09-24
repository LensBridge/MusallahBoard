// @vitest-environment node
//
// The packer is the one piece of this repo that talks to the agent's verifier
// rather than to a browser, so its tests read the output the way the agent
// does: a from-scratch zip reader below (not the writer's own bookkeeping), and
// crypto.verify against the public key alone.
import { createHash, createPublicKey, verify, randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, inflateRawSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildAppManifest, buildAppPackage, checkEntryName, createZip, listBuildFiles,
  releaseKeyFromSeed, rfc3339Seconds, signManifest, signedMessage,
} from './package-mbu.mjs';

/** Minimal zip reader: EOCD, then the central directory, then each local header. */
function readZip(buf) {
  const eocd = buf.length - 22;
  expect(buf.readUInt32LE(eocd)).toBe(0x06054b50);
  const count = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  let p = buf.readUInt32LE(eocd + 16);
  expect(p + cdSize).toBe(eocd);

  const out = [];
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(p)).toBe(0x02014b50);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28);
    const xlen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const mode = buf.readUInt32LE(p + 38) >>> 16;
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString('utf8');
    p += 46 + nlen + xlen + clen;

    expect(buf.readUInt32LE(local)).toBe(0x04034b50);
    expect(buf.readUInt32LE(local + 14)).toBe(crc);
    expect(buf.subarray(local + 30, local + 30 + buf.readUInt16LE(local + 26)).toString('utf8')).toBe(name);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const body = buf.subarray(start, start + csize);
    const data = method === 8 ? inflateRawSync(body) : Buffer.from(body);
    expect([0, 8]).toContain(method);
    expect(data.length).toBe(usize);
    expect(crc32(data) >>> 0).toBe(crc);
    out.push({ name, method, mode, data });
  }
  return out;
}

const SEED_1_TO_32 = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1)).toString('base64');

describe('createZip', () => {
  it('round-trips stored and deflated entries with correct CRCs', () => {
    const entries = [
      { name: 'mbu.json', data: Buffer.from('{"a":1}\n') },
      { name: 'index.html', data: Buffer.from('<html>'.repeat(200)) }, // compresses
      { name: 'assets/x.bin', data: randomBytes(300) },                // does not
      { name: 'empty.txt', data: Buffer.alloc(0) },
    ];
    const got = readZip(createZip(entries, new Date('2026-09-24T14:02:11Z')));
    expect(got.map((e) => e.name)).toEqual(entries.map((e) => e.name));
    got.forEach((e, i) => expect(e.data.equals(entries[i].data)).toBe(true));
    expect(got[1].method).toBe(8);
    expect(got[2].method).toBe(0);
    expect(got.every((e) => e.mode === 0o100644)).toBe(true);
  });

  it('is deterministic for the same input and timestamp', () => {
    const entries = [{ name: 'a', data: Buffer.from('hello') }];
    const at = new Date('2026-01-01T00:00:00Z');
    expect(createZip(entries, at).equals(createZip(entries, at))).toBe(true);
  });
});

describe('signing', () => {
  it('matches the Go verifier test vector for seed 0x01..0x20', () => {
    expect(releaseKeyFromSeed(SEED_1_TO_32).keyId).toBe('65b60673d6ed884b');
  });

  it('signs prefix + exact mbu.json bytes, verifiable from the raw public key', () => {
    const key = releaseKeyFromSeed(SEED_1_TO_32);
    const bytes = Buffer.from('{"format":"mbu"}\n');
    const { signatures } = signManifest(bytes, key);
    expect(signatures).toHaveLength(1);
    expect(signatures[0].keyId).toBe(key.keyId);
    const sig = Buffer.from(signatures[0].sig, 'base64');
    expect(sig.length).toBe(64);

    // Rebuild the public key from its raw 32 bytes, as a board's trust store has it.
    const pub = createPublicKey({
      key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), key.publicRaw]),
      format: 'der',
      type: 'spki',
    });
    const msg = Buffer.concat([Buffer.from('musallahboard-mbu-v2\n'), bytes]);
    expect(signedMessage(bytes).equals(msg)).toBe(true);
    expect(verify(null, msg, pub, sig)).toBe(true);
    expect(verify(null, bytes, pub, sig)).toBe(false); // prefix is part of it
  });

  it('rejects a seed that is not 32 bytes', () => {
    expect(() => releaseKeyFromSeed(Buffer.alloc(31).toString('base64'))).toThrow(/32-byte/);
    expect(() => releaseKeyFromSeed('')).toThrow(/32-byte/);
  });
});

describe('entry names', () => {
  it.each(['index.html', 'assets/index-BHAz-QHd.js', '_x/a.b', 'a/b/c/d/e/f/g/h'])('accepts %s', (n) => {
    expect(() => checkEntryName(n)).not.toThrow();
  });
  it.each([
    '', '/index.html', 'a//b', './a', 'a/../b', '.assetsignore', 'assets/.hidden',
    'a\\b', 'a/b/c/d/e/f/g/h/i', '-x', 'a b', `${'a'.repeat(201)}`,
  ])('rejects %j', (n) => {
    expect(() => checkEntryName(n)).toThrow(/invalid package entry name/);
  });
});

describe('manifest and package', () => {
  const files = [
    { path: 'assets/app.js', data: Buffer.from('console.log(1)') },
    { path: 'index.html', data: Buffer.from('<!doctype html>') },
  ];

  it('builds an app manifest per section 4.1', () => {
    const m = buildAppManifest({ version: '2.1.0', createdAt: '2026-09-24T14:02:11Z', files });
    expect(m).toMatchObject({
      format: 'mbu', formatVersion: 2, type: 'app', version: '2.1.0',
      createdAt: '2026-09-24T14:02:11Z', app: { localApi: 2 },
    });
    expect(m.files.map((f) => f.path)).toEqual(['assets/app.js', 'index.html']);
    expect(m.files[1]).toEqual({
      path: 'index.html',
      sha256: createHash('sha256').update('<!doctype html>').digest('hex'),
      bytes: 15,
    });
  });

  it('refuses bad versions, timestamps, missing index.html and bad names', () => {
    const at = '2026-09-24T14:02:11Z';
    expect(() => buildAppManifest({ version: '2.1', createdAt: at, files })).toThrow(/MAJOR/);
    expect(() => buildAppManifest({ version: 'v2.1.0', createdAt: at, files })).toThrow(/MAJOR/);
    expect(() => buildAppManifest({ version: '2.1.0', createdAt: '2026-09-24T14:02:11.123Z', files })).toThrow(/second/);
    expect(() => buildAppManifest({ version: '2.1.0', createdAt: at, files: files.slice(0, 1) })).toThrow(/index.html/);
    expect(() => buildAppManifest({
      version: '2.1.0', createdAt: at, files: [...files, { path: '.env', data: Buffer.alloc(1) }],
    })).toThrow(/invalid package entry name/);
    expect(() => buildAppManifest({
      version: '2.1.0', createdAt: at, files: [...files, { path: 'mbu.sig', data: Buffer.alloc(1) }],
    })).toThrow(/reserved/);
  });

  it('writes mbu.json, mbu.sig and every file, with the signature over the stored mbu.json', () => {
    const key = releaseKeyFromSeed(SEED_1_TO_32);
    const { zip, manifestBytes } = buildAppPackage({
      version: '2.1.0', createdAt: '2026-09-24T14:02:11Z', files, key,
    });
    const got = readZip(zip);
    expect(got.map((e) => e.name)).toEqual(['mbu.json', 'mbu.sig', 'assets/app.js', 'index.html']);
    expect(got.some((e) => e.name.endsWith('/'))).toBe(false); // no directory entries
    expect(got[0].data.equals(manifestBytes)).toBe(true);

    const sig = JSON.parse(got[1].data.toString('utf8'));
    const pub = createPublicKey({
      key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), key.publicRaw]),
      format: 'der',
      type: 'spki',
    });
    expect(verify(null, signedMessage(got[0].data), pub, Buffer.from(sig.signatures[0].sig, 'base64'))).toBe(true);
  });

  it('leaves mbu.sig out of an unsigned package', () => {
    const { zip } = buildAppPackage({ version: '2.1.0', createdAt: '2026-09-24T14:02:11Z', files, key: null });
    expect(readZip(zip).map((e) => e.name)).toEqual(['mbu.json', 'assets/app.js', 'index.html']);
  });

  it('formats createdAt at second precision in UTC', () => {
    expect(rfc3339Seconds(new Date('2026-09-24T14:02:11.987Z'))).toBe('2026-09-24T14:02:11Z');
  });
});

describe('listBuildFiles', () => {
  let dir;
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

  it('lists regular files sorted', () => {
    dir = mkdtempSync(join(tmpdir(), 'mbu-build-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), 'x');
    writeFileSync(join(dir, 'assets', 'b.js'), 'x');
    writeFileSync(join(dir, 'assets', 'a.css'), 'x');
    expect(listBuildFiles(dir)).toEqual(['assets/a.css', 'assets/b.js', 'index.html']);
  });

  it('refuses symlinks', () => {
    dir = mkdtempSync(join(tmpdir(), 'mbu-build-'));
    writeFileSync(join(dir, 'index.html'), 'x');
    symlinkSync('/etc/hostname', join(dir, 'link'));
    expect(() => listBuildFiles(dir)).toThrow(/not a regular file/);
  });
});
