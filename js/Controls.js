export class Controls {

	constructor( options = {} ) {

		this.keys = {};
		this.x = 0;
		this.z = 0;
		this.target = options.target || window;
		this.container = options.container || document.body;
		this._listeners = [];
		this.touchContainer = null;
		this.touchStyle = null;

		// Touch state
		this.touchActive = false;
		this.touchDirX = 0;
		this.touchDirY = 0;
		this.steerPointerId = null;
		this.steerStartX = 0;
		this.steerStartY = 0;

		this.addListener( this.target, 'keydown', ( e ) => this.keys[ e.code ] = true );
		this.addListener( this.target, 'keyup', ( e ) => this.keys[ e.code ] = false );

		this.setupTouchUI();

	}

	addListener( target, type, listener, options ) {

		target.addEventListener( type, listener, options );
		this._listeners.push( [ target, type, listener, options ] );

	}

	setupTouchUI() {

		if ( ! ( 'ontouchstart' in window ) ) return;

		const css = document.createElement( 'style' );
		this.touchStyle = css;
		css.textContent = `
			.touch-controls { position: absolute; bottom: 0; left: 0; right: 0; height: 50%; pointer-events: none; z-index: 10; }
			.steer-zone { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; pointer-events: auto; touch-action: none; }
			.steer-base { position: absolute; bottom: 32px; left: 32px; width: 140px; height: 140px; border-radius: 50%; background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.2); }
			.steer-knob { position: absolute; top: 50%; left: 50%; width: 60px; height: 60px; margin: -30px 0 0 -30px; border-radius: 50%; background: rgba(255,255,255,0.35); }
		`;
		document.head.appendChild( css );

		const container = document.createElement( 'div' );
		container.className = 'touch-controls';
		this.touchContainer = container;

		const steerZone = document.createElement( 'div' );
		steerZone.className = 'steer-zone';

		const base = document.createElement( 'div' );
		base.className = 'steer-base';
		const knob = document.createElement( 'div' );
		knob.className = 'steer-knob';
		base.appendChild( knob );
		steerZone.appendChild( base );

		container.appendChild( steerZone );
		this.container.appendChild( container );

		const steerRange = 40;

		this.addListener( steerZone, 'pointerdown', ( e ) => {

			if ( this.steerPointerId !== null ) return;
			steerZone.setPointerCapture( e.pointerId );
			this.steerPointerId = e.pointerId;
			this.steerStartX = e.clientX;
			this.steerStartY = e.clientY;
			this.touchActive = true;
			this.touchDirX = 0;
			this.touchDirY = 0;

		} );

		this.addListener( steerZone, 'pointermove', ( e ) => {

			if ( e.pointerId !== this.steerPointerId ) return;
			let dx = ( e.clientX - this.steerStartX ) / steerRange;
			let dy = ( e.clientY - this.steerStartY ) / steerRange;
			const mag = Math.sqrt( dx * dx + dy * dy );

			if ( mag > 1 ) {

				dx /= mag;
				dy /= mag;

			}

			this.touchDirX = dx;
			this.touchDirY = dy;
			knob.style.transform = `translate(${ this.touchDirX * 60 }px, ${ this.touchDirY * 60 }px)`;

		} );

		const endSteer = ( e ) => {

			if ( e.pointerId !== this.steerPointerId ) return;
			this.steerPointerId = null;
			this.touchActive = false;
			this.touchDirX = 0;
			this.touchDirY = 0;
			knob.style.transform = '';

		};

		this.addListener( steerZone, 'pointerup', endSteer );
		this.addListener( steerZone, 'pointercancel', endSteer );

	}

	update() {

		let x = 0, z = 0;

		// Keyboard

		if ( this.keys[ 'KeyA' ] || this.keys[ 'ArrowLeft' ] ) x -= 1;
		if ( this.keys[ 'KeyD' ] || this.keys[ 'ArrowRight' ] ) x += 1;
		if ( this.keys[ 'KeyW' ] || this.keys[ 'ArrowUp' ] ) z += 1;
		if ( this.keys[ 'KeyS' ] || this.keys[ 'ArrowDown' ] ) z -= 1;

		// Gamepad

		const gamepads = navigator.getGamepads();

		for ( const gp of gamepads ) {

			if ( ! gp ) continue;

			const stickX = gp.axes[ 0 ];
			if ( Math.abs( stickX ) > 0.15 ) x = stickX;

			const rt = gp.buttons[ 7 ] ? gp.buttons[ 7 ].value : 0;
			const lt = gp.buttons[ 6 ] ? gp.buttons[ 6 ].value : 0;

			if ( rt > 0.1 || lt > 0.1 ) z = rt - lt;

			break;

		}

		// Touch — joystick mapped to world space (camera is 45° azimuth)

		if ( this.touchActive ) {

			const jx = this.touchDirX;
			const jy = this.touchDirY;
			const mag = Math.sqrt( jx * jx + jy * jy );

			if ( mag > 0.15 ) {

				x = ( jx + jy ) * Math.SQRT1_2 / mag;
				z = ( - jx + jy ) * Math.SQRT1_2 / mag;

			}

		}

		this.x = x;
		this.z = z;

		return { x, z, touchActive: this.touchActive };

	}

	dispose() {

		for ( const [ target, type, listener, options ] of this._listeners ) {

			target.removeEventListener( type, listener, options );

		}

		this._listeners.length = 0;
		this.touchContainer?.remove();
		this.touchContainer = null;
		this.touchStyle?.remove();
		this.touchStyle = null;

	}

}
