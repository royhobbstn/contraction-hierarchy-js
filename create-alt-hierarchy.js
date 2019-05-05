const fs = require('fs').promises;
const { contractGraph } = require('./alt-build-contraction-hierarchy.js');
const { readyNetwork, cleanseNetwork } = require('./common.js');
const { Graph } = require('../geojson-dijkstra/index.js');

main();

async function main() {

  const geofile = await readyNetwork();

  const geojson = cleanseNetwork(geofile);


  console.time('contractTime');
  const graph = new Graph();
  graph.loadFromGeoJson(geojson);

  contractGraph(graph);

  console.timeEnd('contractTime');


}
