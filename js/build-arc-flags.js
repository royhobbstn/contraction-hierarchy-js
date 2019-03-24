//

const fs = require('fs').promises;
const turf = require('@turf/turf');

const { clustersKmeans } = require('./turf-kmeans-mod.js');

main();

async function main() {
  //
  const geojson_raw = await fs.readFile('../networks/full_network.geojson');
  const geojson = JSON.parse(geojson_raw);

  const pts = new Set();

  geojson.features.forEach((feature, index) => {
    if (!feature.geometry.coordinates.length) {
      console.log(index);
    }
    const start = feature.geometry.coordinates[0].join(',');
    const end = feature.geometry.coordinates[
      feature.geometry.coordinates.length - 1
    ].join(',');
    pts.add(start);
    pts.add(end);
  });

  const point_collection = [];

  pts.forEach(pt => {
    point_collection.push({
      type: 'Feature',
      properties: {
        pt
      },
      geometry: {
        type: 'Point',
        coordinates: pt.split(',').map(d => Number(d))
      }
    });
  });

  const pt_feature_collection = {
    type: 'FeatureCollection',
    features: point_collection
  };

  const clustered = clustersKmeans(pt_feature_collection, {
    numberOfClusters: 10
  });

  for (let i = 75110; i < 75120; i++) {
    console.log(clustered.features[i]);
  }

  await fs.writeFile(
    '../arc_flag_output/clustered_points.geojson',
    JSON.stringify(clustered),
    'utf8'
  );

  for (let i = 75110; i < 75120; i++) {
    console.log(clustered[i]);
  }

  const voronoi = turf.voronoi(clustered);

  // console.log(voronoi.features[voronoi.features.length - 1]);

  voronoi.features = voronoi.features.slice(75110, 75120);

  await fs.writeFile(
    '../arc_flag_output/voronoi_regions.geojson',
    JSON.stringify(voronoi),
    'utf8'
  );
}
