//

const fs = require('fs').promises;
const turf = require('@turf/turf');
const dissolve = require('geojson-dissolve');

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
    const start = feature.geometry.coordinates[0]
      .map(d => d.toFixed(5))
      .join(',');
    const end = feature.geometry.coordinates[
      feature.geometry.coordinates.length - 1
    ]
      .map(d => d.toFixed(5))
      .join(',');
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

  await fs.writeFile(
    '../arc_flag_output/clustered_points.geojson',
    JSON.stringify(clustered),
    'utf8'
  );

  const voronoi = turf.voronoi(pt_feature_collection);

  await fs.writeFile(
    '../arc_flag_output/voronoi_regions.geojson',
    JSON.stringify(voronoi),
    'utf8'
  );

  const collected = turf.collect(voronoi, clustered, 'cluster', 'cluster');

  // because 'cluster' is an array
  collected.features.forEach(f => {
    f.properties.cluster = f.properties.cluster[0];
  });

  await fs.writeFile(
    '../arc_flag_output/collected_regions.geojson',
    JSON.stringify(collected),
    'utf8'
  );

  // this is a manual dissolve routine
  const dissolved_regions = [];

  const dissolved = {};

  collected.features.forEach(feature => {
    const key = feature.properties.cluster;
    if (dissolved[key]) {
      dissolved[key].push(feature);
    } else {
      dissolved[key] = [feature];
    }
  });

  Object.keys(dissolved).forEach(key => {
    dissolved_regions.push({
      type: 'Feature',
      properties: { region: key },
      geometry: dissolve(dissolved[key])
    });
  });

  const dissolved_regions_collection = {
    type: 'FeatureCollection',
    features: dissolved_regions
  };

  await fs.writeFile(
    '../arc_flag_output/dissolved_regions.geojson',
    JSON.stringify(dissolved_regions_collection),
    'utf8'
  );
}
