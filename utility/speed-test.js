const fs = require('fs').promises;
const new_adj = require('../networks/ch.json');
const new_edge = require('../networks/ne.json');
const node_rank = require('../networks/nr.json');

// load arcFlag output
const arc_adj = require('../arc_flag_output/adj_list.json');
const arc_edge = require('../arc_flag_output/edge_hash.json');
const arc_region_lookup = require('../arc_flag_output/pt_region_lookup');

// load traditional dijkstra and utilities
const { runDijkstra } = require('../js/dijkstra.js');

// load standard bidirectional dijkstra
const { runBiDijkstra } = require('../js/bidirectional-dijkstra.js');

// load utility functions
const { toAdjacencyList, toEdgeHash, toIdList } = require('../js/common.js');

const {
  queryContractionHierarchy
} = require('../js/run-contraction-hierarchy');

// load arcFlags dijkstra
const { runArcFlagsDijkstra } = require('../js/arc-flags-dijkstra');

const ITERATIONS = 10000;

main();

async function main() {
  const geojson_raw = await fs.readFile('../networks/full_network.geojson'); // full_network

  const geojson = JSON.parse(geojson_raw);

  geojson.features = geojson.features.filter(feat => {
    if (feat.properties.MILES && feat.geometry.coordinates && feat.properties.STFIPS === 6) {
      return true;
    }
  });

  const adjacency = toAdjacencyList(geojson);

  const edge_list = toEdgeHash(geojson);
  const id_list = toIdList(geojson);

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
        'MILES'
      );
    }
    console.timeEnd('Dijkstra');

    console.time('BiDijkstra');
    for (let i = 0; i < ITERATIONS; i++) {
      let rnd1 = Math.floor(Math.random() * adj_length);
      let rnd2 = Math.floor(Math.random() * adj_length);
      runBiDijkstra(
        adjacency,
        edge_list,
        adj_keys[rnd1],
        adj_keys[rnd2],
        'MILES'
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
        'MILES',
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
        'MILES',
        arc_region_lookup
      );
    }
    console.timeEnd('ArcFlags');
  }, 3000);
}
