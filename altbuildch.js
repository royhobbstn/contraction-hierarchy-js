const { Graph } = require('../geojson-dijkstra/index.js');
const { readyNetwork, cleanseNetwork } = require('./common.js');


const { contractGraph } = require('./alt-build-contraction-hierarchy.js');



main();

async function main() {

  const geofile = await readyNetwork();
  const geojson = cleanseNetwork(geofile);

  const fasterDijkstra = new Graph();
  fasterDijkstra.loadFromGeoJson(geojson);

  // new
  contractGraph(fasterDijkstra);


}
