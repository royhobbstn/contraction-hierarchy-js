const fs = require('fs').promises;
const Graph = require('node-dijkstra');

// load traditional dijkstra and utilities
const { runDijkstra } = require('../js/dijkstra.js');

// load standard bidirectional dijkstra
const { runBiDijkstra } = require('../js/bidirectional-dijkstra.js');

// load utility functions
const { toAdjacencyList, toEdgeHash, toIdList, readyNetwork, cleanseNetwork } = require('../js/common.js');

// load contraction hierarchy version bidirectional dijkstra
const {
  queryContractionHierarchy
} = require('../js/run-contraction-hierarchy');

// load arcFlags dijkstra
const { runArcFlagsDijkstra } = require('../js/arc-flags-dijkstra');

// load contraction hierarchy output
const new_adj = require('../networks/ch.json');
const new_edge = require('../networks/ne.json');
const node_rank = require('../networks/nr.json');

// load arcFlag output
const arc_adj = require('../arc_flag_output/adj_list.json');
const arc_edge = require('../arc_flag_output/edge_hash.json');
const arc_region_lookup = require('../arc_flag_output/pt_region_lookup');

const runDijkstra2 = require("../js/dijkstra-alt.js").runDijkstra;
const toGraph = require("../js/dijkstra-alt.js").toGraph;

main();

async function main() {

  const geofile = await readyNetwork();

  const geojson = cleanseNetwork(geofile);

  const alt_graph = createDijkstraJsGraph(geojson, 'MILES');

  const adjacency = toAdjacencyList(geojson);
  const edge_list = toEdgeHash(geojson);
  const id_list = toIdList(geojson);

  const adj_keys = Object.keys(adjacency);
  const adj_length = adj_keys.length;

  const graph = toGraph(geojson);

  const coords = [];

  for (let i = 0; i < 100; i++) {
    const rnd1 = Math.floor(Math.random() * adj_length);
    const rnd2 = Math.floor(Math.random() * adj_length);
    const coord = [adj_keys[rnd1], adj_keys[rnd2]];
    //const coord = ['-118.277145,34.021101', '-118.332832,34.035054'];
    coords.push(coord);
  }

  const dijkstra = [];
  const dijkstra2 = [];
  const bidirectional = [];
  const ch = [];
  const correct2 = [];
  const af = [];

  const nodeDijkstra = new Graph(alt_graph);

  coords.forEach((pair, index) => {
    process.stdout.write(
      'Processing ' +
      ((index / coords.length) * 100).toFixed(2) +
      '% complete... ' +
      index +
      '  ' +
      pair +
      '                 \r\n'
    );
    console.log('----');

    console.time('Dijkstra');
    dijkstra[index] = runDijkstra(
      adjacency,
      edge_list,
      pair[0],
      pair[1],
      'MILES'
    );
    console.timeEnd('Dijkstra');

    console.time('Dijkstra2');
    dijkstra2[index] = runDijkstra2(
      graph,
      pair[0],
      pair[1]
    );
    console.timeEnd('Dijkstra2');

    console.time('Bidirectional');
    bidirectional[index] = runBiDijkstra(
      adjacency,
      edge_list,
      pair[0],
      pair[1],
      'MILES'
    );
    console.timeEnd('Bidirectional');

    console.time('ch');
    ch[index] = queryContractionHierarchy(
      new_adj,
      new_edge,
      pair[0],
      pair[1],
      'MILES',
      node_rank,
      id_list
    );
    console.timeEnd('ch');

    console.time('control 2');
    correct2[index] = toCorrectPath2(
      nodeDijkstra,
      edge_list,
      pair[0],
      pair[1],
      'MILES'
    );
    console.timeEnd('control 2');

    console.time('arc flags');
    af[index] = runArcFlagsDijkstra(
      arc_adj,
      arc_edge,
      pair[0],
      pair[1],
      'MILES',
      arc_region_lookup
    );
    console.timeEnd('arc flags');

  });

  let error_count = 0;
  for (let i = 0; i < coords.length; i++) {
    const values = [
      dijkstra[i].distance,
      dijkstra2[i].distance,
      bidirectional[i].distance,
      ch[i].distance,
      correct2[i].distance,
      af[i].distance
    ];

    let min = Infinity;
    let max = -Infinity;

    values.forEach(val => {
      if (val < min) {
        min = val;
      }
      if (val > max) {
        max = val;
      }
    });

    if (max - min > 0.000001) {
      error_count++;
      console.log(
        i,
        coords[i],
        dijkstra[i].segments.length,
        dijkstra[i].distance.toFixed(5),
        dijkstra2[i].segments.length,
        dijkstra2[i].distance.toFixed(5),
        bidirectional[i].segments.length,
        bidirectional[i].distance.toFixed(5),
        ch[i].segments.length,
        ch[i].distance.toFixed(5),
        correct2[i].segments.length,
        correct2[i].distance.toFixed(5),
        af[i].segments.length,
        af[i].distance.toFixed(5)
      );
    }
  }
  console.log(`There were ${error_count} errors.`);

}

function createDijkstraJsGraph(geojson, cost_field) {
  const graph = {};
  geojson.features.forEach((f, i) => {
    if (!geojson.features[i + 1]) {
      return;
    }
    if (!f.geometry.coordinates) {
      console.log('ERROR: no coordinates on feature');
      return;
    }
    const start = f.geometry.coordinates[0].join(',');
    const end = f.geometry.coordinates[f.geometry.coordinates.length - 1].join(
      ','
    );

    const cost = f.properties[cost_field];
    if (!cost) {
      console.log('ERROR: no cost');
      return;
    }
    if (!graph[start]) {
      graph[start] = {};
    }
    if (!graph[end]) {
      graph[end] = {};
    }
    graph[start][end] = cost;
    graph[end][start] = cost;
  });
  return graph;
}

function toCorrectPath2(graph, edge_list, start, end, cost_field) {
  const path = graph.path(start, end, { cost: true }).path;

  const geojson_features = [];
  let distance = 0;
  const segments = [];

  if (start !== end) {
    path.forEach((node, i) => {
      if (!path[i + 1]) {
        return;
      }
      const feature = edge_list[`${node}|${path[i + 1]}`];
      if (!feature) {
        console.log('ERROR: No edge feature found');
        return;
      }
      geojson_features.push(feature);
      distance += feature.properties[cost_field];
      segments.push(feature.properties.ID);
    });
  }

  const route = {
    type: 'FeatureCollection',
    features: geojson_features
  };

  return { distance, segments, route };
}
