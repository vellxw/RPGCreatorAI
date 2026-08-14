import './styles.css';
import { mountAndroidGameBundleHost } from '../gameBundleHost';

const container = document.querySelector<HTMLElement>('[data-rpg-runtime]');
const status = document.querySelector<HTMLElement>('[data-rpg-status]');
if (!container) throw new Error('Android runtime mount element is missing.');

mountAndroidGameBundleHost({ container, controlsRoot: document })
  .then(() => { if (status) status.hidden = true; })
  .catch(error => {
    console.error(error);
    if (status) status.textContent = error instanceof Error ? error.message : 'The offline game could not start.';
  });
