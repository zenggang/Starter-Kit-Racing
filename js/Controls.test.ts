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

  it('returns zero input while controls are force-locked', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const controls = new Controls({ target: window, container });
    controls.keys.ArrowUp = true;

    controls.setLocked(true);
    expect(controls.update()).toMatchObject({
      x: 0,
      z: 0,
      touchActive: false
    });

    controls.setLocked(false);
    expect(controls.update()).toMatchObject({
      x: 0,
      z: 1
    });

    controls.dispose();
  });
});
