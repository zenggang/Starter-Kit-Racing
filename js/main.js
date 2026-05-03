import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { LightProbeGrid } from 'three/addons/lighting/LightProbeGrid.js';
import { createWorldSettings, createWorld, addBroadphaseLayer, addObjectLayer, enableCollision, registerAll, updateWorld, rigidBody, box, MotionType } from 'crashcat';
import { Vehicle, MAX_SPEED } from './Vehicle.js';
import { Camera } from './Camera.js';
import { Controls } from './Controls.js';
import { buildTrack, decodeCells, computeSpawnPosition, computeTrackBounds } from './Track.js';
import { buildWallColliders, createSphereBody } from './Physics.js';
import { SmokeTrails } from './Particles.js';
import { DriftMarks } from './DriftMarks.js';
import { GameAudio } from './Audio.js';
import { RemoteVehicles } from './RemoteVehicles.js';

const modelNames = [
	'vehicle-truck-yellow', 'vehicle-truck-green', 'vehicle-truck-purple', 'vehicle-truck-red',
	'track-straight', 'track-corner', 'track-bump', 'track-finish',
	'decoration-empty', 'decoration-forest', 'decoration-tents',
];

/**
 * Accepts the legacy standalone `map` query alongside the newer `trackMap`
 * room/match field so the React shell can swap call sites incrementally.
 */
function readTrackMapOption( options ) {

	if ( typeof options.trackMap === 'string' && options.trackMap.length > 0 ) return options.trackMap;
	if ( typeof options.map === 'string' && options.map.length > 0 ) return options.map;

	return options.useQueryMap ? new URLSearchParams( window.location.search ).get( 'map' ) : null;

}

/**
 * Keeps the runtime handle shape stable even if mount is cancelled while assets
 * are loading, which prevents the online shell from branching on partial state.
 */
function createEmptyRuntimeSnapshot() {

	return {
		position: { x: 0, y: 0, z: 0 },
		heading: 0,
		speed: 0,
		driftIntensity: 0,
	};

}

/**
 * Mounts the legacy Three.js racing runtime into a caller-owned container. The
 * coordinator-backed React shell controls when this runtime exists and only
 * samples plain snapshots from it. The runtime keeps owning local vehicle
 * physics, camera, particles, audio and touch input so the online adapter can
 * stay observational until the multiplayer authority model is ready.
 */
export async function mountRacingRuntime( container, options = {} ) {

	const assetBaseUrl = options.assetBaseUrl || '';
	const mapParam = readTrackMapOption( options );
	const vehicleColor = typeof options.vehicleColor === 'string' && options.vehicleColor.length > 0 ? options.vehicleColor : 'yellow';
	const width = container.clientWidth || window.innerWidth;
	const height = container.clientHeight || window.innerHeight;
	let animationFrame = 0;
	let destroyed = false;

	registerAll();

	const renderer = new THREE.WebGLRenderer( { antialias: true, outputBufferType: THREE.HalfFloatType } );
	renderer.setSize( width, height, false );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.shadowMap.enabled = true;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.0;

	const bloomPass = new UnrealBloomPass( new THREE.Vector2( width, height ) );
	bloomPass.strength = 0.02;
	bloomPass.radius = 0.02;
	bloomPass.threshold = 0.5;

	if ( typeof renderer.setEffects === 'function' ) {

		renderer.setEffects( [ bloomPass ] );

	}

	container.appendChild( renderer.domElement );

	const scene = new THREE.Scene();
	scene.background = new THREE.Color( 0xadb2ba );
	scene.fog = new THREE.Fog( 0xadb2ba, 30, 55 );

	const dirLight = new THREE.DirectionalLight( 0xffffff, 3 );
	dirLight.position.set( 11.4, 15, -5.3 );
	dirLight.castShadow = true;
	dirLight.shadow.mapSize.setScalar( 4096 );
	dirLight.shadow.camera.near = 0.5;
	dirLight.shadow.camera.far = 60;
	dirLight.shadow.radius = 4;
	scene.add( dirLight );

	const hemiLight = new THREE.HemisphereLight( 0xc8d8e8, 0x7a8a5a, 2 );
	hemiLight.position.copy( dirLight.position );
	scene.add( hemiLight );

	const models = await loadModels( assetBaseUrl );

	if ( destroyed ) {

		renderer.dispose();
		return {
			destroy() {},
			updateRemoteVehicles() {},
			getSnapshot() {

				return createEmptyRuntimeSnapshot();

			}
		};

	}

	let customCells = null;
	let spawn = null;

	if ( mapParam ) {

		try {

			customCells = decodeCells( mapParam );
			spawn = computeSpawnPosition( customCells );

		} catch ( e ) {

			console.warn( 'Invalid map parameter, using default track' );

		}

	}

	const bounds = computeTrackBounds( customCells );
	const hw = bounds.halfWidth;
	const hd = bounds.halfDepth;
	const groundSize = Math.max( hw, hd ) * 2 + 20;

	const shadowExtent = Math.max( hw, hd ) + 10;
	dirLight.shadow.camera.left = - shadowExtent;
	dirLight.shadow.camera.right = shadowExtent;
	dirLight.shadow.camera.top = shadowExtent;
	dirLight.shadow.camera.bottom = - shadowExtent;
	dirLight.shadow.camera.updateProjectionMatrix();

	scene.fog.near = groundSize * 0.4;
	scene.fog.far = groundSize * 0.8;

	buildTrack( scene, models, customCells );

	const probeHeight = 6;
	const probes = new LightProbeGrid(
		hw * 2, probeHeight, hd * 2,
		Math.max( 4, Math.round( hw / 4 ) ),
		2,
		Math.max( 4, Math.round( hd / 4 ) ),
	);
	probes.position.set( bounds.centerX, probeHeight / 2, bounds.centerZ );
	probes.bake( renderer, scene, { cubemapSize: 32, near: 0.1, far: groundSize } );
	scene.add( probes );

	const worldSettings = createWorldSettings();
	worldSettings.gravity = [ 0, - 9.81, 0 ];

	const BPL_MOVING = addBroadphaseLayer( worldSettings );
	const BPL_STATIC = addBroadphaseLayer( worldSettings );
	const OL_MOVING = addObjectLayer( worldSettings, BPL_MOVING );
	const OL_STATIC = addObjectLayer( worldSettings, BPL_STATIC );

	enableCollision( worldSettings, OL_MOVING, OL_STATIC );
	enableCollision( worldSettings, OL_MOVING, OL_MOVING );

	const world = createWorld( worldSettings );
	world._OL_MOVING = OL_MOVING;
	world._OL_STATIC = OL_STATIC;

	buildWallColliders( world, null, customCells );

	const roadHalf = groundSize / 2;
	rigidBody.create( world, {
		shape: box.create( { halfExtents: [ roadHalf, 0.01, roadHalf ] } ),
		motionType: MotionType.STATIC,
		objectLayer: OL_STATIC,
		position: [ bounds.centerX, - 0.125, bounds.centerZ ],
		friction: 5.0,
		restitution: 0.0,
	} );

	const sphereBody = createSphereBody( world, spawn ? spawn.position : null );

	const vehicle = new Vehicle();
	vehicle.rigidBody = sphereBody;
	vehicle.physicsWorld = world;

	const respawnState = spawn || {
		position: [ 3.5, 0.5, 5 ],
		angle: 0,
	};
	vehicle.setRespawnState( respawnState.position, respawnState.angle );

	if ( spawn ) {

		const [ sx, sy, sz ] = spawn.position;
		vehicle.spherePos.set( sx, sy, sz );
		vehicle.prevModelPos.set( sx, sy - 0.5, sz );
		vehicle.container.rotation.y = spawn.angle;

	}

	const vehicleModelName = `vehicle-truck-${ vehicleColor }`;
	const vehicleGroup = vehicle.init( models[ vehicleModelName ] || models[ 'vehicle-truck-yellow' ] );
	scene.add( vehicleGroup );

	dirLight.target = vehicleGroup;

	const cam = new Camera( { width, height } );
	scene.add( cam.debug );
	cam.smoothedDesired.copy( vehicle.spherePos );

	const controls = new Controls( { container } );
	const particles = new SmokeTrails( scene, { assetBaseUrl } );
	const driftMarks = new DriftMarks( scene );
	const remoteVehicles = new RemoteVehicles( scene, models );

	const audio = new GameAudio();
	audio.init( cam.camera, { assetBaseUrl, target: window } );

	const _forward = new THREE.Vector3();
	const contactListener = {
		onContactAdded( bodyA, bodyB ) {

			if ( bodyA !== sphereBody && bodyB !== sphereBody ) return;

			_forward.set( 0, 0, 1 ).applyQuaternion( vehicle.container.quaternion );
			_forward.y = 0;
			_forward.normalize();

			const impactVelocity = Math.abs( vehicle.modelVelocity.dot( _forward ) );
			audio.playImpact( impactVelocity );

		}
	};

	const onResize = () => {

		const nextWidth = container.clientWidth || window.innerWidth;
		const nextHeight = container.clientHeight || window.innerHeight;
		renderer.setPixelRatio( window.devicePixelRatio );
		renderer.setSize( nextWidth, nextHeight, false );
		bloomPass.setSize( nextWidth, nextHeight );
		cam.resize( nextWidth, nextHeight );

	};

	window.addEventListener( 'resize', onResize );
	window.visualViewport?.addEventListener( 'resize', onResize );
	window.addEventListener( 'orientationchange', onResize );
	const resizeObserver = new ResizeObserver( () => onResize() );
	resizeObserver.observe( container );

	const timer = new THREE.Timer();

	function animate() {

		if ( destroyed ) return;

		animationFrame = requestAnimationFrame( animate );

		timer.update();
		const dt = Math.min( timer.getDelta(), 1 / 30 );
		const input = controls.update();

		updateWorld( world, contactListener, dt );
		vehicle.update( dt, input );

		dirLight.position.set(
			vehicle.spherePos.x + 11.4,
			15,
			vehicle.spherePos.z - 5.3
		);

		cam.update( dt, vehicle.spherePos, vehicle.modelVelocity );
		particles.update( dt, vehicle );
		driftMarks.update( dt, vehicle );
		remoteVehicles.update( dt );
		audio.update( dt, vehicle.linearSpeed / MAX_SPEED, input.z, vehicle.driftIntensity );

		renderer.render( scene, cam.camera );

	}

	animate();

	return {
		/**
		 * The shell reads this lightweight snapshot and forwards it into room or
		 * match flows later. It intentionally does not receive physics handles,
		 * which keeps the legacy runtime authoritative for local simulation.
		 */
		getSnapshot() {

			return vehicle.getRuntimeSnapshot();

		},
		/**
		 * Applies coordinator-owned remote telemetry as visual-only ghost cars.
		 * The RemoteVehicles manager only owns Three objects; it never creates
		 * rigid bodies, so remote racers cannot influence crashcat collision.
		 */
		updateRemoteVehicles( vehicles ) {

			remoteVehicles.setVehicles( vehicles );

		},
		destroy() {

			destroyed = true;
			cancelAnimationFrame( animationFrame );
			window.removeEventListener( 'resize', onResize );
			window.visualViewport?.removeEventListener( 'resize', onResize );
			window.removeEventListener( 'orientationchange', onResize );
			resizeObserver.disconnect();
			controls.dispose();
			particles.dispose();
			driftMarks.dispose();
			remoteVehicles.dispose();
			audio.dispose();
			renderer.domElement.remove();
			renderer.dispose();

		}
	};

}

async function loadModels( assetBaseUrl ) {

	const loader = new GLTFLoader();
	const models = {};
	const promises = modelNames.map( ( name ) =>
		new Promise( ( resolve, reject ) => {

			loader.load( `${ assetBaseUrl }models/${ name }.glb`, ( gltf ) => {

				const meshes = [];
				gltf.scene.traverse( ( child ) => {

					if ( child.isMesh ) {

						child.material.side = THREE.FrontSide;
						meshes.push( child );

					}

				} );

				if ( name.startsWith( 'vehicle-' ) ) {

					gltf.scene.scale.setScalar( 0.5 );

				}

				if ( meshes.length === 1 ) {

					const mesh = meshes[ 0 ];
					mesh.removeFromParent();
					models[ name ] = mesh;

				} else {

					models[ name ] = gltf.scene;

				}

				resolve();

			}, undefined, reject );

		} )
	);

	await Promise.all( promises );

	return models;

}
