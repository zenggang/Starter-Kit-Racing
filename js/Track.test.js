import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildTrack } from './Track.js';

function createModel( name ) {

	const mesh = new THREE.Mesh(
		new THREE.BoxGeometry( 1, 1, 1 ),
		new THREE.MeshBasicMaterial( { color: '#ffffff' } )
	);
	mesh.name = name;
	return mesh;

}

function createRuntimeModels() {

	return {
		'track-straight': createModel( 'track-straight' ),
		'track-corner': createModel( 'track-corner' ),
		'track-bump': createModel( 'track-bump' ),
		'track-finish': createModel( 'track-finish' ),
		'decoration-empty': createModel( 'decoration-empty' ),
		'decoration-forest': createModel( 'decoration-forest' ),
		'decoration-tents': createModel( 'decoration-tents' ),
		'vehicle-truck-green': createModel( 'vehicle-truck-green' ),
		'vehicle-truck-purple': createModel( 'vehicle-truck-purple' ),
		'vehicle-truck-red': createModel( 'vehicle-truck-red' ),
	};

}

describe( 'buildTrack scene decorations', () => {

	it( 'uses city building instances instead of forest instances for the city scene', () => {

		const scene = new THREE.Scene();

		buildTrack( scene, createRuntimeModels(), null, { trackScene: 'city' } );

		let cityBuildingInstances = 0;
		let cityFinishMarkers = 0;
		let forestInstances = 0;
		let tentInstances = 0;
		let npcTruckMeshes = 0;
		let tallFinishMeshes = 0;
		scene.traverse( ( child ) => {

			if ( child.name === 'city-building-instances' ) cityBuildingInstances += 1;
			if ( child.name === 'city-finish-marker' ) cityFinishMarkers += 1;
			if ( child.name === 'forest-decoration-instances' ) forestInstances += 1;
			if ( child.name === 'tent-decoration-instances' ) tentInstances += 1;
			if ( child.name.startsWith( 'vehicle-truck-' ) ) npcTruckMeshes += 1;
			if ( child.name === 'track-finish' ) tallFinishMeshes += 1;

		} );

		expect( cityBuildingInstances ).toBeGreaterThan( 0 );
		expect( cityFinishMarkers ).toBe( 1 );
		expect( forestInstances ).toBe( 0 );
		expect( tentInstances ).toBe( 0 );
		expect( npcTruckMeshes ).toBe( 0 );
		expect( tallFinishMeshes ).toBe( 0 );

	} );

} );
