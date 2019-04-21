const new_adj = require('../networks/ch.json');
const new_edge = require('../networks/ne.json');
const node_rank = require('../networks/nr.json');
const createGraph = require('ngraph.graph');
const pathNGraph = require('ngraph.path');

// faster-dijkstra
const { Graph, buildEdgeIdList, buildGeoJsonPath } = require('geojson-dijkstra');

// load utility functions
const { toAdjacencyList, toIdList, readyNetwork, cleanseNetwork, getNGraphDist, populateNGraph } = require('../js/common.js');

const {
  queryContractionHierarchy
} = require('../js/run-contraction-hierarchy');


const ITERATIONS = 1000;

main();

async function main() {

  const geofile = await readyNetwork();

  const geojson = cleanseNetwork(geofile);

  const fasterDijkstra = new Graph();
  fasterDijkstra.loadFromGeoJson(geojson);

  const adjacency = toAdjacencyList(geojson);

  const id_list = toIdList(geojson);
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
    const adj_keys = Object.keys(adjacency);
    const adj_length = adj_keys.length;
    const new_adj_keys = Object.keys(new_adj);
    const new_adj_length = new_adj_keys.length;
    const fd_keys = Object.keys(adjacency).map(key => {
      return key.split(',').map(d => Number(d));
    });


    console.time('fasterDijkstra');
    for (let i = 0; i < ITERATIONS; i++) {
      let rnd1 = Math.floor(Math.random() * adj_length);
      let rnd2 = Math.floor(Math.random() * adj_length);
      fasterDijkstra.findPath(
        fd_keys[rnd1],
        fd_keys[rnd2], [buildEdgeIdList, buildGeoJsonPath]
      );
    }
    console.timeEnd('fasterDijkstra');

    console.time('ngraph');
    for (let i = 0; i < ITERATIONS; i++) {
      let rnd1 = Math.floor(Math.random() * adj_length);
      let rnd2 = Math.floor(Math.random() * adj_length);
      getNGraphDist(pathFinder.find(adj_keys[rnd1], adj_keys[rnd2]));
    }
    console.timeEnd('ngraph');

    console.time('ContractionHierarchy');
    for (let i = 0; i < ITERATIONS; i++) {
      let rnd1 = Math.floor(Math.random() * new_adj_length);
      let rnd2 = Math.floor(Math.random() * new_adj_length);
      queryContractionHierarchy(
        new_adj,
        new_edge,
        new_adj_keys[rnd1],
        new_adj_keys[rnd2],
        '_cost',
        node_rank,
        id_list
      );
    }
    console.timeEnd('ContractionHierarchy');

  }, 3000);
}
