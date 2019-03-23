const fs = require('fs').promises;
const new_adj = require('../networks/ch.json');
const new_edge = require('../networks/ne.json');
const node_rank = require('../networks/nr.json');

// load traditional dijkstra and utilities
const { runDijkstra } = require('../js/dijkstra.js');

// load standard bidirectional dijkstra
const { runBiDijkstra } = require('../js/bidirectional-dijkstra.js');

// load utility functions
const { toAdjacencyList, toEdgeHash, toIdList } = require('../js/common.js');

const {
  queryContractionHierarchy
} = require('../js/run-contraction-hierarchy');

main();

async function main() {
  const geojson_raw = await fs.readFile('../networks/full_network.geojson'); // full_network

  const geojson = JSON.parse(geojson_raw);

  geojson.features = geojson.features.filter(feat => {
    if (feat.properties.MILES && feat.geometry.coordinates) {
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
    //
    // console.time('Dijkstra');
    // for (let i = 0; i < 100; i++) {
    //   let rnd1 = Math.floor(Math.random() * adj_length);
    //   let rnd2 = Math.floor(Math.random() * adj_length);
    //   // console.time('test: ' + i);
    //   // console.log(adj_keys[rnd1], adj_keys[rnd2]);
    //   const test = runDijkstra(
    //     adjacency,
    //     edge_list,
    //     adj_keys[rnd1],
    //     adj_keys[rnd2],
    //     'MILES'
    //   );
    //   // console.timeEnd('test: ' + i);
    // }
    // console.timeEnd('Dijkstra');
    //
    // console.time('BiDijkstra');
    // for (let i = 0; i < 100; i++) {
    //   let rnd1 = Math.floor(Math.random() * adj_length);
    //   let rnd2 = Math.floor(Math.random() * adj_length);
    //   // console.log();
    //   // console.time('test: ' + i);
    //   // console.log(adj_keys[rnd1], adj_keys[rnd2]);
    //   const test = runBiDijkstra(
    //     adjacency,
    //     edge_list,
    //     adj_keys[rnd1],
    //     adj_keys[rnd2],
    //     'MILES'
    //   );
    //   // console.timeEnd('test: ' + i);
    // }
    // console.timeEnd('BiDijkstra');

    console.time('ContractionHierarchy');
    for (let i = 0; i < 100; i++) {
      let rnd1 = Math.floor(Math.random() * new_adj_length);
      let rnd2 = Math.floor(Math.random() * new_adj_length);
      console.time('test: ' + i);
      console.log(adj_keys[rnd1], adj_keys[rnd2]);
      const test = queryContractionHierarchy(
        new_adj,
        new_edge,
        new_adj_keys[rnd1],
        new_adj_keys[rnd2],
        'MILES',
        node_rank,
        id_list
      );
      console.timeEnd('test: ' + i);
    }
    console.timeEnd('ContractionHierarchy');
  }, 3000);
}
