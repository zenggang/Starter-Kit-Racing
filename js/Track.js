import * as THREE from 'three';

export const ORIENT_DEG = { 0: 0, 10: 180, 16: 90, 22: 270 };

export const CELL_RAW = 9.99;
export const GRID_SCALE = 0.75;

const _dummy = new THREE.Object3D();

export const TRACK_CELLS = [
	[ -3, -3, 'track-corner',   16 ],
	[ -2, -3, 'track-straight', 22 ],
	[ -1, -3, 'track-straight', 22 ],
	[  0, -3, 'track-corner',    0 ],
	[ -3, -2, 'track-straight',  0 ],
	[  0, -2, 'track-straight',  0 ],
	[ -3, -1, 'track-corner',   10 ],
	[ -2, -1, 'track-corner',    0 ],
	[  0, -1, 'track-straight',  0 ],
	[ -2,  0, 'track-straight', 10 ],
	[  0,  0, 'track-finish',    0 ],
	[ -2,  1, 'track-straight', 10 ],
	[  0,  1, 'track-straight',  0 ],
	[ -2,  2, 'track-corner',   10 ],
	[ -1,  2, 'track-straight', 16 ],
	[  0,  2, 'track-corner',   22 ],
];

const DECO_CELLS = [
	[ -4, -2, 'decoration-tents', 10 ],
	[ -1, -4, 'decoration-tents', 22 ],
	[ -1,  1, 'decoration-tents', 22 ],
	[ -8, -9, 'decoration-forest', 0 ], [ -7, -9, 'decoration-forest', 0 ],
	[ -6, -9, 'decoration-forest', 0 ], [ -5, -9, 'decoration-forest', 0 ],
	[ -4, -9, 'decoration-forest', 0 ], [ -3, -9, 'decoration-forest', 0 ],
	[ -2, -9, 'decoration-forest', 0 ], [ -1, -9, 'decoration-forest', 0 ],
	[  0, -9, 'decoration-forest', 0 ], [  1, -9, 'decoration-forest', 0 ],
	[  2, -9, 'decoration-forest', 0 ],
	[ -8, -8, 'decoration-forest', 0 ], [ -7, -8, 'decoration-forest', 0 ],
	[ -6, -8, 'decoration-forest', 0 ], [ -5, -8, 'decoration-forest', 0 ],
	[ -4, -8, 'decoration-forest', 0 ], [ -3, -8, 'decoration-forest', 0 ],
	[ -2, -8, 'decoration-forest', 0 ], [ -1, -8, 'decoration-forest', 0 ],
	[  0, -8, 'decoration-forest', 0 ], [  1, -8, 'decoration-forest', 0 ],
	[  2, -8, 'decoration-forest', 0 ],
	[ -8, -7, 'decoration-forest', 0 ], [ -7, -7, 'decoration-forest', 0 ],
	[ -6, -7, 'decoration-forest', 0 ], [ -5, -7, 'decoration-forest', 0 ],
	[ -4, -7, 'decoration-forest', 0 ], [ -3, -7, 'decoration-forest', 0 ],
	[ -2, -7, 'decoration-forest', 0 ], [ -1, -7, 'decoration-forest', 0 ],
	[  0, -7, 'decoration-forest', 0 ], [  1, -7, 'decoration-forest', 0 ],
	[  2, -7, 'decoration-forest', 0 ],
	[ -8, -6, 'decoration-forest', 0 ], [ -7, -6, 'decoration-forest', 0 ],
	[ -6, -6, 'decoration-forest', 0 ], [ -5, -6, 'decoration-forest', 0 ],
	[ -4, -6, 'decoration-forest', 0 ], [ -3, -6, 'decoration-empty', 0 ],
	[ -2, -6, 'decoration-empty', 0 ],  [ -1, -6, 'decoration-empty', 0 ],
	[  0, -6, 'decoration-empty', 0 ],  [  1, -6, 'decoration-forest', 0 ],
	[  2, -6, 'decoration-forest', 0 ],
	[ -8, -5, 'decoration-forest', 0 ], [ -7, -5, 'decoration-forest', 0 ],
	[ -6, -5, 'decoration-forest', 0 ], [ -5, -5, 'decoration-forest', 0 ],
	[ -4, -5, 'decoration-empty', 0 ],  [ -3, -5, 'decoration-empty', 0 ],
	[ -2, -5, 'decoration-empty', 0 ],  [ -1, -5, 'decoration-empty', 0 ],
	[  0, -5, 'decoration-empty', 0 ],  [  1, -5, 'decoration-forest', 0 ],
	[  2, -5, 'decoration-forest', 0 ],
	[ -8, -4, 'decoration-forest', 0 ], [ -7, -4, 'decoration-forest', 0 ],
	[ -6, -4, 'decoration-forest', 0 ], [ -5, -4, 'decoration-forest', 0 ],
	[ -4, -4, 'decoration-empty', 0 ],
	[  1, -4, 'decoration-forest', 0 ],
	[  2, -4, 'decoration-forest', 0 ],
	[ -8, -3, 'decoration-forest', 0 ], [ -7, -3, 'decoration-forest', 0 ],
	[ -6, -3, 'decoration-forest', 0 ], [ -5, -3, 'decoration-forest', 0 ],
	[ -4, -3, 'decoration-empty', 0 ],
	[  1, -3, 'decoration-forest', 0 ],
	[  2, -3, 'decoration-forest', 0 ],
	[ -8, -2, 'decoration-forest', 0 ], [ -7, -2, 'decoration-forest', 0 ],
	[ -6, -2, 'decoration-forest', 0 ], [ -5, -2, 'decoration-forest', 0 ],
	[  1, -2, 'decoration-forest', 0 ],
	[  2, -2, 'decoration-forest', 0 ],
	[ -8, -1, 'decoration-forest', 0 ], [ -7, -1, 'decoration-forest', 0 ],
	[ -6, -1, 'decoration-forest', 0 ], [ -5, -1, 'decoration-forest', 0 ],
	[ -4, -1, 'decoration-empty', 0 ],  [ -1, -1, 'decoration-empty', 0 ],
	[  1, -1, 'decoration-forest', 0 ],
	[  2, -1, 'decoration-forest', 0 ],
	[ -8,  0, 'decoration-forest', 0 ], [ -7,  0, 'decoration-forest', 0 ],
	[ -6,  0, 'decoration-forest', 0 ], [ -5,  0, 'decoration-forest', 0 ],
	[ -4,  0, 'decoration-empty', 0 ],  [ -3,  0, 'decoration-empty', 0 ],
	[ -1,  0, 'decoration-empty', 0 ],
	[  1,  0, 'decoration-forest', 0 ],
	[  2,  0, 'decoration-forest', 0 ],
	[ -8,  1, 'decoration-forest', 0 ], [ -7,  1, 'decoration-forest', 0 ],
	[ -6,  1, 'decoration-forest', 0 ], [ -5,  1, 'decoration-forest', 0 ],
	[ -4,  1, 'decoration-empty', 0 ],  [ -3,  1, 'decoration-empty', 0 ],
	[  1,  1, 'decoration-forest', 0 ],
	[  2,  1, 'decoration-forest', 0 ],
	[ -8,  2, 'decoration-forest', 0 ], [ -7,  2, 'decoration-forest', 0 ],
	[ -6,  2, 'decoration-forest', 0 ], [ -5,  2, 'decoration-forest', 0 ],
	[ -4,  2, 'decoration-empty', 0 ],  [ -3,  2, 'decoration-empty', 0 ],
	[  1,  2, 'decoration-forest', 0 ],
	[  2,  2, 'decoration-forest', 0 ],
	[ -8,  3, 'decoration-forest', 0 ], [ -7,  3, 'decoration-forest', 0 ],
	[ -6,  3, 'decoration-forest', 0 ], [ -5,  3, 'decoration-forest', 0 ],
	[ -4,  3, 'decoration-forest', 0 ], [ -3,  3, 'decoration-forest', 0 ],
	[ -2,  3, 'decoration-forest', 0 ], [ -1,  3, 'decoration-forest', 0 ],
	[  0,  3, 'decoration-forest', 0 ], [  1,  3, 'decoration-forest', 0 ],
	[  2,  3, 'decoration-forest', 0 ],
	[ -8,  4, 'decoration-forest', 0 ], [ -7,  4, 'decoration-forest', 0 ],
	[ -6,  4, 'decoration-forest', 0 ], [ -5,  4, 'decoration-forest', 0 ],
	[ -4,  4, 'decoration-forest', 0 ], [ -3,  4, 'decoration-forest', 0 ],
	[ -2,  4, 'decoration-forest', 0 ], [ -1,  4, 'decoration-forest', 0 ],
	[  0,  4, 'decoration-forest', 0 ], [  1,  4, 'decoration-forest', 0 ],
	[  2,  4, 'decoration-forest', 0 ],
];

const NPC_TRUCKS = [
	[ 'vehicle-truck-green',  -3.51, -0.01,  12.70,  98.0 ],
	[ 'vehicle-truck-purple', -23.78, -0.14, -13.56,   0.0 ],
	[ 'vehicle-truck-red',    -1.36, -0.15, -23.80, 155.9 ],
];

const BOX_GEOMETRY = new THREE.BoxGeometry( 1, 1, 1 );

const CITY_SURFACE_MATERIAL = new THREE.MeshStandardMaterial( { color: 0x4f5357, roughness: 0.82, metalness: 0.02 } );
const CITY_CURB_MATERIAL = new THREE.MeshStandardMaterial( { color: 0xd7d0bd, roughness: 0.76 } );
const CITY_WINDOW_MATERIAL = new THREE.MeshStandardMaterial( {
	color: 0xa9d5ff,
	emissive: 0x204a70,
	emissiveIntensity: 0.22,
	roughness: 0.38,
	metalness: 0.05,
} );
const CITY_LAMP_MATERIAL = new THREE.MeshStandardMaterial( {
	color: 0xffd37a,
	emissive: 0xffb23c,
	emissiveIntensity: 0.35,
	roughness: 0.42,
} );
const CITY_POLE_MATERIAL = new THREE.MeshStandardMaterial( { color: 0x303336, roughness: 0.55, metalness: 0.2 } );
const CITY_BUILDING_MATERIALS = [
	new THREE.MeshStandardMaterial( { color: 0x6d747a, roughness: 0.74 } ),
	new THREE.MeshStandardMaterial( { color: 0x8b877b, roughness: 0.78 } ),
	new THREE.MeshStandardMaterial( { color: 0x59646d, roughness: 0.7 } ),
	new THREE.MeshStandardMaterial( { color: 0x9a927f, roughness: 0.8 } ),
];
const CITY_FINISH_LIGHT_MATERIAL = new THREE.MeshStandardMaterial( { color: 0xf4f1e8, roughness: 0.66 } );
const CITY_FINISH_DARK_MATERIAL = new THREE.MeshStandardMaterial( { color: 0x121820, roughness: 0.58 } );

export function buildTrack( scene, models, customCells, options = {} ) {

	const trackGroup = new THREE.Group();
	trackGroup.position.y = -0.5;

	const trackPieceGroup = new THREE.Group();
	const decoGroup = new THREE.Group();
	const trackScene = options.trackScene === 'city' ? 'city' : 'forest';

	const cells = customCells || TRACK_CELLS;

	for ( const [ gx, gz, key, orient ] of cells ) {

		// City keeps the logical finish cell but avoids the tall finish GLB blocking the driver's view.
		const pieceKey = trackScene === 'city' && key === 'track-finish' && models[ 'track-straight' ] ? 'track-straight' : key;
		const piece = placePiece( models, pieceKey, gx, gz, orient );
		if ( piece ) trackPieceGroup.add( piece );
		if ( trackScene === 'city' && key === 'track-finish' ) addCityFinishMarker( trackPieceGroup, gx, gz, orient );

	}

	{

		const occupied = new Set();
		let minX = Infinity, maxX = - Infinity;
		let minZ = Infinity, maxZ = - Infinity;

		for ( const [ gx, gz ] of cells ) {

			occupied.add( gx + ',' + gz );
			minX = Math.min( minX, gx );
			maxX = Math.max( maxX, gx );
			minZ = Math.min( minZ, gz );
			maxZ = Math.max( maxZ, gz );

		}

		const emptyPositions = [];
		const forestPositions = [];
		const tentPositions = [];
		const buckets = {
			'decoration-empty': emptyPositions,
			'decoration-forest': forestPositions,
			'decoration-tents': tentPositions,
		};

		if ( trackScene === 'forest' && ! customCells ) {

			for ( const [ gx, gz, key, orient ] of DECO_CELLS ) {

				occupied.add( gx + ',' + gz );
				minX = Math.min( minX, gx );
				maxX = Math.max( maxX, gx );
				minZ = Math.min( minZ, gz );
				maxZ = Math.max( maxZ, gz );

				const x = ( gx + 0.5 ) * CELL_RAW;
				const z = ( gz + 0.5 ) * CELL_RAW;
				const rotQ = ( ( ORIENT_DEG[ orient ] ?? 0 ) / 90 ) | 0;
				buckets[ key ]?.push( x, z, rotQ );

			}

		}

		const pad = trackScene === 'city' ? 5 : 3;

		// Simple hash for deterministic pseudo-random placement
		function hash( gx, gz ) {

			let h = gx * 374761393 + gz * 668265263;
			h = ( h ^ ( h >> 13 ) ) * 1274126177;
			return ( h ^ ( h >> 16 ) ) >>> 0;

		}

		if ( trackScene === 'city' ) {

			addCityDecorations( decoGroup, occupied, minX, maxX, minZ, maxZ, pad, hash );

		} else {

			for ( let gz = minZ - pad; gz <= maxZ + pad; gz ++ ) {

				for ( let gx = minX - pad; gx <= maxX + pad; gx ++ ) {

					if ( occupied.has( gx + ',' + gz ) ) continue;

					const distX = gx < minX ? minX - gx : gx > maxX ? gx - maxX : 0;
					const distZ = gz < minZ ? minZ - gz : gz > maxZ ? gz - maxZ : 0;
					const dist = Math.max( distX, distZ );

					const x = ( gx + 0.5 ) * CELL_RAW;
					const z = ( gz + 0.5 ) * CELL_RAW;

					if ( dist <= 1 ) {

						// ~15% chance of tents in the empty ring
						if ( hash( gx, gz ) % 7 === 0 ) {

							tentPositions.push( x, z, hash( gx, gz ) % 4 );

						} else {

							emptyPositions.push( x, z, 0 );

						}

					} else {

						forestPositions.push( x, z, 0 );

					}

				}
			}
		}

		function createInstances( src, positions, name ) {

			if ( positions.length === 0 || ! src ) return;

			const count = positions.length / 3;

			src.traverse( ( child ) => {

				if ( ! child.isMesh ) return;

				const inst = new THREE.InstancedMesh( child.geometry, child.material, count );
				inst.name = name;
				inst.castShadow = true;
				inst.receiveShadow = true;

				for ( let i = 0; i < count; i ++ ) {

					_dummy.position.set( positions[ i * 3 ], 0.5, positions[ i * 3 + 1 ] );
					_dummy.rotation.y = positions[ i * 3 + 2 ] * Math.PI / 2;
					_dummy.scale.set( 1, 1, 1 );
					_dummy.updateMatrix();
					inst.setMatrixAt( i, _dummy.matrix );

				}

				decoGroup.add( inst );

			} );

		}

		createInstances( models[ 'decoration-empty' ], emptyPositions, 'empty-decoration-instances' );
		createInstances( models[ 'decoration-forest' ], forestPositions, 'forest-decoration-instances' );
		createInstances( models[ 'decoration-tents' ], tentPositions, 'tent-decoration-instances' );

	}

	trackGroup.add( trackPieceGroup );
	trackGroup.add( decoGroup );

	trackGroup.scale.setScalar( 0.75 );
	scene.add( trackGroup );

	trackGroup.updateMatrixWorld( true );

	trackGroup.traverse( ( child ) => {

		if ( child.isMesh ) {

			child.castShadow = true;
			child.receiveShadow = true;

		}

	} );

	if ( ! customCells && trackScene === 'forest' ) {

		for ( const [ key, x, y, z, rotDeg ] of NPC_TRUCKS ) {

			const src = models[ key ];
			if ( ! src ) continue;

			const npc = src.clone();
			npc.position.set( x, y, z );
			npc.rotation.y = THREE.MathUtils.degToRad( rotDeg + 180 );
			npc.traverse( ( c ) => {

				if ( c.isMesh ) {

					c.castShadow = true;
					c.receiveShadow = true;

				}

			} );
			scene.add( npc );

		}

	}

}

function addCityFinishMarker( trackPieceGroup, gx, gz, orient ) {

	const marker = new THREE.Group();
	marker.name = 'city-finish-marker';
	marker.position.set( ( gx + 0.5 ) * CELL_RAW, 0.9, ( gz + 0.5 ) * CELL_RAW );
	marker.rotation.y = THREE.MathUtils.degToRad( ORIENT_DEG[ orient ] ?? 0 );

	const columns = 8;
	const rows = 2;
	const tileWidth = 0.58;
	const tileDepth = 0.62;

	for ( let row = 0; row < rows; row ++ ) {

		for ( let column = 0; column < columns; column ++ ) {

			const material = ( row + column ) % 2 === 0 ? CITY_FINISH_LIGHT_MATERIAL : CITY_FINISH_DARK_MATERIAL;
			const tile = new THREE.Mesh( BOX_GEOMETRY, material );
			tile.name = 'city-finish-marker-tile';
			tile.position.set(
				( column - ( columns - 1 ) / 2 ) * tileWidth,
				0,
				( row - ( rows - 1 ) / 2 ) * tileDepth
			);
			tile.scale.set( tileWidth * 0.92, 0.05, tileDepth * 0.92 );
			tile.receiveShadow = true;
			marker.add( tile );

		}

	}

	trackPieceGroup.add( marker );

}

function addCityDecorations( decoGroup, occupied, minX, maxX, minZ, maxZ, pad, hash ) {

	const surfaces = [];
	const curbs = [];
	const poles = [];
	const lamps = [];
	const signs = [];
	const windows = [];
	const rooftops = [];
	const buildingsByMaterial = CITY_BUILDING_MATERIALS.map( () => [] );

	function pushBuilding( x, z, seed, nearTrack ) {

		const floors = nearTrack ? 1 + ( seed % 2 ) : 2 + ( seed % 4 );
		const height = nearTrack ? floors * 1.35 : floors * 2.1;
		const width = nearTrack ? 1.85 + ( ( seed >> 4 ) % 3 ) * 0.28 : 2.6 + ( ( seed >> 4 ) % 4 ) * 0.42;
		const depth = nearTrack ? 1.8 + ( ( seed >> 7 ) % 3 ) * 0.28 : 2.7 + ( ( seed >> 7 ) % 4 ) * 0.42;
		const rot = ( ( seed >> 11 ) % 2 ) * Math.PI / 2;
		const materialIndex = ( seed >> 13 ) % buildingsByMaterial.length;
		const building = {
			x,
			y: 0.58 + height / 2,
			z,
			width,
			height,
			depth,
			rot,
		};
		buildingsByMaterial[ materialIndex ].push( building );

		rooftops.push( {
			x,
			y: 0.74 + height,
			z,
			width: width * 0.54,
			height: 0.38,
			depth: depth * 0.54,
			rot,
		} );

		// Windows are render-only facade strips. They add scale cues without
		// increasing collision complexity or affecting the trackMap contract.
		const facadeHeight = Math.max( 2.2, height - 3.2 );
		const facadeWidth = Math.max( 0.5, width * 0.13 );
		const frontOffset = depth / 2 + 0.04;
		const sideOffset = width / 2 + 0.04;
		windows.push(
			offsetFacade( building, 0, frontOffset, facadeWidth, facadeHeight, 0 ),
			offsetFacade( building, 0, - frontOffset, facadeWidth, facadeHeight, Math.PI ),
			offsetFacade( building, sideOffset, 0, 0.42, facadeHeight, Math.PI / 2 )
		);

	}

	for ( let gz = minZ - pad; gz <= maxZ + pad; gz ++ ) {

		for ( let gx = minX - pad; gx <= maxX + pad; gx ++ ) {

			if ( occupied.has( gx + ',' + gz ) ) continue;

			const seed = hash( gx, gz );
			const distX = gx < minX ? minX - gx : gx > maxX ? gx - maxX : 0;
			const distZ = gz < minZ ? minZ - gz : gz > maxZ ? gz - maxZ : 0;
			const dist = Math.max( distX, distZ );
			const x = ( gx + 0.5 ) * CELL_RAW;
			const z = ( gz + 0.5 ) * CELL_RAW;

			surfaces.push( {
				x,
				y: 0.54,
				z,
				width: CELL_RAW * 0.92,
				height: 0.08,
				depth: CELL_RAW * 0.92,
				rot: 0,
			} );

			if ( dist <= 1 ) {

				const rot = ( seed % 2 ) * Math.PI / 2;
				curbs.push( {
					x,
					y: 0.66,
					z,
					width: CELL_RAW * 0.72,
					height: 0.24,
					depth: 0.22,
					rot,
				} );

				if ( seed % 3 === 0 ) {

					const offset = CELL_RAW * 0.32;
					const lightX = x + ( seed % 2 === 0 ? offset : - offset );
					const lightZ = z + ( seed % 4 < 2 ? offset : - offset );
					poles.push( {
						x: lightX,
						y: 2.6,
						z: lightZ,
						width: 0.12,
						height: 4.2,
						depth: 0.12,
						rot: 0,
					} );
					lamps.push( {
						x: lightX,
						y: 4.82,
						z: lightZ,
						width: 0.72,
						height: 0.18,
						depth: 0.36,
						rot,
					} );

				}

				if ( seed % 11 === 0 ) {

					signs.push( {
						x,
						y: 1.88,
						z,
						width: 1.4,
						height: 1,
						depth: 0.12,
						rot,
					} );

				}

				continue;

			}

			pushBuilding( x, z, seed, dist <= 2 );

		}

	}

	createScaledBoxInstances( decoGroup, 'city-surface-instances', CITY_SURFACE_MATERIAL, surfaces );
	createScaledBoxInstances( decoGroup, 'city-curb-instances', CITY_CURB_MATERIAL, curbs );
	for ( let i = 0; i < buildingsByMaterial.length; i ++ ) {

		createScaledBoxInstances( decoGroup, 'city-building-instances', CITY_BUILDING_MATERIALS[ i ], buildingsByMaterial[ i ] );

	}
	createScaledBoxInstances( decoGroup, 'city-rooftop-instances', CITY_POLE_MATERIAL, rooftops );
	createScaledBoxInstances( decoGroup, 'city-window-instances', CITY_WINDOW_MATERIAL, windows );
	createScaledBoxInstances( decoGroup, 'city-streetlight-pole-instances', CITY_POLE_MATERIAL, poles );
	createScaledBoxInstances( decoGroup, 'city-streetlight-lamp-instances', CITY_LAMP_MATERIAL, lamps );
	createScaledBoxInstances( decoGroup, 'city-sign-instances', CITY_LAMP_MATERIAL, signs );

}

function offsetFacade( building, localX, localZ, width, height, localRot ) {

	const cos = Math.cos( building.rot );
	const sin = Math.sin( building.rot );

	return {
		x: building.x + localX * cos - localZ * sin,
		y: 0.58 + height / 2 + 1.55,
		z: building.z + localX * sin + localZ * cos,
		width,
		height,
		depth: 0.08,
		rot: building.rot + localRot,
	};

}

function createScaledBoxInstances( group, name, material, entries ) {

	if ( entries.length === 0 ) return;

	const inst = new THREE.InstancedMesh( BOX_GEOMETRY, material, entries.length );
	inst.name = name;
	inst.castShadow = true;
	inst.receiveShadow = true;

	for ( let i = 0; i < entries.length; i ++ ) {

		const entry = entries[ i ];
		_dummy.position.set( entry.x, entry.y, entry.z );
		_dummy.rotation.set( 0, entry.rot, 0 );
		_dummy.scale.set( entry.width, entry.height, entry.depth );
		_dummy.updateMatrix();
		inst.setMatrixAt( i, _dummy.matrix );

	}

	inst.instanceMatrix.needsUpdate = true;
	group.add( inst );

}

export function placePiece( models, key, gx, gz, orient ) {

	const src = models[ key ];
	if ( ! src ) return null;

	const piece = src.clone();
	piece.position.set( ( gx + 0.5 ) * CELL_RAW, 0.5, ( gz + 0.5 ) * CELL_RAW );

	const deg = ORIENT_DEG[ orient ] ?? 0;
	piece.rotation.y = THREE.MathUtils.degToRad( deg );

	return piece;

}

// ─── Track Codec ──────────────────────────────────────────

const TYPE_NAMES = [ 'track-straight', 'track-corner', 'track-bump', 'track-finish' ];
const TYPE_INDEX = {};
for ( let i = 0; i < TYPE_NAMES.length; i ++ ) TYPE_INDEX[ TYPE_NAMES[ i ] ] = i;

const ORIENT_TO_GODOT = [ 0, 16, 10, 22 ];
const GODOT_TO_ORIENT = { 0: 0, 16: 1, 10: 2, 22: 3 };

export { TYPE_NAMES };

export function encodeCells( cells ) {

	const bytes = new Uint8Array( cells.length * 3 );

	for ( let i = 0; i < cells.length; i ++ ) {

		const [ gx, gz, name, godotOrient ] = cells[ i ];
		const ti = TYPE_INDEX[ name ] ?? 0;
		const oi = GODOT_TO_ORIENT[ godotOrient ] ?? 0;

		bytes[ i * 3 ] = gx + 128;
		bytes[ i * 3 + 1 ] = gz + 128;
		bytes[ i * 3 + 2 ] = ( ti << 2 ) | oi;

	}

	return bytesToBase64url( bytes );

}

export function decodeCells( str ) {

	const bytes = base64urlToBytes( str );
	const cells = [];

	for ( let i = 0; i + 2 < bytes.length; i += 3 ) {

		const gx = bytes[ i ] - 128;
		const gz = bytes[ i + 1 ] - 128;
		const packed = bytes[ i + 2 ];
		const ti = ( packed >> 2 ) & 0x03;
		const oi = packed & 0x03;

		cells.push( [ gx, gz, TYPE_NAMES[ ti ], ORIENT_TO_GODOT[ oi ] ] );

	}

	return cells;

}

export function computeSpawnPosition( cells ) {

	let cell = cells[ 0 ];

	for ( const c of cells ) {

		if ( c[ 2 ] === 'track-finish' ) {

			cell = c;
			break;

		}

	}

	if ( ! cell ) return { position: [ 3.5, 0.5, 5 ], angle: 0 };

	const gx = cell[ 0 ];
	const gz = cell[ 1 ];
	const x = ( gx + 0.5 ) * CELL_RAW * GRID_SCALE;
	const z = ( gz + 0.5 ) * CELL_RAW * GRID_SCALE;

	const orient = cell[ 3 ];
	const angle = THREE.MathUtils.degToRad( ORIENT_DEG[ orient ] || 0 );

	return { position: [ x, 0.5, z ], angle };

}

export function computeTrackBounds( cells ) {

	if ( ! cells || cells.length === 0 ) return { centerX: 0, centerZ: 0, halfWidth: 30, halfDepth: 30 };

	let minX = Infinity, maxX = - Infinity;
	let minZ = Infinity, maxZ = - Infinity;

	for ( const [ gx, gz ] of cells ) {

		minX = Math.min( minX, gx );
		maxX = Math.max( maxX, gx );
		minZ = Math.min( minZ, gz );
		maxZ = Math.max( maxZ, gz );

	}

	const S = CELL_RAW * GRID_SCALE;
	const centerX = ( minX + maxX + 1 ) / 2 * S;
	const centerZ = ( minZ + maxZ + 1 ) / 2 * S;
	const halfWidth = ( maxX - minX + 1 ) / 2 * S + S;
	const halfDepth = ( maxZ - minZ + 1 ) / 2 * S + S;

	return { centerX, centerZ, halfWidth, halfDepth };

}

function bytesToBase64url( bytes ) {

	let binary = '';
	for ( let i = 0; i < bytes.length; i ++ ) binary += String.fromCharCode( bytes[ i ] );

	return btoa( binary ).replace( /\+/g, '-' ).replace( /\//g, '_' ).replace( /=+$/, '' );

}

function base64urlToBytes( str ) {

	const base64 = str.replace( /-/g, '+' ).replace( /_/g, '/' );
	const binary = atob( base64 );
	const bytes = new Uint8Array( binary.length );
	for ( let i = 0; i < binary.length; i ++ ) bytes[ i ] = binary.charCodeAt( i );

	return bytes;

}
