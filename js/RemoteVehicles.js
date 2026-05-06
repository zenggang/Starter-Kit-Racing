import * as THREE from 'three';
import { applyMotorcycleColor, vehicleColorToHex } from './VehicleAppearance.js';

const STALE_AFTER_MS = 10_000;
const BODY_OPACITY = 0.62;
const STALE_OPACITY = 0.24;
const LABEL_WIDTH = 256;
const LABEL_HEIGHT = 72;
const _targetQuaternion = new THREE.Quaternion();
const _up = new THREE.Vector3( 0, 1, 0 );

function lerpAngle( from, to, alpha ) {

	let diff = to - from;
	while ( diff > Math.PI ) diff -= Math.PI * 2;
	while ( diff < - Math.PI ) diff += Math.PI * 2;
	return from + diff * alpha;

}

function readReportTime( value, fallback ) {

	const parsed = typeof value === 'string' ? Date.parse( value ) : Number.NaN;
	return Number.isFinite( parsed ) ? parsed : fallback;

}

function createLabelTexture( nickname, color ) {

	const canvas = document.createElement( 'canvas' );
	canvas.width = LABEL_WIDTH;
	canvas.height = LABEL_HEIGHT;

	const ctx = canvas.getContext( '2d' );
	ctx.clearRect( 0, 0, LABEL_WIDTH, LABEL_HEIGHT );
	ctx.font = '700 28px Arial, Helvetica, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	ctx.fillStyle = 'rgba(9, 11, 13, 0.72)';
	roundRect( ctx, 12, 10, LABEL_WIDTH - 24, LABEL_HEIGHT - 20, 18 );
	ctx.fill();

	ctx.strokeStyle = color;
	ctx.lineWidth = 4;
	roundRect( ctx, 12, 10, LABEL_WIDTH - 24, LABEL_HEIGHT - 20, 18 );
	ctx.stroke();

	ctx.fillStyle = '#f7f8f4';
	ctx.fillText( String( nickname || 'Racer' ).slice( 0, 12 ), LABEL_WIDTH / 2, LABEL_HEIGHT / 2 + 1 );

	const texture = new THREE.CanvasTexture( canvas );
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.needsUpdate = true;
	return texture;

}

function roundRect( ctx, x, y, width, height, radius ) {

	ctx.beginPath();
	ctx.moveTo( x + radius, y );
	ctx.lineTo( x + width - radius, y );
	ctx.quadraticCurveTo( x + width, y, x + width, y + radius );
	ctx.lineTo( x + width, y + height - radius );
	ctx.quadraticCurveTo( x + width, y + height, x + width - radius, y + height );
	ctx.lineTo( x + radius, y + height );
	ctx.quadraticCurveTo( x, y + height, x, y + height - radius );
	ctx.lineTo( x, y + radius );
	ctx.quadraticCurveTo( x, y, x + radius, y );
	ctx.closePath();

}

function makeGhostModel( source ) {

	const clone = source.clone( true );

	clone.traverse( ( child ) => {

		if ( child.isMesh ) {

			child.castShadow = false;
			child.receiveShadow = false;

			// Remote vehicles are purely visual ghosts. Cloning materials avoids
			// lowering opacity on the local player or on shared cached GLB meshes.
			child.material = child.material.clone();
			child.material.transparent = true;
			child.material.opacity = BODY_OPACITY;
			child.material.depthWrite = false;

		}

	} );

	return clone;

}

export class RemoteVehicles {

	constructor( scene, models ) {

		this.scene = scene;
		this.models = models;
		this.entries = new Map();

	}

	/**
	 * Reconciles coordinator telemetry into render-only Three objects. This
	 * method deliberately never allocates crashcat bodies or object layers, so
	 * remote racers can be visible during a match without affecting local
	 * collision, lap sampling, or vehicle response.
	 */
	setVehicles( vehicles, now = Date.now() ) {

		const activeIds = new Set();

		for ( const vehicle of vehicles || [] ) {

			if ( ! vehicle || typeof vehicle.playerId !== 'string' ) continue;

			activeIds.add( vehicle.playerId );

			let entry = this.entries.get( vehicle.playerId );
			if ( ! entry ) {

				entry = this.createEntry( vehicle, now );
				this.entries.set( vehicle.playerId, entry );

			}

			entry.targetPosition.set( vehicle.position?.x ?? 0, ( vehicle.position?.y ?? 0.5 ) - 0.5, vehicle.position?.z ?? 0 );
			entry.targetHeading = Number.isFinite( vehicle.heading ) ? vehicle.heading : 0;
			entry.lastReportAt = readReportTime( vehicle.lastReportAt, now );
			entry.presence = vehicle.presence;

			if ( entry.nickname !== vehicle.nickname || entry.color !== vehicle.color ) {

				this.refreshLabel( entry, vehicle );
				if ( entry.vehicleType === 'motorcycle' ) applyMotorcycleColor( entry.model, vehicle.color );

			}

		}

		for ( const [ playerId, entry ] of this.entries ) {

			if ( ! activeIds.has( playerId ) || now - entry.lastReportAt > STALE_AFTER_MS ) {

				this.removeEntry( entry );
				this.entries.delete( playerId );

			}

		}

	}

	createEntry( vehicle, now ) {

		const group = new THREE.Group();
		const modelName = vehicle.vehicleType === 'motorcycle' ? 'vehicle-motorcycle' : `vehicle-truck-${ vehicle.color }`;
		const model = makeGhostModel( this.models[ modelName ] || this.models[ 'vehicle-truck-yellow' ] );
		if ( vehicle.vehicleType === 'motorcycle' ) applyMotorcycleColor( model, vehicle.color );
		const targetPosition = new THREE.Vector3(
			vehicle.position?.x ?? 0,
			( vehicle.position?.y ?? 0.5 ) - 0.5,
			vehicle.position?.z ?? 0
		);
		const heading = Number.isFinite( vehicle.heading ) ? vehicle.heading : 0;
		const label = this.createLabel( vehicle );

		group.position.copy( targetPosition );
		group.quaternion.setFromAxisAngle( _up, heading );
		group.add( model );
		group.add( label );
		this.scene.add( group );

		return {
			playerId: vehicle.playerId,
			nickname: vehicle.nickname,
			color: vehicle.color,
			vehicleType: vehicle.vehicleType || 'truck',
			presence: vehicle.presence,
			group,
			model,
			label,
			targetPosition,
			targetHeading: heading,
			currentHeading: heading,
			lastReportAt: readReportTime( vehicle.lastReportAt, now )
		};

	}

	createLabel( vehicle ) {

		const texture = createLabelTexture( vehicle.nickname, vehicleColorToHex( vehicle.color ) );
		const material = new THREE.SpriteMaterial( {
			map: texture,
			transparent: true,
			depthWrite: false,
			depthTest: false
		} );
		const label = new THREE.Sprite( material );
		label.position.set( 0, 1.65, 0 );
		label.scale.set( 2.4, 0.675, 1 );
		return label;

	}

	refreshLabel( entry, vehicle ) {

		entry.nickname = vehicle.nickname;
		entry.color = vehicle.color;

		const previousTexture = entry.label.material.map;
		entry.label.material.map = createLabelTexture( vehicle.nickname, vehicleColorToHex( vehicle.color ) );
		entry.label.material.needsUpdate = true;
		previousTexture?.dispose();

	}

	update( dt, now = Date.now() ) {

		const alpha = 1 - Math.exp( - 8 * dt );

		for ( const entry of this.entries.values() ) {

			entry.group.position.lerp( entry.targetPosition, alpha );
			entry.currentHeading = lerpAngle( entry.currentHeading, entry.targetHeading, alpha );
			_targetQuaternion.setFromAxisAngle( _up, entry.currentHeading );
			entry.group.quaternion.slerp( _targetQuaternion, alpha );

			const stale = now - entry.lastReportAt > STALE_AFTER_MS * 0.5 || entry.presence === 'disconnected';
			const opacity = stale ? STALE_OPACITY : BODY_OPACITY;
			entry.model.traverse( ( child ) => {

				if ( child.isMesh ) child.material.opacity = opacity;

			} );
			entry.label.material.opacity = stale ? 0.55 : 1;

		}

	}

	removeEntry( entry ) {

		entry.group.removeFromParent();
		entry.group.traverse( ( child ) => {

			if ( child.isMesh ) child.material.dispose();

		} );
		entry.label.material.map?.dispose();
		entry.label.material.dispose();

	}

	dispose() {

		for ( const entry of this.entries.values() ) {

			this.removeEntry( entry );

		}

		this.entries.clear();

	}

}
