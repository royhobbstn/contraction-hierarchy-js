const createGraph = require('ngraph.graph');
const pathNGraph = require('ngraph.path');
const fs = require('fs');

// load utility functions
const { getNGraphDist, populateNGraph, readyNetwork, cleanseNetwork } = require('./test-util.js');

// load contraction hierarchy
const GraphCH = require('../index.js').Graph;

main();

async function main() {

  const geofile = await readyNetwork();
  const geojson = cleanseNetwork(geofile);

  // uncomment this block to re - run contraction / save
  const cgraph = new GraphCH(null, { debugMode: true });

  const points_set = new Set();

  geojson.features.forEach(feature => {
    const start = String(feature.geometry.coordinates[0]);
    const end = String(feature.geometry.coordinates[feature.geometry.coordinates.length - 1]);
    points_set.add(start);
    points_set.add(end);
    cgraph.addEdge(start, end, feature.properties, null, true);
  });

  const coordinate_list = [];

  points_set.forEach(pt_str => {
    coordinate_list.push(pt_str.split(',').map(d => Number(d)));
  });

  fs.writeFileSync('./net_coordinates.json', JSON.stringify(coordinate_list), 'utf8');
  process.exit();

  console.time('TimeToContract');
  cgraph.contractGraph();
  console.timeEnd('TimeToContract');
  cgraph.savePbfCH('./net.pbf');
  // fs.writeFileSync('./net.json', cgraph.saveCH(), 'utf8');
  process.exit();


  const graph = new GraphCH(null, { debugMode: true });
  const data = fs.readFileSync('./net.json', 'utf8');
  graph.loadCH(data);


  const finder = graph.createPathfinder({ ids: true, path: true });

  const adj_keys = Object.keys(graph._nodeToIndexLookup);
  const adj_length = adj_keys.length;

  const ngraph = createGraph();
  populateNGraph(ngraph, geojson);

  const pathFinder = pathNGraph.aStar(ngraph, {
    distance(fromNode, toNode, link) {
      return link.data._cost;
    },
    // oriented: true
  });


  const coords = [];

  for (let i = 0; i < 1000; i++) {
    const rnd1 = Math.floor(Math.random() * adj_length);
    const rnd2 = Math.floor(Math.random() * adj_length);
    const coord = [adj_keys[rnd1], adj_keys[rnd2]];
    // const coord = ['-121.844376,39.73822', '-121.51242,38.495649'];
    coords.push(coord);
  }

  const ch = [];
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

    console.time('nGraph');
    ng[index] = getNGraphDist(pathFinder.find(pair[0], pair[1])).distance;
    console.timeEnd('nGraph');

    console.time('ch');
    ch[index] = finder.queryContractionHierarchy(pair[0], pair[1]).total_cost;
    console.timeEnd('ch');

  });

  let error_count = 0;
  for (let i = 0; i < coords.length; i++) {
    const values = [
      ng[i],
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
        ch[i]
      );
    }
  }
  console.log(`There were ${error_count} errors.`);
}
