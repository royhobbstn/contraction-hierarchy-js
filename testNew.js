// load original geojson-dijkstra for sanity check
const { Graph } = require('geojson-dijkstra');

// load utility functions
const { readyNetwork, cleanseNetwork } = require('./test/test-util.js');

// load contraction hierarchy
const GraphCH = require('./index.js').Graph;

main();

async function main() {

  const geofile = await readyNetwork();
  const geojson = cleanseNetwork(geofile);

  const ogGraph = new Graph(geojson);
  const finderOG = ogGraph.createFinder();

  const graph = new GraphCH(geojson);

  graph.contractGraph();

  const finder = graph.createPathfinder();

  const adj_keys = Object.keys(ogGraph.adjacency_list);
  const adj_length = adj_keys.length;


  const coords = [];

  for (let i = 0; i < 1; i++) {
    const rnd1 = Math.floor(Math.random() * adj_length);
    const rnd2 = Math.floor(Math.random() * adj_length);
    // const coord = [adj_keys[rnd1], adj_keys[rnd2]];
    const coord = ['-122.485382,49.00236', '-117.136591,47.664375'];

    coords.push(coord);
  }

  const ch = [];
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

    console.time('og');
    og[index] = finderOG.findPath((pair[0]), (pair[1])).total_cost;
    console.timeEnd('og');

    console.time('ch');
    ch[index] = finder.queryContractionHierarchy(pair[0], pair[1]).total_cost;
    console.timeEnd('ch');

  });

  let error_count = 0;
  for (let i = 0; i < coords.length; i++) {
    const values = [
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

    if (true /*max - min > 0.000001*/ ) {
      error_count++;
      console.log(
        i,
        coords[i],
        og[i],
        ch[i]
      );
    }
  }
  console.log(`There were ${error_count} errors.`);
}
