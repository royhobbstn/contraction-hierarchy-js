const createGraph = require('ngraph.graph');
const pathNGraph = require('ngraph.path');

// load utility functions
const { readyNetwork, getNGraphDist, populateNGraph } = require('./test-util.js');

// load contraction hierarchy version bidirectional dijkstra
const GraphCH = require('../index.js').Graph;


const ITERATIONS = 10000;

main();

async function main() {

  const geojson = await readyNetwork();

  const graph = new GraphCH(geojson, { debugMode: true });

  console.time("Contracted");
  graph.contractGraph();
  console.timeEnd("Contracted");

  const finder = graph.createPathfinder();

  const ngraph = createGraph();
  populateNGraph(ngraph, geojson);

  const pathFinder = pathNGraph.aStar(ngraph, {
    distance(fromNode, toNode, link) {
      return link.data._cost;
    }
  });

  setTimeout(function() {
    // performance test
    const adj_keys = Object.keys(graph._nodeToIndexLookup);
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
      finder.queryContractionHierarchy(adj_keys[rnd1], adj_keys[rnd2]);
    }
    console.timeEnd('ContractionHierarchy');

  }, 3000);


}
