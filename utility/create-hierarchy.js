const fs = require('fs').promises;
const { contractGraph } = require('../js/build-contraction-hierarchy.js');
const { readyNetwork, cleanseNetwork } = require('../js/common.js');

main();

async function main() {

  const geofile = await readyNetwork();

  const geojson = cleanseNetwork(geofile);


  console.time('contractTime');
  const contracted_graph = contractGraph(geojson, { cost_field: '_cost' });
  console.timeEnd('contractTime');

  await fs.writeFile(
    '../networks/ch.json',
    JSON.stringify(contracted_graph[0]),
    'utf8'
  );
  await fs.writeFile(
    '../networks/ne.json',
    JSON.stringify(contracted_graph[1]),
    'utf8'
  );
  await fs.writeFile(
    '../networks/nr.json',
    JSON.stringify(contracted_graph[2]),
    'utf8'
  );
}
