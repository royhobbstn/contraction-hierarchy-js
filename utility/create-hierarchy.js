const fs = require('fs').promises;
const { contractGraph } = require('../js/build-contraction-hierarchy.js');

main();

async function main() {
  const geojson_raw = await fs.readFile('../networks/full_network.geojson'); // full_network

  const geojson = JSON.parse(geojson_raw);

  geojson.features = geojson.features.filter(feat => {
    if (feat.properties.MILES && feat.geometry.coordinates && feat.properties.STFIPS === 6) {
      return true;
    }
  });

  console.time('contractTime');
  const contracted_graph = contractGraph(geojson, { cost_field: 'MILES' });
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
