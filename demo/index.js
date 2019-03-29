//
const fs = require('fs').promises;

const adj_list = require('./adj_list');
const boundary_pt_set = require('./boundary_pt_set');
const edge_hash = require('./edge_hash');
const pt_region_lookup = require('./pt_region_lookup');
const region_list = require('./region_list');

const {
  runArcFlagsDijkstraPreProcess,
  runArcFlagsDijkstra
} = require('../js/arc-flags-dijkstra.js');

const NUMBER_OF_REGIONS = 5;
//

main();

async function main() {
  // initialize arc flags on edge hash
  Object.keys(edge_hash).forEach(key => {
    edge_hash[key].properties.arcFlags = Array(NUMBER_OF_REGIONS).fill(0);
  });

  // assign arc flags
  Object.keys(boundary_pt_set).forEach(region => {
    boundary_pt_set[region].forEach(pt => {
      const prev = runArcFlagsDijkstraPreProcess(
        adj_list,
        edge_hash,
        pt,
        'cost'
      );
      //
      Object.keys(boundary_pt_set).forEach(reg => {
        boundary_pt_set[reg].forEach(p => {
          while (prev[p]) {
            edge_hash[`${p}|${prev[p]}`].properties.arcFlags[region] = 1;
            p = prev[p];
          }
        });
        //
      });
    });
  });

  await fs.writeFile(
    './edge_hash_demo.geojson',
    JSON.stringify(edge_hash),
    'utf8'
  );

  const result = runArcFlagsDijkstra(
    adj_list,
    edge_hash,
    'A',
    'Z',
    'cost',
    pt_region_lookup
  );

  console.log(result);
}

// TODO heres what I think.  use the naive, less pre-processing time and only consider boundary edges
// we can make up the difference later by subdividing each region further
