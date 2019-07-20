const createGraph = require('ngraph.graph');
const pathNGraph = require('ngraph.path');

// load utility functions
const { readyNetwork, getNGraphDist, populateNGraph } = require('./test-util.js');

const GDGraph = require('geojson-dijkstra').Graph;

// load contraction hierarchy version bidirectional dijkstra
const GraphCH = require('../index.js').Graph;


const ITERATIONS = 10000;

main();

async function main() {

  const geojson = await readyNetwork();

  const graph = new GraphCH(geojson, { debugMode: true });
  graph.contractGraph();

  const gdgraph = new GDGraph(geojson);

  const finder = graph.createPathfinder({ ids: true, path: true });
  const gdfinder = gdgraph.createFinder({ parseOutputFns: [] });

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
    const adj_keys = Object.keys(gdgraph.adjacency_list);
    const adj_length = adj_keys.length;

    console.time('ngraph');
    for (let i = 0; i < ITERATIONS; i++) {
      let rnd1 = Math.floor(Math.random() * adj_length);
      let rnd2 = Math.floor(Math.random() * adj_length);
      getNGraphDist(pathFinder.find(adj_keys[rnd1], adj_keys[rnd2]));
    }
    console.timeEnd('ngraph');

    console.time('GeoJSON-Dijkstra');
    for (let i = 0; i < ITERATIONS; i++) {
      let rnd1 = Math.floor(Math.random() * adj_length);
      let rnd2 = Math.floor(Math.random() * adj_length);
      gdfinder.findPath(
        adj_keys[rnd1],
        adj_keys[rnd2]
      );
    }
    console.timeEnd('GeoJSON-Dijkstra');

    console.time('ContractionHierarchy');
    for (let i = 0; i < ITERATIONS; i++) {
      let rnd1 = Math.floor(Math.random() * adj_length);
      let rnd2 = Math.floor(Math.random() * adj_length);
      finder.queryContractionHierarchy(adj_keys[rnd1], adj_keys[rnd2]);
    }
    console.timeEnd('ContractionHierarchy');

  }, 3000);


}
