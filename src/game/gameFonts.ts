import notoSerifJp76Url from '@fontsource-variable/noto-serif-jp/files/noto-serif-jp-76-wght-normal.woff2?url';
import notoSerifJp81Url from '@fontsource-variable/noto-serif-jp/files/noto-serif-jp-81-wght-normal.woff2?url';
import notoSerifJp90Url from '@fontsource-variable/noto-serif-jp/files/noto-serif-jp-90-wght-normal.woff2?url';
import notoSerifJp116Url from '@fontsource-variable/noto-serif-jp/files/noto-serif-jp-116-wght-normal.woff2?url';
import notoSerifJp118Url from '@fontsource-variable/noto-serif-jp/files/noto-serif-jp-118-wght-normal.woff2?url';
import notoSerifJp119Url from '@fontsource-variable/noto-serif-jp/files/noto-serif-jp-119-wght-normal.woff2?url';
import { GAME_SUBTITLE, GAME_TITLE } from './gameTitle';

export const GAME_JAPANESE_FONT_FAMILY =
  '"Noto Serif JP Variable", "Noto Serif CJK JP", "Yu Mincho", "Hiragino Mincho ProN", serif';

export const GAME_DISPLAY_FONT_FAMILY =
  `"Shojumaru", ${GAME_JAPANESE_FONT_FAMILY}`;

export const GAME_UI_FONT_FAMILY = GAME_DISPLAY_FONT_FAMILY;

const FONT_LOAD_TIMEOUT_MS = 3000;
const BUNDLED_JAPANESE_FONT_FAMILY = 'Noto Serif JP Variable';
const BUNDLED_JAPANESE_FONT_SUBSETS: readonly {
  readonly url: string;
  readonly unicodeRange: string;
}[] = [
  { url: notoSerifJp76Url, unicodeRange: 'U+8DF3' },
  { url: notoSerifJp81Url, unicodeRange: 'U+65AC' },
  { url: notoSerifJp90Url, unicodeRange: 'U+5FCD' },
  { url: notoSerifJp116Url, unicodeRange: 'U+4E0B' },
  { url: notoSerifJp118Url, unicodeRange: 'U+6708' },
  { url: notoSerifJp119Url, unicodeRange: 'U+306E' }
];

let bundledJapaneseFontsPromise: Promise<void> | null = null;

export async function loadGameFonts(): Promise<void> {
  if (typeof document === 'undefined' || document.fonts === undefined) {
    return;
  }

  const loadPromise = Promise.all([
    loadBundledJapaneseFonts(),
    document.fonts.load(`400 84px "${BUNDLED_JAPANESE_FONT_FAMILY}"`, GAME_TITLE),
    document.fonts.load(`400 32px "Shojumaru"`, GAME_SUBTITLE),
    document.fonts.load(`400 20px ${GAME_UI_FONT_FAMILY}`)
  ]);
  const timeoutPromise = new Promise<void>((resolve) => {
    window.setTimeout(resolve, FONT_LOAD_TIMEOUT_MS);
  });

  try {
    await Promise.race([loadPromise.then(() => undefined), timeoutPromise]);
  } catch {
    // Keep booting with fallback fonts if font loading fails.
  }
}

function loadBundledJapaneseFonts(): Promise<void> {
  if (bundledJapaneseFontsPromise !== null) {
    return bundledJapaneseFontsPromise;
  }

  if (typeof FontFace === 'undefined') {
    bundledJapaneseFontsPromise = Promise.resolve();
    return bundledJapaneseFontsPromise;
  }

  bundledJapaneseFontsPromise = Promise.all(
    BUNDLED_JAPANESE_FONT_SUBSETS.map(async ({ url, unicodeRange }) => {
      const fontFace = new FontFace(
        BUNDLED_JAPANESE_FONT_FAMILY,
        `url("${url}") format("woff2-variations")`,
        {
          display: 'swap',
          style: 'normal',
          unicodeRange,
          weight: '200 900'
        }
      );

      document.fonts.add(fontFace);
      await fontFace.load();
    })
  ).then(() => undefined);

  return bundledJapaneseFontsPromise;
}
