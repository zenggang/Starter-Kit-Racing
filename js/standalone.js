import { mountRacingRuntime } from './main.js';

const map = new URLSearchParams( window.location.search ).get( 'map' );
const trackScene = new URLSearchParams( window.location.search ).get( 'scene' );

mountRacingRuntime( document.body, {
	assetBaseUrl: '',
	map,
	trackScene,
	useQueryMap: true
} );
