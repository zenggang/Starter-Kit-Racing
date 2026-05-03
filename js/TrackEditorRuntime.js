import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ORIENT_DEG, CELL_RAW, GRID_SCALE, encodeCells, decodeCells } from './Track.js';

// This runtime is the original editor.html drawing tool extracted into a
// reusable mount function. React owns product chrome and persistence; this file
// owns the 3D editor interaction model: drag-to-draw, erase, auto-tiling, ghost
// previews, panning, zooming, and finish-line direction flipping.

const ORIENT_FLIP = { 0: 10, 10: 0, 16: 22, 22: 16 };

// Bitmask: N=8 S=4 E=2 W=1. Corner connectivity:
// 0deg=S+W, 90deg=S+E, 180deg=N+E, 270deg=N+W.
const AUTOTILE = [
	[ 'track-straight', 0 ],
	[ 'track-straight', 16 ],
	[ 'track-straight', 16 ],
	[ 'track-straight', 16 ],
	[ 'track-straight', 0 ],
	[ 'track-corner', 0 ],
	[ 'track-corner', 16 ],
	[ 'track-straight', 16 ],
	[ 'track-straight', 0 ],
	[ 'track-corner', 22 ],
	[ 'track-corner', 10 ],
	[ 'track-straight', 16 ],
	[ 'track-straight', 0 ],
	[ 'track-straight', 0 ],
	[ 'track-straight', 0 ],
	[ 'track-straight', 0 ],
];

const DIR_INFO = [
	{ bit: 8, dx: 0, dz: - 1 },
	{ bit: 4, dx: 0, dz: 1 },
	{ bit: 2, dx: 1, dz: 0 },
	{ bit: 1, dx: - 1, dz: 0 },
];

const MODEL_NAMES = [ 'track-straight', 'track-corner', 'track-bump', 'track-finish' ];

function cellKey( gx, gz ) {

	return gx + ',' + gz;

}

function bitCount( mask ) {

	return ( mask >> 3 & 1 ) + ( mask >> 2 & 1 ) + ( mask >> 1 & 1 ) + ( mask & 1 );

}

function getCellExits( cell ) {

	if ( cell.type === 'track-corner' ) {

		if ( cell.orient === 0 ) return 5;
		if ( cell.orient === 16 ) return 6;
		if ( cell.orient === 10 ) return 10;
		if ( cell.orient === 22 ) return 9;

	}

	if ( cell.orient === 0 || cell.orient === 10 ) return 12;
	return 3;

}

export async function mountTrackEditorRuntime( container, options = {} ) {

	const assetBaseUrl = options.assetBaseUrl || '';
	const storageKey = typeof options.storageKey === 'string' ? options.storageKey : null;
	const onChange = typeof options.onChange === 'function' ? options.onChange : () => {};
	const width = container.clientWidth || window.innerWidth;
	const height = container.clientHeight || window.innerHeight;
	const grid = new Map();
	const models = {};
	const ghostNeighborBackups = [];
	const pointers = new Map();

	let destroyed = false;
	let animationFrame = 0;
	let hoveredCell = null;
	let tool = options.initialTool === 'erase' ? 'erase' : 'road';
	let isPanning = false;
	let isDrawing = false;
	let isErasing = false;
	let lastDrawCell = null;
	let spaceDown = false;
	let pinchStartDist = 0;
	let pinchStartZoom = 1;
	const panStart = { x: 0, y: 0 };
	const camStart = { x: 0, z: 0 };

	const renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setSize( width, height, false );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.shadowMap.enabled = true;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.0;
	renderer.domElement.className = 'track-editor-canvas';
	container.appendChild( renderer.domElement );

	const scene = new THREE.Scene();
	scene.background = new THREE.Color( 0xadb2ba );
	scene.fog = new THREE.Fog( 0xadb2ba, 80, 160 );

	const dirLight = new THREE.DirectionalLight( 0xffffff, 5 );
	dirLight.position.set( 11.4, 15, - 5.3 );
	dirLight.castShadow = true;
	dirLight.shadow.mapSize.setScalar( 4096 );
	dirLight.shadow.camera.near = 0.5;
	dirLight.shadow.camera.far = 100;
	dirLight.shadow.camera.left = - 60;
	dirLight.shadow.camera.right = 60;
	dirLight.shadow.camera.top = 60;
	dirLight.shadow.camera.bottom = - 60;
	scene.add( dirLight );

	scene.add( new THREE.HemisphereLight( 0xc8d8e8, 0x7a8a5a, 1.5 ) );

	const groundMat = new THREE.MeshStandardMaterial( { color: 0x369069, metalness: 0 } );
	const ground = new THREE.Mesh( new THREE.PlaneGeometry( 200, 200 ), groundMat );
	ground.rotation.x = - Math.PI / 2;
	ground.position.y = - 0.14;
	ground.receiveShadow = true;
	scene.add( ground );

	const gridSize = 30;
	const cellWorld = CELL_RAW * GRID_SCALE;
	const gridHelper = new THREE.GridHelper( gridSize * cellWorld, gridSize, 0x4a7a2a, 0x4a7a2a );
	gridHelper.position.y = - 0.49;
	gridHelper.material.opacity = 0.3;
	gridHelper.material.transparent = true;
	scene.add( gridHelper );

	const trackGroup = new THREE.Group();
	trackGroup.position.y = - 0.5;
	trackGroup.scale.setScalar( GRID_SCALE );
	scene.add( trackGroup );

	const ghostGroup = new THREE.Group();
	ghostGroup.position.y = - 0.5;
	ghostGroup.scale.setScalar( GRID_SCALE );
	scene.add( ghostGroup );

	const frustum = 30;
	const camera = new THREE.OrthographicCamera(
		- frustum * width / height,
		frustum * width / height,
		frustum,
		- frustum,
		0.1,
		200
	);
	const cellCenter = 0.5 * cellWorld;
	camera.position.set( cellCenter, 50, cellCenter );
	camera.lookAt( cellCenter, 0, cellCenter );
	const camTarget = new THREE.Vector3( cellCenter, 0, cellCenter );

	const raycaster = new THREE.Raycaster();
	const mouse = new THREE.Vector2();
	const loader = new GLTFLoader();

	await loadModels();
	if ( destroyed ) return createDisposedHandle();

	if ( typeof options.initialTrackMap === 'string' && options.initialTrackMap.length > 0 ) {

		setTrackMap( options.initialTrackMap, { notify: false } );

	} else if ( storageKey ) {

		const saved = localStorage.getItem( storageKey );
		if ( saved ) setTrackMap( saved, { notify: false } );

	}

	if ( grid.size === 0 ) {

		placeFinish();

	}

	notifyChange();

	function loadModels() {

		const promises = MODEL_NAMES.map( ( name ) =>
			new Promise( ( resolve, reject ) => {

				loader.load( `${ assetBaseUrl }models/${ name }.glb`, ( gltf ) => {

					gltf.scene.traverse( ( child ) => {

						if ( child.isMesh ) child.material.side = THREE.FrontSide;

					} );

					models[ name ] = gltf.scene;
					resolve();

				}, undefined, reject );

			} )
		);

		return Promise.all( promises );

	}

	function getConnectivityMask( gx, gz ) {

		let mask = 0;

		const n = grid.get( cellKey( gx, gz - 1 ) );
		if ( n && ( getCellExits( n ) & 4 ) ) mask |= 8;

		const s = grid.get( cellKey( gx, gz + 1 ) );
		if ( s && ( getCellExits( s ) & 8 ) ) mask |= 4;

		const e = grid.get( cellKey( gx + 1, gz ) );
		if ( e && ( getCellExits( e ) & 1 ) ) mask |= 2;

		const w = grid.get( cellKey( gx - 1, gz ) );
		if ( w && ( getCellExits( w ) & 2 ) ) mask |= 1;

		return mask;

	}

	function getPresenceMask( gx, gz ) {

		let mask = 0;
		if ( grid.has( cellKey( gx, gz - 1 ) ) ) mask |= 8;
		if ( grid.has( cellKey( gx, gz + 1 ) ) ) mask |= 4;
		if ( grid.has( cellKey( gx + 1, gz ) ) ) mask |= 2;
		if ( grid.has( cellKey( gx - 1, gz ) ) ) mask |= 1;
		return mask;

	}

	function connectedExitCount( gx, gz ) {

		const cell = grid.get( cellKey( gx, gz ) );
		if ( ! cell ) return 0;
		return bitCount( getCellExits( cell ) & getConnectivityMask( gx, gz ) );

	}

	function pickBestPair( mask, gx, gz ) {

		const active = DIR_INFO.filter( ( direction ) => mask & direction.bit );
		if ( active.length <= 2 ) return mask;

		let bestMask = active[ 0 ].bit | active[ 1 ].bit;
		let bestScore = - 1;
		let bestIsCorner = false;

		for ( let i = 0; i < active.length; i ++ ) {

			for ( let j = i + 1; j < active.length; j ++ ) {

				const pairMask = active[ i ].bit | active[ j ].bit;
				const isCorner = ( pairMask !== 3 && pairMask !== 12 );
				const score = connectedExitCount( gx + active[ i ].dx, gz + active[ i ].dz ) +
					connectedExitCount( gx + active[ j ].dx, gz + active[ j ].dz );

				if ( ( isCorner && ! bestIsCorner ) || ( isCorner === bestIsCorner && score > bestScore ) ) {

					bestMask = pairMask;
					bestScore = score;
					bestIsCorner = isCorner;

				}

			}

		}

		return bestMask;

	}

	function getAvailableMask( gx, gz ) {

		let mask = 0;
		const dirs = [
			[ 0, - 1, 8, 4 ],
			[ 0, 1, 4, 8 ],
			[ 1, 0, 2, 1 ],
			[ - 1, 0, 1, 2 ],
		];

		for ( const [ dx, dz, bit, oppBit ] of dirs ) {

			const neighbor = grid.get( cellKey( gx + dx, gz + dz ) );
			if ( ! neighbor ) continue;

			const exits = getCellExits( neighbor );
			if ( exits & oppBit ) {

				mask |= bit;
				continue;

			}

			if ( bitCount( exits & getConnectivityMask( gx + dx, gz + dz ) ) < 2 ) mask |= bit;

		}

		return mask;

	}

	function resolveNewTile( gx, gz ) {

		const pMask = getAvailableMask( gx, gz );
		if ( bitCount( pMask ) >= 3 ) return AUTOTILE[ pickBestPair( pMask, gx, gz ) ];
		return AUTOTILE[ pMask ];

	}

	function resolveTile( gx, gz ) {

		const cMask = getConnectivityMask( gx, gz );
		if ( cMask !== 0 ) return AUTOTILE[ cMask ];

		const pMask = getPresenceMask( gx, gz );
		if ( pMask !== 0 ) {

			const dirs = [ [ 0, - 1, 8 ], [ 0, 1, 4 ], [ 1, 0, 2 ], [ - 1, 0, 1 ] ];
			for ( const [ dx, dz, bit ] of dirs ) {

				if ( ! ( pMask & bit ) ) continue;
				const neighbor = grid.get( cellKey( gx + dx, gz + dz ) );
				if ( ! neighbor ) continue;

				const exits = getCellExits( neighbor );
				if ( exits & 12 ) return [ 'track-straight', 0 ];
				if ( exits & 3 ) return [ 'track-straight', 16 ];

			}

		}

		return AUTOTILE[ 0 ];

	}

	function placeMesh( gx, gz, cell ) {

		if ( cell.mesh ) trackGroup.remove( cell.mesh );

		const src = models[ cell.type ];
		if ( ! src ) return;

		const mesh = src.clone();
		mesh.position.set( ( gx + 0.5 ) * CELL_RAW, 0.5, ( gz + 0.5 ) * CELL_RAW );
		mesh.rotation.y = THREE.MathUtils.degToRad( ORIENT_DEG[ cell.orient ] || 0 );
		mesh.traverse( ( child ) => {

			if ( child.isMesh ) {

				child.castShadow = true;
				child.receiveShadow = true;

			}

		} );

		trackGroup.add( mesh );
		cell.mesh = mesh;

	}

	function resolveCell( gx, gz ) {

		const key = cellKey( gx, gz );
		const cell = grid.get( key );
		if ( ! cell ) return;

		let baseType;
		let orient;

		if ( ! cell.mesh ) {

			[ baseType, orient ] = resolveNewTile( gx, gz );

		} else {

			const cMask = getConnectivityMask( gx, gz );
			const currentConnected = getCellExits( cell ) & cMask;

			[ baseType, orient ] = resolveTile( gx, gz );

			const proposedExits = getCellExits( { type: baseType, orient } );
			if ( ( proposedExits & currentConnected ) !== currentConnected ) return;

		}

		const type = ( cell.isFinish && baseType === 'track-straight' ) ? 'track-finish' : baseType;
		if ( cell.type === type && cell.orient === orient && cell.mesh ) return;

		cell.type = type;
		cell.orient = orient;

		placeMesh( gx, gz, cell );

	}

	function resolveCellAndNeighbors( gx, gz ) {

		resolveCell( gx, gz );
		resolveCell( gx, gz - 1 );
		resolveCell( gx, gz + 1 );
		resolveCell( gx + 1, gz );
		resolveCell( gx - 1, gz );

	}

	function placeRoad( gx, gz ) {

		const key = cellKey( gx, gz );

		if ( grid.has( key ) ) {

			const cell = grid.get( key );
			if ( cell.isFinish ) {

				cell.orient = ORIENT_FLIP[ cell.orient ] ?? cell.orient;
				placeMesh( gx, gz, cell );
				notifyChange();

			}

			return;

		}

		grid.set( key, { type: 'track-straight', orient: 0, isFinish: false, mesh: null } );
		resolveCellAndNeighbors( gx, gz );
		notifyChange();

	}

	function placeFinish() {

		const cell = { type: 'track-finish', orient: 0, isFinish: true, mesh: null };
		grid.set( cellKey( 0, 0 ), cell );
		placeMesh( 0, 0, cell );

	}

	function eraseRoad( gx, gz ) {

		const key = cellKey( gx, gz );
		if ( ! grid.has( key ) ) return;

		const cell = grid.get( key );
		if ( cell.isFinish ) return;

		if ( cell.mesh ) trackGroup.remove( cell.mesh );
		grid.delete( key );

		resolveCell( gx, gz - 1 );
		resolveCell( gx, gz + 1 );
		resolveCell( gx + 1, gz );
		resolveCell( gx - 1, gz );
		notifyChange();

	}

	function addGhostPiece( type, orient, gx, gz, opacity ) {

		const src = models[ type ];
		if ( ! src ) return;

		const mesh = src.clone();
		mesh.position.set( ( gx + 0.5 ) * CELL_RAW, 0.5, ( gz + 0.5 ) * CELL_RAW );
		mesh.rotation.y = THREE.MathUtils.degToRad( ORIENT_DEG[ orient ] || 0 );
		mesh.traverse( ( child ) => {

			if ( child.isMesh ) {

				child.material = child.material.clone();
				child.material.transparent = true;
				child.material.opacity = opacity;

			}

		} );

		ghostGroup.add( mesh );

	}

	function updateGhost( gx, gz ) {

		clearGhost();

		if ( tool === 'erase' ) return;
		const key = cellKey( gx, gz );
		if ( grid.has( key ) ) return;

		const ghostCell = { type: 'track-straight', orient: 0, isFinish: false, mesh: null };
		grid.set( key, ghostCell );

		const [ type, orient ] = resolveNewTile( gx, gz );
		ghostCell.type = type;
		ghostCell.orient = orient;
		addGhostPiece( type, orient, gx, gz, 0.4 );

		const neighbors = [ [ gx, gz - 1 ], [ gx, gz + 1 ], [ gx + 1, gz ], [ gx - 1, gz ] ];
		for ( const [ nx, nz ] of neighbors ) {

			const nCell = grid.get( cellKey( nx, nz ) );
			if ( ! nCell ) continue;

			const nConnected = getCellExits( nCell ) & getConnectivityMask( nx, nz );
			const [ newType, newOrient ] = resolveTile( nx, nz );
			const proposedExits = getCellExits( { type: newType, orient: newOrient } );
			if ( ( proposedExits & nConnected ) !== nConnected ) continue;

			const finalType = ( nCell.isFinish && newType === 'track-straight' ) ? 'track-finish' : newType;
			if ( finalType !== nCell.type || newOrient !== nCell.orient ) {

				if ( nCell.mesh ) {

					nCell.mesh.visible = false;
					ghostNeighborBackups.push( { cell: nCell } );

				}

				addGhostPiece( finalType, newOrient, nx, nz, 0.7 );

			}

		}

		grid.delete( key );

	}

	function clearGhost() {

		for ( const { cell } of ghostNeighborBackups ) {

			if ( cell.mesh ) cell.mesh.visible = true;

		}

		ghostNeighborBackups.length = 0;

		while ( ghostGroup.children.length > 0 ) {

			const child = ghostGroup.children[ 0 ];
			ghostGroup.remove( child );

		}

	}

	function screenToGrid( clientX, clientY ) {

		const rect = renderer.domElement.getBoundingClientRect();
		mouse.x = ( ( clientX - rect.left ) / rect.width ) * 2 - 1;
		mouse.y = - ( ( clientY - rect.top ) / rect.height ) * 2 + 1;

		raycaster.setFromCamera( mouse, camera );

		const plane = new THREE.Plane( new THREE.Vector3( 0, 1, 0 ), 0.51 );
		const hit = new THREE.Vector3();
		raycaster.ray.intersectPlane( plane, hit );

		if ( ! hit ) return null;

		return {
			gx: Math.floor( hit.x / cellWorld ),
			gz: Math.floor( hit.z / cellWorld ),
		};

	}

	function getCellsArray() {

		const arr = [];
		for ( const [ key, cell ] of grid ) {

			const [ gx, gz ] = key.split( ',' ).map( Number );
			arr.push( [ gx, gz, cell.type, cell.orient ] );

		}

		return arr;

	}

	function notifyChange() {

		const cells = getCellsArray();
		const trackMap = encodeCells( cells );
		if ( storageKey ) localStorage.setItem( storageKey, trackMap );
		onChange( { trackMap, cells, cellCount: cells.length } );

	}

	function clearAll() {

		clearGhost();
		for ( const [ , cell ] of grid ) {

			if ( cell.mesh ) trackGroup.remove( cell.mesh );

		}

		grid.clear();
		placeFinish();
		notifyChange();

	}

	function setTrackMap( trackMap, config = {} ) {

		clearGhost();
		for ( const [ , cell ] of grid ) {

			if ( cell.mesh ) trackGroup.remove( cell.mesh );

		}

		grid.clear();

		try {

			const arr = typeof trackMap === 'string' && trackMap.length > 0 ? decodeCells( trackMap ) : [];
			for ( const [ gx, gz, type, orient ] of arr ) {

				const cell = { type, orient, isFinish: type === 'track-finish', mesh: null };
				grid.set( cellKey( gx, gz ), cell );
				placeMesh( gx, gz, cell );

			}

		} catch ( error ) {

			console.warn( 'Failed to load track map into editor runtime', error );
			grid.clear();

		}

		if ( grid.size === 0 ) placeFinish();
		if ( config.notify !== false ) notifyChange();

	}

	function handleDraw( clientX, clientY ) {

		const cell = screenToGrid( clientX, clientY );
		if ( ! cell ) return;

		if ( lastDrawCell && lastDrawCell.gx === cell.gx && lastDrawCell.gz === cell.gz ) return;
		lastDrawCell = cell;

		if ( isErasing ) {

			eraseRoad( cell.gx, cell.gz );

		} else if ( isDrawing ) {

			placeRoad( cell.gx, cell.gz );

		}

	}

	function getPinchDist() {

		const pts = [ ...pointers.values() ];
		const dx = pts[ 1 ].x - pts[ 0 ].x;
		const dy = pts[ 1 ].y - pts[ 0 ].y;
		return Math.sqrt( dx * dx + dy * dy );

	}

	function getPinchMid() {

		const pts = [ ...pointers.values() ];
		return {
			x: ( pts[ 0 ].x + pts[ 1 ].x ) / 2,
			y: ( pts[ 0 ].y + pts[ 1 ].y ) / 2,
		};

	}

	function onPointerDown( event ) {

		renderer.domElement.setPointerCapture( event.pointerId );
		pointers.set( event.pointerId, { x: event.clientX, y: event.clientY } );

		if ( pointers.size === 2 ) {

			isDrawing = false;
			isErasing = false;
			isPanning = true;

			const mid = getPinchMid();
			panStart.x = mid.x;
			panStart.y = mid.y;
			camStart.x = camTarget.x;
			camStart.z = camTarget.z;
			pinchStartDist = getPinchDist();
			pinchStartZoom = camera.zoom;
			return;

		}

		if ( pointers.size > 2 ) return;

		if ( event.button === 1 || ( event.button === 0 && ( event.ctrlKey || event.metaKey || spaceDown ) ) ) {

			isPanning = true;
			panStart.x = event.clientX;
			panStart.y = event.clientY;
			camStart.x = camTarget.x;
			camStart.z = camTarget.z;
			renderer.domElement.style.cursor = 'grabbing';
			return;

		}

		if ( event.button === 0 ) {

			isErasing = tool === 'erase';
			isDrawing = tool !== 'erase';
			lastDrawCell = null;
			if ( event.pointerType !== 'touch' ) handleDraw( event.clientX, event.clientY );

		} else if ( event.button === 2 ) {

			isErasing = true;
			lastDrawCell = null;
			handleDraw( event.clientX, event.clientY );

		}

	}

	function onPointerMove( event ) {

		pointers.set( event.pointerId, { x: event.clientX, y: event.clientY } );

		if ( pointers.size === 2 && isPanning ) {

			const mid = getPinchMid();
			const scale = frustum * 2 / renderer.domElement.clientHeight / camera.zoom;
			camTarget.x = camStart.x - ( mid.x - panStart.x ) * scale;
			camTarget.z = camStart.z - ( mid.y - panStart.y ) * scale;
			camera.position.x = camTarget.x;
			camera.position.z = camTarget.z;
			camera.lookAt( camTarget.x, 0, camTarget.z );

			const dist = getPinchDist();
			camera.zoom = Math.max( 0.1, Math.min( 10, pinchStartZoom * ( dist / pinchStartDist ) ) );
			camera.updateProjectionMatrix();
			return;

		}

		if ( isPanning ) {

			const canvasWidth = renderer.domElement.clientWidth;
			const canvasHeight = renderer.domElement.clientHeight;
			const zoom = camera.zoom;
			const dx = ( event.clientX - panStart.x ) / canvasWidth * frustum * 2 * ( canvasWidth / canvasHeight ) / zoom;
			const dz = ( event.clientY - panStart.y ) / canvasHeight * frustum * 2 / zoom;
			camTarget.x = camStart.x - dx;
			camTarget.z = camStart.z - dz;
			camera.position.x = camTarget.x;
			camera.position.z = camTarget.z;
			camera.lookAt( camTarget.x, 0, camTarget.z );
			return;

		}

		if ( isDrawing || isErasing ) {

			handleDraw( event.clientX, event.clientY );
			return;

		}

		if ( event.pointerType === 'mouse' ) {

			const cell = screenToGrid( event.clientX, event.clientY );
			if ( cell ) {

				hoveredCell = cell;
				updateGhost( cell.gx, cell.gz );

			} else {

				hoveredCell = null;
				clearGhost();

			}

		}

	}

	function onPointerUp( event ) {

		pointers.delete( event.pointerId );

		if ( pointers.size === 0 ) {

			if ( ( isDrawing || isErasing ) && lastDrawCell === null && ! isPanning ) {

				handleDraw( event.clientX, event.clientY );

			}

			isPanning = false;
			isDrawing = false;
			isErasing = false;
			lastDrawCell = null;
			renderer.domElement.style.cursor = spaceDown ? 'grab' : '';

		}

	}

	function onPointerCancel( event ) {

		pointers.delete( event.pointerId );

	}

	function onWheel( event ) {

		event.preventDefault();

		if ( event.ctrlKey ) {

			const zoomSpeed = 1.02;
			camera.zoom *= event.deltaY > 0 ? 1 / zoomSpeed : zoomSpeed;
			camera.zoom = Math.max( 0.1, Math.min( 10, camera.zoom ) );
			camera.updateProjectionMatrix();

		} else {

			const scale = frustum * 2 / renderer.domElement.clientHeight / camera.zoom;
			camTarget.x += event.deltaX * scale;
			camTarget.z += event.deltaY * scale;
			camera.position.x = camTarget.x;
			camera.position.z = camTarget.z;
			camera.lookAt( camTarget.x, 0, camTarget.z );

		}

	}

	function onKeyDown( event ) {

		if ( event.key === ' ' ) {

			if ( ! spaceDown ) {

				spaceDown = true;
				renderer.domElement.style.cursor = 'grab';

			}

			event.preventDefault();

		} else if ( event.key === '1' ) {

			tool = 'road';

		} else if ( event.key === '2' ) {

			tool = 'erase';

		}

	}

	function onKeyUp( event ) {

		if ( event.key === ' ' ) {

			spaceDown = false;
			if ( ! isPanning ) renderer.domElement.style.cursor = '';

		}

	}

	function onResize() {

		const nextWidth = container.clientWidth || window.innerWidth;
		const nextHeight = container.clientHeight || window.innerHeight;
		const aspect = nextWidth / nextHeight;
		camera.left = - frustum * aspect;
		camera.right = frustum * aspect;
		camera.updateProjectionMatrix();
		renderer.setPixelRatio( window.devicePixelRatio );
		renderer.setSize( nextWidth, nextHeight, false );

	}

	function animate() {

		if ( destroyed ) return;
		animationFrame = requestAnimationFrame( animate );
		renderer.render( scene, camera );

	}

	renderer.domElement.addEventListener( 'contextmenu', preventDefault );
	renderer.domElement.addEventListener( 'pointerdown', onPointerDown );
	renderer.domElement.addEventListener( 'pointermove', onPointerMove );
	window.addEventListener( 'pointerup', onPointerUp );
	window.addEventListener( 'pointercancel', onPointerCancel );
	renderer.domElement.addEventListener( 'wheel', onWheel, { passive: false } );
	window.addEventListener( 'keydown', onKeyDown );
	window.addEventListener( 'keyup', onKeyUp );
	window.addEventListener( 'resize', onResize );
	const resizeObserver = new ResizeObserver( onResize );
	resizeObserver.observe( container );
	animate();

	return {
		destroy() {

			destroyed = true;
			cancelAnimationFrame( animationFrame );
			clearGhost();
			resizeObserver.disconnect();
			renderer.domElement.removeEventListener( 'contextmenu', preventDefault );
			renderer.domElement.removeEventListener( 'pointerdown', onPointerDown );
			renderer.domElement.removeEventListener( 'pointermove', onPointerMove );
			window.removeEventListener( 'pointerup', onPointerUp );
			window.removeEventListener( 'pointercancel', onPointerCancel );
			renderer.domElement.removeEventListener( 'wheel', onWheel );
			window.removeEventListener( 'keydown', onKeyDown );
			window.removeEventListener( 'keyup', onKeyUp );
			window.removeEventListener( 'resize', onResize );
			renderer.domElement.remove();
			renderer.dispose();

		},
		setTool( nextTool ) {

			tool = nextTool === 'erase' ? 'erase' : 'road';

		},
		clear() {

			clearAll();

		},
		setTrackMap,
		getTrackMap() {

			return encodeCells( getCellsArray() );

		},
		getCells() {

			return getCellsArray();

		},
		getCellCount() {

			return grid.size;

		}
	};

}

function preventDefault( event ) {

	event.preventDefault();

}

function createDisposedHandle() {

	return {
		destroy() {},
		setTool() {},
		clear() {},
		setTrackMap() {},
		getTrackMap() {

			return null;

		},
		getCells() {

			return [];

		},
		getCellCount() {

			return 0;

		}
	};

}
