const fs = require('fs').promises;
const { contractGraph } = require('./build-contraction-hierarchy.js');
const { readyNetwork, cleanseNetwork } = require('./common.js');
const { Graph } = require('geojson-dijkstra');

main();

async function main() {

  const geofile = await readyNetwork();

  const geojson = cleanseNetwork(geofile);


  console.time('contractTime');
  const graph = new Graph();
  graph.loadFromGeoJson(geojson);


  // const contracted_graph = contractGraph(graph);
  const contracted_graph = contractGraph(geojson, { cost_field: '_cost' });

  console.timeEnd('contractTime');

  await fs.writeFile(
    './networks/ch.json',
    JSON.stringify(contracted_graph[0]),
    'utf8'
  );
  await fs.writeFile(
    './networks/ne.json',
    JSON.stringify(contracted_graph[1]),
    'utf8'
  );
  await fs.writeFile(
    './networks/nr.json',
    JSON.stringify(contracted_graph[2]),
    'utf8'
  );
}
