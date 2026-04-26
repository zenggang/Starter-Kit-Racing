import { mountRacingRuntime } from './main.js';

const map = new URLSearchParams( window.location.search ).get( 'map' );

mountRacingRuntime( document.body, {
	assetBaseUrl: '',
	map,
	useQueryMap: true
} );
