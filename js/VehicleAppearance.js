import * as THREE from 'three';

const DOG_FORWARD_FIX_Y = Math.PI / 2;
const DOG_GROUND_LIFT = 0.74;
const DOG_MODEL_SCALE = 2 / 3;

const _dogChestColor = new THREE.Color( '#f2e3c7' );

export function vehicleColorToHex( color ) {

	if ( color === 'green' ) return '#4ec45f';
	if ( color === 'purple' ) return '#9a6cff';
	if ( color === 'red' ) return '#ec3f35';
	return '#ffd34d';

}

/**
 * Meshy exports the corgi racer as one unmaterialed mesh whose local forward
 * points sideways and whose wheels sit below the runtime's visual ground line.
 * Keep that asset-specific cleanup here so the racing runtime can continue to
 * treat every loaded vehicle as a normal Object3D.
 */
export function prepareDogVehicleModel( model ) {

	if ( ! model ) return;

	model.rotation.y = DOG_FORWARD_FIX_Y;
	model.position.y = DOG_GROUND_LIFT;
	model.scale.setScalar( DOG_MODEL_SCALE );

}

export function applyDogVehicleColor( model, color ) {

	if ( ! model ) return;

	const tint = vehicleColorToHex( color );

	model.traverse( ( child ) => {

		if ( ! child.isMesh ) return;

		if ( ! child.geometry ) return;

		child.geometry = child.geometry.clone();
		applyDogVertexColors( child.geometry, tint );
		child.material = createDogBodyMaterial( child.material );

	} );

}

/**
 * Motorcycle ships as a single upstream GLB while the truck ships as one GLB
 * per body color. Tint only the motorcycle body mesh and clone its material so
 * a player's color choice does not leak into wheels, fork, or cached models.
 */
export function applyMotorcycleColor( model, color ) {

	if ( ! model ) return;

	const tint = vehicleColorToHex( color );

	model.traverse( ( child ) => {

		if ( ! child.isMesh || child.name.toLowerCase() !== 'body' ) return;

		if ( Array.isArray( child.material ) ) {

			child.material = child.material.map( ( material ) => tintMaterial( material, tint ) );

		} else {

			child.material = tintMaterial( child.material, tint );

		}

	} );

}

function tintMaterial( material, tint ) {

	if ( ! material || ! material.color ) return material;

	const next = material.clone();
	next.color.set( tint );
	next.needsUpdate = true;
	return next;

}

function createDogBodyMaterial( sourceMaterial ) {

	const material = new THREE.MeshStandardMaterial( {
		vertexColors: true,
		roughness: 0.72,
		metalness: 0.0,
		flatShading: true,
	} );
	copyVehicleMaterialRuntimeFlags( material, sourceMaterial );
	return material;

}

function copyVehicleMaterialRuntimeFlags( material, sourceMaterial ) {

	if ( ! sourceMaterial ) return;

	material.transparent = sourceMaterial.transparent;
	material.opacity = sourceMaterial.opacity;
	material.depthWrite = sourceMaterial.depthWrite;

}

function applyDogVertexColors( geometry, tint ) {

	geometry.computeBoundingBox();
	const box = geometry.boundingBox;
	const position = geometry.getAttribute( 'position' );

	if ( ! box || ! position ) return;

	const size = box.getSize( new THREE.Vector3() );
	const halfZ = Math.max( size.z / 2, 0.001 );
	const baseColor = new THREE.Color( tint );
	const colors = [];

	for ( let i = 0; i < position.count; i ++ ) {

		const y = position.getY( i );
		const z = position.getZ( i );
		const yRatio = ( y - box.min.y ) / Math.max( size.y, 0.001 );
		const color = baseColor.clone();

		// Keep the generated dog body on the chosen player color. A small cream
		// blend on the upper center gives the corgi shape some readability
		// without black artifacts leaking onto the body mesh.
		if ( yRatio > 0.48 && Math.abs( z ) < halfZ * 0.38 ) {

			color.lerp( _dogChestColor, 0.38 );

		}

		colors.push( color.r, color.g, color.b );

	}

	geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );

}
