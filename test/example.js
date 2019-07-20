const fs = require('fs');
const { Graph, CoordinateLookup } = require('../index.js');

const geofile = fs.readFileSync('../networks/basic.geojson', 'utf8');
const geojson = JSON.parse(geofile);

const graph = new Graph(geojson);

// build hierarchy.  this step may take a while.
graph.contractGraph();

const finder = graph.createPathfinder({ ids: true, path: true });

// create a coordinate lookup to be able to input arbitrary coordinate pairs
// and return the nearest coordinates in the network
const lookup = new CoordinateLookup(graph);
const coords1 = lookup.getClosestNetworkPt(-116.45, 41.96);
const coords2 = lookup.getClosestNetworkPt(-117.45, 40.96);

const path = finder.queryContractionHierarchy(coords1, coords2);

console.log(path);
