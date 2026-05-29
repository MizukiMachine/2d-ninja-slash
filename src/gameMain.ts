import '@fontsource/shojumaru/400.css';
import './gameStyles.css';
import { createGame } from './game/createGame';
import { createGameContext } from './app/createGameContext';
import { SceneKeys } from './game/sceneKeys';

async function bootGame(): Promise<void> {
  const mount = document.querySelector<HTMLDivElement>('#game');

  if (mount === null) {
    throw new Error('Missing #game mount element.');
  }

  mount.tabIndex = 0;

  const context = await createGameContext({
    initialScene: SceneKeys.Sandbox
  });

  createGame({ parent: mount, context });
  mount.focus({ preventScroll: true });
}

void bootGame();
