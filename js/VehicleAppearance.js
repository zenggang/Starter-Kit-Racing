export function vehicleColorToHex( color ) {

	if ( color === 'green' ) return '#4ec45f';
	if ( color === 'purple' ) return '#9a6cff';
	if ( color === 'red' ) return '#ec3f35';
	return '#ffd34d';

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
