const createGraph = require('ngraph.graph');
const pathNGraph = require('ngraph.path');

// geojson-dijkstra
const { Graph } = require('../../geojson-dijkstra/index.js');

// load utility functions
const { readyNetwork, cleanseNetwork, getNGraphDist, populateNGraph } = require('./test-util.js');

// load contraction hierarchy version bidirectional dijkstra
const { queryContractionHierarchy } = require('../run-contraction-hierarchy');
const { contractGraph } = require('../build-contraction-hierarchy.js');

const ITERATIONS = 10000;

main();

async function main() {

  const geofile = await readyNetwork();
  const geojson = cleanseNetwork(geofile);

  const fasterDijkstra = new Graph();
  fasterDijkstra.loadFromGeoJson(geojson);

  console.time('TimeToContract');
  contractGraph(fasterDijkstra);
  console.timeEnd('TimeToContract');

  const ngraph = createGraph();
  populateNGraph(ngraph, geojson);

  const pathFinder = pathNGraph.aStar(ngraph, {
    distance(fromNode, toNode, link) {
      return link.data._cost;
    },
    heuristic(fromNode, toNode) {
      const fromData = fromNode.data;
      const toData = toNode.data;
      var dx = fromData.lng - toData.lng;
      var dy = fromData.lat - toData.lat;
      return (Math.abs(dx) + Math.abs(dy)) * 7;
    }
  });

  setTimeout(function() {
    // performance test
    const adj_keys = Object.keys(fasterDijkstra.adjacency_list);
    const adj_length = adj_keys.length;

    console.time('ngraph');
    for (let i = 0; i < ITERATIONS; i++) {
      let rnd1 = Math.floor(Math.random() * adj_length);
      let rnd2 = Math.floor(Math.random() * adj_length);
      getNGraphDist(pathFinder.find(adj_keys[rnd1], adj_keys[rnd2]));
    }
    console.timeEnd('ngraph');

    console.time('ContractionHierarchy');
    for (let i = 0; i < ITERATIONS; i++) {
      let rnd1 = Math.floor(Math.random() * adj_length);
      let rnd2 = Math.floor(Math.random() * adj_length);
      queryContractionHierarchy(
        fasterDijkstra,
        adj_keys[rnd1],
        adj_keys[rnd2]
      );
    }
    console.timeEnd('ContractionHierarchy');

  }, 3000);
}
