import { afterEach, describe, expect, it } from 'vitest';
import { Controls } from './Controls.js';

describe('Controls virtual joystick', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    window.ontouchstart = null;
  });

  it('mounts the virtual joystick even when the browser does not advertise ontouchstart', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    delete window.ontouchstart;

    const controls = new Controls({ target: window, container });

    expect(container.querySelector('.touch-controls')).not.toBeNull();

    controls.dispose();
  });
});
