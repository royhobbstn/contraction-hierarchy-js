//

// using the naive, lower pre-processing technique and only consider boundary edges
// we can make up the difference later by subdividing each region further (maybe?)

const fs = require('fs').promises;

const adj_list = require('./adj_list');
const boundary_pt_set = require('./boundary_pt_set');
const edge_hash = require('./edge_hash');
const pt_region_lookup = require('./pt_region_lookup');

const {
  runArcFlagsDijkstraPreProcess,
  runArcFlagsDijkstra
} = require('../js/arc-flags-dijkstra.js');

const NUMBER_OF_REGIONS = Object.keys(boundary_pt_set).length;
const COST_FIELD = 'cost';

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
        COST_FIELD
      );
      //
      Object.keys(boundary_pt_set).forEach(reg => {
        boundary_pt_set[reg].forEach(p => {
          if (region === reg) {
            // dont bother setting arcflags within same region
            return;
          }
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
    COST_FIELD,
    pt_region_lookup
  );

  console.log(result);
}
