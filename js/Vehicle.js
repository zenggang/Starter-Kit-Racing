import * as THREE from 'three';
import { rigidBody } from 'crashcat';
import { applyDogVehicleColor, applyMotorcycleColor } from './VehicleAppearance.js';

const _tmpVec = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _zAxis = new THREE.Vector3();
const _newZ = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _up = new THREE.Vector3( 0, 1, 0 );

const SPEED_SCALE = 12.5;
const LINEAR_DAMP = 0.1;
export const MAX_SPEED = 1.5;

function lerpAngle( a, b, t ) {

	let diff = b - a;
	while ( diff > Math.PI ) diff -= Math.PI * 2;
	while ( diff < -Math.PI ) diff += Math.PI * 2;
	return a + diff * t;

}

export class Vehicle {

	constructor() {

		this.linearSpeed = 0;
		this.angularSpeed = 0;
		this.acceleration = 0;

		this.spherePos = new THREE.Vector3( 3.5, 0.5, 5 );
		this.sphereVel = new THREE.Vector3();

		this.rigidBody = null;
		this.physicsWorld = null;

		this.modelVelocity = new THREE.Vector3();
		this.prevModelPos = new THREE.Vector3( 3.5, 0, 5 );

		this.container = new THREE.Group();
		this.bodyNode = null;
		this.wheels = [];
		this.wheelFL = null;
		this.wheelFR = null;
		this.wheelBL = null;
		this.wheelBR = null;
		this.wheelFront = null;
		this.forkNode = null;
		this.leanNode = null;

		this.inputX = 0;
		this.inputZ = 0;

		this.driftIntensity = 0;
		this.respawnPosition = new THREE.Vector3( 3.5, 0.5, 5 );
		this.respawnHeading = 0;

	}

	init( model, options = {} ) {

		const vehicleModel = model.clone();
		if ( options.vehicleType === 'motorcycle' ) applyMotorcycleColor( vehicleModel, options.vehicleColor );
		if ( options.vehicleType === 'dog' ) applyDogVehicleColor( vehicleModel, options.vehicleColor );

		this.container.add( vehicleModel );

		// Find body and wheel nodes
		vehicleModel.traverse( ( child ) => {

			const name = child.name.toLowerCase();

			if ( name === 'body' ) {

				child.rotation.order = 'YXZ';
				this.bodyNode = child;

			} else if ( name === 'motorcycle' ) {

				child.rotation.order = 'YXZ';
				this.leanNode = child;

			} else if ( name === 'fork' ) {

				child.rotation.order = 'YXZ';
				this.forkNode = child;

			} else if ( name.includes( 'wheel' ) ) {

				child.rotation.order = 'YXZ';
				this.wheels.push( child );

				if ( name === 'wheel-front' ) this.wheelFront = child;
				if ( name.includes( 'front' ) && name.includes( 'left' ) ) this.wheelFL = child;
				if ( name.includes( 'front' ) && name.includes( 'right' ) ) this.wheelFR = child;
				if ( name.includes( 'back' ) && name.includes( 'left' ) ) this.wheelBL = child;
				if ( name.includes( 'back' ) && name.includes( 'right' ) ) this.wheelBR = child;

			}

			if ( child.isMesh ) {

				child.castShadow = true;
				child.receiveShadow = true;

			}

		} );

		return this.container;

	}

	/**
	 * Stores the runtime-owned respawn pose separately from scene bootstrapping
	 * so custom tracks can reuse the same reset path without teaching the online
	 * shell about physics internals.
	 */
	setRespawnState( position, heading = 0 ) {

		if ( Array.isArray( position ) ) {

			this.respawnPosition.set( position[ 0 ] ?? 3.5, position[ 1 ] ?? 0.5, position[ 2 ] ?? 5 );

		} else if ( position && typeof position === 'object' ) {

			this.respawnPosition.set( position.x ?? 3.5, position.y ?? 0.5, position.z ?? 5 );

		} else {

			this.respawnPosition.set( 3.5, 0.5, 5 );

		}

		this.respawnHeading = Number.isFinite( heading ) ? heading : 0;

	}

	update( dt, controlsInput ) {

		this.inputX = controlsInput.x;
		this.inputZ = controlsInput.z;

		if ( controlsInput.touchActive && ( this.inputX !== 0 || this.inputZ !== 0 ) ) {

			// Touch: joystick defines world-space direction, auto-gas
			const targetAngle = Math.atan2( this.inputX, this.inputZ );
			_quat.setFromAxisAngle( _up, targetAngle );
			this.container.quaternion.slerp( _quat, 1 - Math.exp( - 3 * dt ) );

			_forward.set( 0, 0, 1 ).applyQuaternion( this.container.quaternion );
			const cross = _forward.x * this.inputZ - _forward.z * this.inputX;
			this.inputX = THREE.MathUtils.clamp( - cross * 2, - 1, 1 );

			this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, MAX_SPEED, dt * 1.5 );

		} else {

			// Keyboard / gamepad: standard steering + throttle
			let direction = Math.sign( this.linearSpeed );
			if ( direction === 0 ) direction = Math.abs( this.inputZ ) > 0.1 ? Math.sign( this.inputZ ) : 1;

			const steeringGrip = THREE.MathUtils.clamp( Math.abs( this.linearSpeed ), 0.2, 1.0 );

			const targetAngular = - this.inputX * steeringGrip * 4 * direction;
			this.angularSpeed = THREE.MathUtils.lerp( this.angularSpeed, targetAngular, dt * 4 );

			this.container.rotateY( this.angularSpeed * dt );

			const targetSpeed = this.inputZ;

			if ( targetSpeed < 0 && this.linearSpeed > 0.01 ) {

				this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, 0.0, dt * 8 );

			} else if ( targetSpeed < 0 ) {

				this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, targetSpeed / 2, dt * 2 );

			} else {

				this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, targetSpeed * MAX_SPEED, dt * 1.5 );

			}

		}

		_tmpVec.set( 0, 1, 0 ).applyQuaternion( this.container.quaternion );

		if ( _tmpVec.y > 0.5 ) {

			const targetQuat = this.alignWithY( this.container.quaternion, _up );
			this.container.quaternion.slerp( targetQuat, 0.2 );

		}

		this.linearSpeed *= Math.max( 0, 1 - LINEAR_DAMP * dt );

		if ( this.rigidBody ) {

			_forward.set( 0, 0, 1 ).applyQuaternion( this.container.quaternion );
			_forward.y = 0;
			_forward.normalize();

			_right.set( 1, 0, 0 ).applyQuaternion( this.container.quaternion );
			_right.y = 0;
			_right.normalize();

			const angvel = this.rigidBody.motionProperties.angularVelocity;
			const drive = this.linearSpeed * 100 * dt;

			rigidBody.setAngularVelocity( this.physicsWorld, this.rigidBody, [
				angvel[ 0 ] + _right.x * drive,
				angvel[ 1 ],
				angvel[ 2 ] + _right.z * drive
			] );

			const pos = this.rigidBody.position;
			this.spherePos.set( pos[ 0 ], pos[ 1 ], pos[ 2 ] );

			const vel = this.rigidBody.motionProperties.linearVelocity;
			this.sphereVel.set( vel[ 0 ], vel[ 1 ], vel[ 2 ] );

		}

		this.acceleration = THREE.MathUtils.lerp(
			this.acceleration,
			this.linearSpeed + ( 0.25 * this.linearSpeed * Math.abs( this.linearSpeed ) ),
			dt
		);

		if ( this.spherePos.y < - 10 ) {

			this.resetToRespawn();

		}

		this.container.position.set(
			this.spherePos.x,
			this.spherePos.y - 0.5,
			this.spherePos.z
		);

		if ( dt > 0 ) {

			this.modelVelocity.subVectors( this.container.position, this.prevModelPos ).divideScalar( dt );
			this.prevModelPos.copy( this.container.position );

		}

		this.updateBody( dt );
		this.updateWheels( dt );

		this.driftIntensity = Math.abs( this.linearSpeed - this.acceleration ) +
			( this.bodyNode ? Math.abs( this.bodyNode.rotation.z ) * 2 : 0 );

	}

	/**
	 * Replays the configured spawn pose through both the visual model and the
	 * rigid body. Resetting through a single method keeps local single-player
	 * recovery and future online-shell reads aligned on the same source of truth.
	 */
	resetToRespawn() {

		const respawn = [ this.respawnPosition.x, this.respawnPosition.y, this.respawnPosition.z ];

		if ( this.rigidBody ) {

			rigidBody.setPosition( this.physicsWorld, this.rigidBody, respawn, false );
			rigidBody.setLinearVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );
			rigidBody.setAngularVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );

		}

		this.spherePos.copy( this.respawnPosition );
		this.sphereVel.set( 0, 0, 0 );
		this.modelVelocity.set( 0, 0, 0 );
		this.linearSpeed = 0;
		this.angularSpeed = 0;
		this.acceleration = 0;
		this.driftIntensity = 0;
		this.container.rotation.set( 0, this.respawnHeading, 0 );
		this.container.position.set(
			this.respawnPosition.x,
			this.respawnPosition.y - 0.5,
			this.respawnPosition.z
		);

		if ( this.bodyNode ) {

			this.bodyNode.rotation.x = 0;
			this.bodyNode.rotation.z = 0;
			this.bodyNode.position.y = 0.3;

		}

		if ( this.wheelFL ) this.wheelFL.rotation.y = 0;
		if ( this.wheelFR ) this.wheelFR.rotation.y = 0;
		if ( this.wheelFront ) this.wheelFront.rotation.y = 0;
		if ( this.forkNode ) this.forkNode.rotation.y = 0;
		if ( this.leanNode ) this.leanNode.rotation.z = 0;

		this.prevModelPos.copy( this.container.position );

	}

	/**
	 * The React/online wrapper only samples this immutable plain-object snapshot.
	 * It does not drive integration, stepping or correction, which lets the
	 * proven local physics continue to own authoritative movement for now.
	 */
	getRuntimeSnapshot() {

		_forward.set( 0, 0, 1 ).applyQuaternion( this.container.quaternion );
		_forward.y = 0;

		if ( _forward.lengthSq() > 0 ) {

			_forward.normalize();

		}

		return {
			position: {
				x: this.spherePos.x,
				y: this.spherePos.y,
				z: this.spherePos.z,
			},
			heading: Math.atan2( _forward.x, _forward.z ),
			speed: Math.hypot( this.modelVelocity.x, this.modelVelocity.z ),
			driftIntensity: this.driftIntensity,
		};

	}

	/**
	 * Countdown and post-finish lock both need the local car to stop behaving
	 * like an actively driven rigid body. The online shell still owns the policy
	 * decision, but this helper gives it one small, explicit way to quickly
	 * settle the vehicle without teaching React about crashcat internals.
	 */
	stabilizeMotion() {

		if ( this.rigidBody ) {

			rigidBody.setLinearVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );
			rigidBody.setAngularVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );

		}

		this.sphereVel.set( 0, 0, 0 );
		this.modelVelocity.set( 0, 0, 0 );
		this.linearSpeed = 0;
		this.angularSpeed = 0;
		this.acceleration = 0;
		this.driftIntensity = 0;

	}

	alignWithY( quaternion, newY ) {

		_zAxis.set( 0, 0, 1 ).applyQuaternion( quaternion );
		const xAxis = _tmpVec.crossVectors( _zAxis, newY ).negate().normalize();
		_newZ.crossVectors( xAxis, newY ).normalize();

		_mat4.makeBasis( xAxis, newY, _newZ );
		return _quat.setFromRotationMatrix( _mat4 );

	}

	updateBody( dt ) {

		if ( ! this.bodyNode ) return;

		this.bodyNode.rotation.x = lerpAngle(
			this.bodyNode.rotation.x,
			-( this.linearSpeed - this.acceleration ) / 6,
			dt * 10
		);

		this.bodyNode.rotation.z = lerpAngle(
			this.bodyNode.rotation.z,
			-( this.inputX / 5 ) * this.linearSpeed,
			dt * 5
		);

		this.bodyNode.position.y = THREE.MathUtils.lerp( this.bodyNode.position.y, 0.3, dt * 5 );

		// Motorcycle GLB leans as a full frame around the same local steering
		// signal. This keeps its handling identical while giving it the expected
		// two-wheel visual weight in corners.
		if ( this.leanNode ) {

			this.leanNode.rotation.z = lerpAngle(
				this.leanNode.rotation.z,
				this.inputX * this.linearSpeed,
				dt * 3
			);

		}

	}

	updateWheels( dt ) {

		for ( const wheel of this.wheels ) {

			wheel.rotation.x += this.acceleration;

		}

		if ( this.wheelFL ) {

			this.wheelFL.rotation.y = lerpAngle( this.wheelFL.rotation.y, -this.inputX / 1.5, dt * 10 );

		}

		if ( this.wheelFR ) {

			this.wheelFR.rotation.y = lerpAngle( this.wheelFR.rotation.y, -this.inputX / 1.5, dt * 10 );

		}

		if ( this.forkNode ) {

			this.forkNode.rotation.y = lerpAngle( this.forkNode.rotation.y, -this.inputX / 1.5, dt * 5 );

		}

		if ( this.wheelFront ) {

			this.wheelFront.rotation.y = lerpAngle( this.wheelFront.rotation.y, -this.inputX / 1.5, dt * 10 );

		}

	}

}
