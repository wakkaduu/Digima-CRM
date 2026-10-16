import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

// WCAG 2.2 AA for every colour pair the UI actually uses (UI-6.2). Reads the real tokens, so a palette
// edit that breaks contrast fails here instead of in front of a user.
const token = (name: string) => {
  const m = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m) throw new Error(`missing token --color-${name}`);
  return m[1]!;
};

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

const SURFACES = ['bg', 'surface', 'surface-sunk', 'accent-subtle'] as const;

describe('colour contrast (WCAG AA)', () => {
  it.each(SURFACES.flatMap((s) => (['text', 'text-muted', 'accent'] as const).map((t) => [t, s] as const)))(
    'text colour %s is readable on %s (4.5:1)',
    (fg, bg) => {
      // accent-subtle is only used behind accent/regular text; accent text on page bg is for links
      expect(ratio(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('white text on the primary button, resting and hovered', () => {
    expect(ratio('#ffffff', token('accent'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#ffffff', token('accent-hover'))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['success', 'warning', 'danger', 'info'])('%s text on its tinted background and on white (4.5:1)', (name) => {
    expect(ratio(token(name), token(`${name}-bg`))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(token(name), token('surface'))).toBeGreaterThanOrEqual(4.5);
  });

  it('control borders and the focus ring are visible against the surface (3:1)', () => {
    expect(ratio(token('border-strong'), token('surface'))).toBeGreaterThanOrEqual(3);
    expect(ratio(token('focus-ring'), token('surface'))).toBeGreaterThanOrEqual(3);
    expect(ratio(token('focus-ring'), token('accent-subtle'))).toBeGreaterThanOrEqual(3);
    for (const name of ['success', 'warning', 'danger']) {
      expect(ratio(token(name), token(`${name}-bg`))).toBeGreaterThanOrEqual(3); // badge borders
    }
  });
});
