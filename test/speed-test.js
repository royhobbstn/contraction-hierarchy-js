const createGraph = require('ngraph.graph');
const pathNGraph = require('ngraph.path');

// load utility functions
const { readyNetwork, cleanseNetwork, getNGraphDist, populateNGraph } = require('geojson-dijkstra/test/test-util.js');

// load contraction hierarchy version bidirectional dijkstra
const GraphCH = require('../index.js').Graph;


const ITERATIONS = 10000;

main();

async function main() {

  const geofile = await readyNetwork();
  const geojson = cleanseNetwork(geofile);

  const graph = new GraphCH(geojson);

  console.time('TimeToContract');
  graph.contractGraph();
  console.timeEnd('TimeToContract');

  const finder = graph.createPathfinder(); // todo  options go here

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
    const adj_keys = Object.keys(graph.adjacency_list);
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
      finder.queryContractionHierarchy(
        adj_keys[rnd1],
        adj_keys[rnd2]
      );
    }
    console.timeEnd('ContractionHierarchy');

  }, 3000);
}
