// CommonJS compatibility wrapper for Node.js
import * as mainModule from './main.js';

// Export for CommonJS compatibility
export const Graph = mainModule.Graph;
export const CoordinateLookup = mainModule.CoordinateLookup;
export const __geoindex = mainModule.__geoindex;
export const __kdindex = mainModule.__kdindex;

// Default export for backward compatibility
export default mainModule;
