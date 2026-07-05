import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Vehicle } from './Vehicle.js';

function createPaintedBody() {

	const mesh = new THREE.Mesh(
		new THREE.BoxGeometry( 1, 1, 1 ),
		new THREE.MeshBasicMaterial( { color: '#ffffff' } )
	);
	mesh.name = 'body';
	mesh.material.name = 'vehicle-body-paint';
	return mesh;

}

function createWheelNode( name, childName ) {

	const wheel = new THREE.Group();
	wheel.name = name;

	const tire = new THREE.Mesh(
		new THREE.BoxGeometry( 1, 1, 1 ),
		new THREE.MeshBasicMaterial( { color: '#111111' } )
	);
	tire.name = childName;
	wheel.add( tire );
	return wheel;

}

describe( 'Vehicle.init', () => {

	it( 'tracks only the four car wheel parent nodes and tints Mercedes body paint', () => {

		const model = new THREE.Group();
		model.add(
			createPaintedBody(),
			createWheelNode( 'wheel-front-left', 'front-left-tire' ),
			createWheelNode( 'wheel-front-right', 'front-right-tire' ),
			createWheelNode( 'wheel-back-left', 'back-left-tire' ),
			createWheelNode( 'wheel-back-right', 'back-right-tire' )
		);

		const vehicle = new Vehicle();
		vehicle.init( model, { vehicleType: 'car', vehicleModel: 'mercedes-e', vehicleColor: 'green' } );

		expect( vehicle.bodyNode.material.color.getHexString() ).toBe( '4ec45f' );
		expect( vehicle.wheels.map( ( wheel ) => wheel.name ).sort() ).toEqual( [
			'wheel-back-left',
			'wheel-back-right',
			'wheel-front-left',
			'wheel-front-right'
		] );
		expect( vehicle.wheelFL.name ).toBe( 'wheel-front-left' );
		expect( vehicle.wheelFR.name ).toBe( 'wheel-front-right' );
		expect( vehicle.wheelBL.name ).toBe( 'wheel-back-left' );
		expect( vehicle.wheelBR.name ).toBe( 'wheel-back-right' );

	} );

	it( 'keeps legacy truck models on their authored color materials', () => {

		const model = new THREE.Group();
		model.add( createPaintedBody() );

		const vehicle = new Vehicle();
		vehicle.init( model, { vehicleType: 'truck', vehicleColor: 'green' } );

		expect( vehicle.bodyNode.material.color.getHexString() ).toBe( 'ffffff' );

	} );

} );
