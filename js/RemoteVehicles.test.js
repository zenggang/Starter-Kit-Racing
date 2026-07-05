import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteVehicles } from './RemoteVehicles.js';

function createSedanModel() {

	const group = new THREE.Group();
	group.name = 'vehicle-mercedes-e';
	const body = new THREE.Mesh(
		new THREE.BoxGeometry( 1, 1, 1 ),
		new THREE.MeshBasicMaterial( { color: '#ffffff' } )
	);
	body.name = 'body';
	body.material.name = 'vehicle-body-paint';
	group.add( body );
	return group;

}

function createNamedModel( name ) {

	const group = new THREE.Group();
	group.name = name;
	return group;

}

function readBodyHex( model ) {

	let hex = null;
	model.traverse( ( child ) => {

		if ( child.isMesh && child.name === 'body' ) hex = child.material.color.getHexString();

	} );
	return hex;

}

describe( 'RemoteVehicles', () => {

	beforeEach( () => {

		vi.spyOn( HTMLCanvasElement.prototype, 'getContext' ).mockReturnValue( {
			clearRect: vi.fn(),
			fill: vi.fn(),
			fillText: vi.fn(),
			beginPath: vi.fn(),
			moveTo: vi.fn(),
			lineTo: vi.fn(),
			quadraticCurveTo: vi.fn(),
			closePath: vi.fn(),
			stroke: vi.fn(),
			set font( _value ) {},
			set textAlign( _value ) {},
			set textBaseline( _value ) {},
			set fillStyle( _value ) {},
			set strokeStyle( _value ) {},
			set lineWidth( _value ) {},
		} );

	} );

	afterEach( () => {

		vi.restoreAllMocks();

	} );

	it( 'uses the original per-color truck model for remote truck racers', () => {

		const scene = new THREE.Scene();
		const manager = new RemoteVehicles( scene, {
			'vehicle-mercedes-e': createSedanModel(),
			'vehicle-truck-yellow': createNamedModel( 'vehicle-truck-yellow' ),
			'vehicle-truck-red': createNamedModel( 'vehicle-truck-red' ),
		} );

		manager.setVehicles( [
			{
				playerId: 'player-2',
				nickname: '远端红车',
				color: 'red',
				vehicleType: 'truck',
				presence: 'connected',
				position: { x: 0, y: 0.5, z: 0 },
				heading: 0,
				lastReportAt: new Date().toISOString(),
			}
		] );

		const entry = manager.entries.get( 'player-2' );
		expect( entry ).toBeDefined();
		expect( entry.model.name ).toBe( 'vehicle-truck-red' );
		expect( readBodyHex( entry.model ) ).toBeNull();

	} );

	it( 'tints remote Mercedes car racers with the selected body color', () => {

		const scene = new THREE.Scene();
		const manager = new RemoteVehicles( scene, {
			'vehicle-mercedes-e': createSedanModel(),
			'vehicle-truck-yellow': createNamedModel( 'vehicle-truck-yellow' ),
		} );

		manager.setVehicles( [
			{
				playerId: 'player-2',
				nickname: '远端红车',
				color: 'red',
				vehicleType: 'car',
				vehicleModel: 'mercedes-e',
				presence: 'connected',
				position: { x: 0, y: 0.5, z: 0 },
				heading: 0,
				lastReportAt: new Date().toISOString(),
			}
		] );

		const entry = manager.entries.get( 'player-2' );
		expect( entry ).toBeDefined();
		expect( entry.model.name ).toBe( 'vehicle-mercedes-e' );
		expect( readBodyHex( entry.model ) ).toBe( 'ec3f35' );

	} );

} );
