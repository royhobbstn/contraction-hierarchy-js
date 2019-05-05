const { readyNetwork, cleanseNetwork } = require('./common.js');
const oldContractGraph = require('./build-contraction-hierarchy.js').contractGraph;





main();

async function main() {

  const geofile = await readyNetwork();
  const geojson = cleanseNetwork(geofile);

  // old
  oldContractGraph(geojson, { cost_field: '_cost' });

}
