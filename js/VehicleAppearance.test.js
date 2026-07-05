import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyMercedesVehicleColor, applyMotorcycleColor } from './VehicleAppearance.js';

function createNamedMesh( name ) {

	const mesh = new THREE.Mesh(
		new THREE.BoxGeometry( 1, 1, 1 ),
		new THREE.MeshBasicMaterial( { color: '#ffffff' } )
	);
	mesh.name = name;
	return mesh;

}

describe( 'applyMotorcycleColor', () => {

	it( 'tints only the motorcycle body mesh so wheels and fork stay readable', () => {

		const group = new THREE.Group();
		const body = createNamedMesh( 'body' );
		const wheel = createNamedMesh( 'wheel-front' );
		const fork = createNamedMesh( 'fork' );
		group.add( body, wheel, fork );

		applyMotorcycleColor( group, 'red' );

		expect( body.material.color.getHexString() ).toBe( 'ec3f35' );
		expect( wheel.material.color.getHexString() ).toBe( 'ffffff' );
		expect( fork.material.color.getHexString() ).toBe( 'ffffff' );

	} );

} );

describe( 'applyMercedesVehicleColor', () => {

	it( 'tints only the named sedan body paint material', () => {

		const group = new THREE.Group();
		const body = createNamedMesh( 'body' );
		body.material.name = 'vehicle-body-paint';
		const glass = createNamedMesh( 'front-windshield' );
		glass.material.name = 'vehicle-smoked-glass';
		const wheel = createNamedMesh( 'front-left-tire' );
		wheel.material.name = 'vehicle-rubber-tire';
		group.add( body, glass, wheel );
		const originalBodyMaterial = body.material;

		applyMercedesVehicleColor( group, 'purple' );

		expect( body.material.color.getHexString() ).toBe( '9a6cff' );
		expect( glass.material.color.getHexString() ).toBe( 'ffffff' );
		expect( wheel.material.color.getHexString() ).toBe( 'ffffff' );
		expect( body.material ).not.toBe( originalBodyMaterial );

	} );

} );
