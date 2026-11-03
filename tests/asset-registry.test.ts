import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ASSETS, ASSET_BY_ID, AUDIO, containerSpriteId } from '../src/assets/manifest';
import { assetUrl, missingAssets } from '../src/assets/urls';
import {
  CargoStatus,
  ContainerSize,
  PhysicalCondition,
} from '../src/core/container/types';

const ROOT = fileURLToPath(new URL('../assets', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const onDisk = (rel: string): string => join(ROOT, rel);

describe('asset registry', () => {
  it('has unique logical ids', () => {
    const ids = ASSETS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ASSET_BY_ID.size).toBe(ids.length);
  });

  it('points every entry at a non-empty file on disk', () => {
    for (const a of ASSETS) {
      expect(existsSync(onDisk(a.path)), `${a.id} -> assets/${a.path}`).toBe(true);
      expect(statSync(onDisk(a.path)).size, a.id).toBeGreaterThan(0);
    }
  });

  it('registers every game asset file (no orphans), excluding concept art', () => {
    const registered = new Set(ASSETS.map((a) => a.path));
    const files = walk(ROOT)
      .map((f) => relative(ROOT, f).split('\\').join('/'))
      .filter((f) => /\.(svg|wav)$/.test(f));
    const orphans = files.filter((f) => !registered.has(f));
    expect(orphans).toEqual([]);
  });

  it('matches the v1.1 pack manifest exactly (nothing dropped or invented)', () => {
    const pack = JSON.parse(readFileSync(join(ROOT, 'pack-manifest-v1.1.json'), 'utf8')) as {
      assets: Array<{ path: string }>;
    };
    const packPaths = pack.assets.map((a) => a.path.replace(/^assets\//, '')).filter((p) => !p.startsWith('concept/'));
    expect([...packPaths].sort()).toEqual(ASSETS.map((a) => a.path).sort());
    for (const p of pack.assets.filter((a) => a.path.includes('concept/'))) {
      expect(existsSync(join(ROOT, '..', p.path))).toBe(true);
    }
  });

  it('resolves every entry to a URL through the Vite glob', () => {
    expect(missingAssets()).toEqual([]);
    for (const a of ASSETS) expect(assetUrl(a).length).toBeGreaterThan(0);
  });

  it('does not expose concept art to the game loader', () => {
    expect(ASSETS.some((a) => a.path.startsWith('concept/'))).toBe(false);
  });
});

describe('container sprite selection', () => {
  it('maps every size x cargo x condition to a registered container sprite', () => {
    for (const size of Object.values(ContainerSize)) {
      for (const cargo of Object.values(CargoStatus)) {
        for (const condition of Object.values(PhysicalCondition)) {
          const id = containerSpriteId(size, cargo, condition);
          const entry = ASSET_BY_ID.get(id);
          expect(entry, id).toBeDefined();
          expect(entry?.group).toBe('container');
        }
      }
    }
  });

  it('keeps laden and empty on different sprites for the same size and condition', () => {
    for (const size of Object.values(ContainerSize)) {
      for (const condition of Object.values(PhysicalCondition)) {
        expect(containerSpriteId(size, CargoStatus.LADEN, condition)).not.toBe(
          containerSpriteId(size, CargoStatus.EMPTY, condition),
        );
      }
    }
  });

  it('uses the DM sprite for DM and REPAIR_REQUIRED, and AV for AV and UNDER_INSPECTION', () => {
    expect(containerSpriteId('20FT', 'EMPTY', 'DM')).toBe('container-20ft-empty-dm');
    expect(containerSpriteId('20FT', 'EMPTY', 'REPAIR_REQUIRED')).toBe('container-20ft-empty-dm');
    expect(containerSpriteId('40HC', 'LADEN', 'UNDER_INSPECTION')).toBe('container-40hc-laden-av');
    expect(containerSpriteId('40FT', 'LADEN', 'AV')).toBe('container-40ft-laden-av');
  });
});

describe('audio registry', () => {
  it('registers every semantic audio id', () => {
    const ids = [...Object.values(AUDIO.music), ...Object.values(AUDIO.sfx)];
    for (const id of ids) {
      const e = ASSET_BY_ID.get(id);
      expect(e, id).toBeDefined();
      expect(e?.kind).toBe('audio');
    }
  });

  it('has valid RIFF/WAVE files, 16-bit mono PCM', () => {
    for (const a of ASSETS.filter((x) => x.kind === 'audio')) {
      const b = readFileSync(onDisk(a.path));
      expect(b.toString('ascii', 0, 4), a.id).toBe('RIFF');
      expect(b.toString('ascii', 8, 12), a.id).toBe('WAVE');
      expect(b.readUInt16LE(20), `${a.id} PCM`).toBe(1);
      expect(b.readUInt16LE(22), `${a.id} channels`).toBe(1);
      expect(b.readUInt16LE(34), `${a.id} bits`).toBe(16);
      const dataBytes = b.length - 44;
      expect(dataBytes, a.id).toBeGreaterThan(0);
    }
  });

  it('music loops are long enough to loop and sfx are short', () => {
    const seconds = (id: string): number => {
      const e = ASSET_BY_ID.get(id);
      if (!e) throw new Error(id);
      const b = readFileSync(onDisk(e.path));
      return (b.length - 44) / (b.readUInt32LE(24) * 2);
    };
    expect(seconds(AUDIO.music.day)).toBeGreaterThan(10);
    expect(seconds(AUDIO.music.night)).toBeGreaterThan(10);
    for (const id of Object.values(AUDIO.sfx)) expect(seconds(id)).toBeLessThan(2);
  });
});

describe('svg sanity', () => {
  const svgs = ASSETS.filter((a) => a.kind === 'svg');

  it('has a root svg with xmlns, width, height and viewBox, and no scripts or external references', () => {
    for (const a of svgs) {
      const s = readFileSync(onDisk(a.path), 'utf8');
      expect(s.trimStart().startsWith('<svg'), a.id).toBe(true);
      expect(s.trimEnd().endsWith('</svg>'), a.id).toBe(true);
      expect(s, a.id).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(/<svg[^>]*\swidth="\d+"/.test(s), `${a.id} width`).toBe(true);
      expect(/<svg[^>]*\sheight="\d+"/.test(s), `${a.id} height`).toBe(true);
      expect(/<svg[^>]*\sviewBox="/.test(s), `${a.id} viewBox`).toBe(true);
      expect(/<script|<image|<foreignObject|href="https?:/i.test(s), `${a.id} unsafe/external content`).toBe(false);
    }
  });

  it('flags baked-in text accurately in the registry (spec: dynamic text must be drawn by the game)', () => {
    for (const a of svgs) {
      const hasText = /<text[\s>]/.test(readFileSync(onDisk(a.path), 'utf8'));
      expect(a.hasBakedText, `${a.id}: registry flag must match the file`).toBe(hasText);
    }
  });

  it('records the known baked-text defect as 31 files (update when ChatGPT ships clean files)', () => {
    expect(svgs.filter((a) => a.hasBakedText)).toHaveLength(31);
  });
});
