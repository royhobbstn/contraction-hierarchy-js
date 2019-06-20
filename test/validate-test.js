const createGraph = require('ngraph.graph');
const pathNGraph = require('ngraph.path');
const fs = require('fs');

// load original geojson-dijkstra for sanity check
const { Graph, buildGeoJsonPath, buildEdgeIdList } = require('geojson-dijkstra');

// load utility functions
const { getNGraphDist, populateNGraph, readyNetwork, cleanseNetwork } = require('./test-util.js');

// load contraction hierarchy
const GraphCH = require('../index.js').Graph;

main();

async function main() {

  const geofile = await readyNetwork();
  const geojson = cleanseNetwork(geofile);

  const ogGraph = new Graph(geojson);

  const finderOG = ogGraph.createFinder({ parseOutputFns: [buildGeoJsonPath, buildEdgeIdList] });

  const graph = new GraphCH(geojson);
  graph.contractGraph();

  // const saved = graph.saveCH();

  // fs.writeFileSync('./saved.json', saved, 'utf8');

  // process.exit();

  const finder = graph.createPathfinder({ ids: true, path: true });

  const adj_keys = Object.keys(graph.adjacency_list);
  const adj_length = adj_keys.length;

  const ngraph = createGraph();
  populateNGraph(ngraph, geojson);

  const pathFinder = pathNGraph.aStar(ngraph, {
    distance(fromNode, toNode, link) {
      return link.data._cost;
    },
    oriented: true
  });


  const coords = [];

  for (let i = 0; i < 100; i++) {
    const rnd1 = Math.floor(Math.random() * adj_length);
    const rnd2 = Math.floor(Math.random() * adj_length);
    const coord = [adj_keys[rnd1], adj_keys[rnd2]];
    // const coord = ['-122.368245,45.583623', '-122.601984,45.626598'];
    coords.push(coord);
  }

  const ch = [];
  const ng = [];
  const og = [];


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

    console.time('nGraph');
    ng[index] = getNGraphDist(pathFinder.find(pair[0], pair[1])).distance;
    console.timeEnd('nGraph');

    console.time('og');
    og[index] = finderOG.findPath((pair[0]), (pair[1])).total_cost;
    console.timeEnd('og');

    console.time('ch');
    ch[index] = finder.queryContractionHierarchy(pair[0], pair[1]).total_cost;
    console.timeEnd('ch');

    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`The script uses approximately ${used} MB`);

  });

  let error_count = 0;
  for (let i = 0; i < coords.length; i++) {
    const values = [
      ng[i],
      og[i],
      ch[i]
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
        ng[i],
        og[i],
        ch[i]
      );
    }
  }
  console.log(`There were ${error_count} errors.`);
}
