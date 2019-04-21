const createGraph = require('ngraph.graph');
const pathNGraph = require('ngraph.path');

const { Graph, buildEdgeIdList, buildGeoJsonPath } = require('geojson-dijkstra');

// load utility functions
const { toAdjacencyList, toIdList, readyNetwork, cleanseNetwork, getNGraphDist, populateNGraph } = require('./common.js');

// load contraction hierarchy version bidirectional dijkstra
const {
  queryContractionHierarchy
} = require('./run-contraction-hierarchy');

// load contraction hierarchy output
const new_adj = require('./networks/ch.json');
const new_edge = require('./networks/ne.json');
const node_rank = require('./networks/nr.json');


main();

async function main() {

  const geofile = await readyNetwork();

  const geojson = cleanseNetwork(geofile);

  const adjacency = toAdjacencyList(geojson);
  const id_list = toIdList(geojson);
  const ngraph = createGraph();
  populateNGraph(ngraph, geojson);

  const pathFinder = pathNGraph.aStar(ngraph, {
    distance(fromNode, toNode, link) {
      return link.data._cost;
    }
  });


  const adj_keys = Object.keys(adjacency);
  const adj_length = adj_keys.length;


  const fasterDijkstra = new Graph();
  fasterDijkstra.loadFromGeoJson(geojson);

  const coords = [];
  const coordmatch = [];

  for (let i = 0; i < 100; i++) {
    const rnd1 = Math.floor(Math.random() * adj_length);
    const rnd2 = Math.floor(Math.random() * adj_length);
    const coord = [adj_keys[rnd1], adj_keys[rnd2]];
    const coord_match = [adj_keys[rnd1].split(',').map(d => Number(d)), adj_keys[rnd2].split(',').map(d => Number(d))];
    // const coord = ['-121.606712,39.75233', '-121.687492,39.494369'];
    coords.push(coord);
    coordmatch.push(coord_match);
  }

  const ch = [];
  const fd = [];
  const ng = [];


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

    console.time('fasterDijkstra');
    fd[index] = fasterDijkstra.findPath(
      coordmatch[index][0],
      coordmatch[index][1], [buildEdgeIdList, buildGeoJsonPath]
    );
    console.timeEnd('fasterDijkstra');

    console.time('nGraph');
    ng[index] = getNGraphDist(pathFinder.find(pair[0], pair[1]));
    console.timeEnd('nGraph');

    console.time('ch');
    ch[index] = queryContractionHierarchy(
      new_adj,
      new_edge,
      pair[0],
      pair[1],
      '_cost',
      node_rank,
      id_list
    );
    console.timeEnd('ch');

  });

  let error_count = 0;
  for (let i = 0; i < coords.length; i++) {
    const values = [
      fd[i].total_cost,
      ng[i].distance,
      ch[i].distance,
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
        fd[i].edge_list.length,
        fd[i].total_cost.toFixed(5),
        ng[i].edgelist.length,
        ng[i].distance.toFixed(5),
        ch[i].segments.length,
        ch[i].distance.toFixed(5)
      );
    }
  }
  console.log(`There were ${error_count} errors.`);
}
