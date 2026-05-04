/**
 * Mobile Safari and WeChat WebView are far more likely to crash when the race
 * runtime combines half-float post-processing, repeated viewport resizes and
 * heavy probe baking. This helper keeps those heuristics in one place so the
 * renderer can choose a safer graphics profile without changing gameplay code.
 */
export function resolveRuntimeGraphicsProfile( { userAgent = '', hasCustomTrack = false } = {} ) {

	const mobileWebKit = isMobileWebKitShell( userAgent );
	const riskyInAppShell = /MicroMessenger/i.test( userAgent );
	const useSafeMobileProfile = mobileWebKit || riskyInAppShell;

	return {
		enablePostProcessing: ! useSafeMobileProfile,
		enableLightProbeBake: ! useSafeMobileProfile && ! hasCustomTrack,
		maxPixelRatio: useSafeMobileProfile ? 1.5 : 2,
		observeVisualViewport: ! useSafeMobileProfile,
	};

}

/**
 * iPhone/iPad Safari and embedded WebKit shells share the same fragile WebGL
 * implementation. Matching on the WebKit engine plus Apple mobile device
 * markers is enough for our runtime fallback decisions.
 */
function isMobileWebKitShell( userAgent ) {

	return /AppleWebKit/i.test( userAgent ) && /(iPhone|iPad|iPod)/i.test( userAgent );

}
