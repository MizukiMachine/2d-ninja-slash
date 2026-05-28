export const GAME_DISPLAY_FONT_FAMILY =
  '"Shojumaru", "Noto Serif CJK JP", "Yu Mincho", "Hiragino Mincho ProN", serif';

export const GAME_UI_FONT_FAMILY = GAME_DISPLAY_FONT_FAMILY;

const FONT_LOAD_TIMEOUT_MS = 1600;

export async function loadGameFonts(): Promise<void> {
  if (typeof document === 'undefined' || document.fonts === undefined) {
    return;
  }

  const loadPromise = Promise.all([
    document.fonts.load(`400 32px ${GAME_DISPLAY_FONT_FAMILY}`),
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
