const fs = require('fs').promises;
const new_adj = require('../networks/ch.json');
const new_edge = require('../networks/ne.json');
const node_rank = require('../networks/nr.json');
const createGraph = require('ngraph.graph');
const pathNGraph = require('ngraph.path');

// faster-dijkstra
const G = require('../../faster-dijkstra/index.js').Graph;
const { buildEdgeIdList, buildGeoJsonPath } = require('../../faster-dijkstra/index.js');

// load arcFlag output
const arc_adj = require('../arc_flag_output/adj_list.json');
const arc_edge = require('../arc_flag_output/edge_hash.json');
const arc_region_lookup = require('../arc_flag_output/pt_region_lookup');

// load traditional dijkstra and utilities
const { runDijkstra } = require('../js/dijkstra.js');

// load standard bidirectional dijkstra
const { runBiDijkstra } = require('../js/bidirectional-dijkstra.js');

// load utility functions
const { toAdjacencyList, toEdgeHash, toIdList, readyNetwork, cleanseNetwork, getNGraphDist, populateNGraph } = require('../js/common.js');

const {
  queryContractionHierarchy
} = require('../js/run-contraction-hierarchy');

// load arcFlags dijkstra
const { runArcFlagsDijkstra } = require('../js/arc-flags-dijkstra');


const runDijkstra2 = require("../js/dijkstra-alt.js").runDijkstra;
const toGraph = require("../js/dijkstra-alt.js").toGraph;

const ITERATIONS = 1000;

main();

async function main() {

  const geofile = await readyNetwork();

  const geojson = cleanseNetwork(geofile);

  const graph = toGraph(geojson);

  const fasterDijkstra = new G();
  fasterDijkstra.loadFromGeoJson(geojson);

  const adjacency = toAdjacencyList(geojson);

  const edge_list = toEdgeHash(geojson);
  const id_list = toIdList(geojson);
  const ngraph = createGraph();
  populateNGraph(ngraph, geojson);

  const pathFinder = pathNGraph.aStar(ngraph, {
    distance(fromNode, toNode, link) {
      return link.data._cost;
    }
  });

  setTimeout(function() {
    // performance test
    const adj_keys = Object.keys(adjacency);
    const adj_length = adj_keys.length;
    const new_adj_keys = Object.keys(new_adj);
    const new_adj_length = new_adj_keys.length;
    const arc_adj_keys = Object.keys(arc_adj);
    const arc_adj_length = arc_adj_keys.length;

    console.time('Dijkstra');
    for (let i = 0; i < ITERATIONS; i++) {
      let rnd1 = Math.floor(Math.random() * adj_length);
      let rnd2 = Math.floor(Math.random() * adj_length);
      runDijkstra(
        adjacency,
        edge_list,
        adj_keys[rnd1],
        adj_keys[rnd2],
        '_cost'
      );
    }
    console.timeEnd('Dijkstra');

    console.time('Dijkstra2');
    for (let i = 0; i < ITERATIONS; i++) {
      let rnd1 = Math.floor(Math.random() * adj_length);
      let rnd2 = Math.floor(Math.random() * adj_length);
      runDijkstra2(
        graph,
        adj_keys[rnd1],
        adj_keys[rnd2]
      );
    }
    console.timeEnd('Dijkstra2');

    console.time('fasterDijkstra');
    for (let i = 0; i < ITERATIONS; i++) {
      let rnd1 = Math.floor(Math.random() * adj_length);
      let rnd2 = Math.floor(Math.random() * adj_length);
      fasterDijkstra.runDijkstra(
        adj_keys[rnd1],
        adj_keys[rnd2], [buildEdgeIdList, buildGeoJsonPath]
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

    console.time('BiDijkstra');
    for (let i = 0; i < ITERATIONS; i++) {
      let rnd1 = Math.floor(Math.random() * adj_length);
      let rnd2 = Math.floor(Math.random() * adj_length);
      runBiDijkstra(
        adjacency,
        edge_list,
        adj_keys[rnd1],
        adj_keys[rnd2],
        '_cost'
      );
    }
    console.timeEnd('BiDijkstra');

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

    console.time('ArcFlags');
    for (let i = 0; i < ITERATIONS; i++) {
      let rnd1 = Math.floor(Math.random() * arc_adj_length);
      let rnd2 = Math.floor(Math.random() * arc_adj_length);
      runArcFlagsDijkstra(
        arc_adj,
        arc_edge,
        arc_adj_keys[rnd1],
        arc_adj_keys[rnd2],
        '_cost',
        arc_region_lookup
      );
    }
    console.timeEnd('ArcFlags');
  }, 3000);
}
