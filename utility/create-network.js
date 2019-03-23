console.time('programTime');

const fs = require('fs').promises;

const joinAlike = require('geojson-linestring-join-alike');
const snapNearby = require('geojson-network-node-snap');
const splitLines = require('geojson-split-crossing-lines');
const idAreas = require('geojson-id-disconnected-networks');

main();

async function main() {
  console.log('loading raw network geojson file');
  const raw_geo = await fs.readFile('../networks/faf.geojson');

  console.log('filter out ferry routes');
  const intermediate_geo = JSON.parse(raw_geo).features.filter(f => {
    // filter out STATUS = 2 (ferry route)
    return f.properties.STATUS !== 2;
  });

  console.log('snapping nearby single-valency points');
  const new_geo = snapNearby(intermediate_geo, 0.05);

  console.log('joining alike lines');
  const attribute_settings = [
    { field: 'NHS', compare: 'must-equal' },
    { field: 'STFIPS', compare: 'must-equal' },
    { field: 'CTFIPS', compare: 'must-equal' },
    { field: 'SIGN1', compare: 'must-equal' },
    { field: 'SIGN2', compare: 'must-equal' },
    { field: 'SIGN3', compare: 'must-equal' },
    { field: 'ID', compare: 'keep-higher' },
    { field: 'MILES', compare: 'calc-sum' }
  ];
  const reformatted = joinAlike(new_geo, attribute_settings);

  console.log('splitting intersecting lines');
  const crossing_lines = splitLines(reformatted);

  console.log('tagging subnetwork areas');
  const tagged = idAreas(crossing_lines);

  console.log('removing separated subnetworks');
  const filtered_by_tag = tagged.features.filter(f => {
    return f.properties.subnetworkId === 1;
  });

  console.log('assigning new ID field');
  const overwrite_id = filtered_by_tag.map((f, index) => {
    const properties = Object.assign({}, f.properties, { ID: index });
    return Object.assign({}, f, { properties });
  });

  // full network version
  const full = {
    type: 'FeatureCollection',
    features: overwrite_id
  };
  console.log('saving full network as "full_network.geojson"');
  await fs.writeFile(
    '../networks/full_network.geojson',
    JSON.stringify(full),
    'utf8'
  );

  console.timeEnd('programTime');
}
