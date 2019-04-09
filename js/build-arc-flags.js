//

const fs = require('fs').promises;
const { runArcFlagsDijkstraPreProcess } = require('./arc-flags-dijkstra.js');
const { clustersKmeans } = require('./turf-kmeans-mod.js');
const { toAdjacencyList, toEdgeHash, readyNetwork, cleanseNetwork } = require('./common.js');

const NUMBER_OF_REGIONS = 500;
const COST_FIELD = '_cost';

main();

async function main() {

  const geofile = await readyNetwork();

  const geojson = cleanseNetwork(geofile);

  const pts = new Set();

  // clean geojson of missing coordinates and no cost field
  geojson.features = geojson.features.filter(feature => {
    return (
      feature.geometry &&
      feature.geometry.coordinates &&
      feature.geometry.coordinates.length &&
      feature.properties[COST_FIELD] && feature.properties.STFIPS === 6
    );
  });

  // add stringified coordinates to master list
  geojson.features.forEach(feature => {
    const start = feature.geometry.coordinates[0].join(',');
    const end = feature.geometry.coordinates[
      feature.geometry.coordinates.length - 1
    ].join(',');

    pts.add(start);
    pts.add(end);
  });

  const adj_list = toAdjacencyList(geojson);
  const edge_hash = toEdgeHash(geojson);

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

  console.log(point_collection.length);

  const pt_feature_collection = {
    type: 'FeatureCollection',
    features: point_collection
  };

  // TODO do away with the geojson wrapper altogether?
  const clustered = clustersKmeans(pt_feature_collection, {
    numberOfClusters: NUMBER_OF_REGIONS
  });

  await fs.writeFile(
    '../arc_flag_output/clustered_points.geojson',
    JSON.stringify(clustered),
    'utf8'
  );

  // create lookup, pt to region
  const pt_region_lookup = {};
  clustered.features.forEach(f => {
    pt_region_lookup[f.properties.pt] = f.properties.cluster;
  });

  await fs.writeFile(
    '../arc_flag_output/pt_region_lookup.json',
    JSON.stringify(pt_region_lookup),
    'utf8'
  );

  // create a set of boundary points for each region
  const boundary_pt_set = {};
  geojson.features.forEach(f => {
    //
    const start = f.geometry.coordinates[0].join(',');
    const length = f.geometry.coordinates.length;
    const end = f.geometry.coordinates[length - 1].join(',');

    const start_region = pt_region_lookup[start];
    const end_region = pt_region_lookup[end];

    // detect if boundary arc
    if (start_region !== end_region) {
      // add boundary points to appropriate region
      if (!boundary_pt_set[start_region]) {
        boundary_pt_set[start_region] = [start];
      }
      else {
        boundary_pt_set[start_region].push(start);
      }
      if (!boundary_pt_set[end_region]) {
        boundary_pt_set[end_region] = [end];
      }
      else {
        boundary_pt_set[end_region].push(end);
      }
    }
  });

  await fs.writeFile(
    '../arc_flag_output/boundary_pt_set.json',
    JSON.stringify(boundary_pt_set),
    'utf8'
  );

  // initialize arc flags on edge hash
  Object.keys(edge_hash).forEach(key => {
    edge_hash[key].properties.arcFlags = Array(NUMBER_OF_REGIONS).fill(0);
    const pts = key.split('|');
    const start_region = pt_region_lookup[pts[0]];
    const end_region = pt_region_lookup[pts[1]];
    edge_hash[key].properties.arcFlags[start_region] = 1;
    edge_hash[key].properties.arcFlags[end_region] = 1;
  });

  // assign arc flags
  Object.keys(boundary_pt_set).forEach(region => {
    console.log('region: ' + region);
    const region_pts = boundary_pt_set[region].length;
    console.log(` boundary pts: ${region_pts}`);
    let count = 0;
    boundary_pt_set[region].forEach(pt => {
      if (count % 10 === 0) {
        console.log((count / region_pts) * 100);
      }
      count++;

      const prev = runArcFlagsDijkstraPreProcess(
        adj_list,
        edge_hash,
        pt,
        COST_FIELD
      );
      //

      Object.keys(pt_region_lookup).forEach(p => {
        if (pt_region_lookup[p] === region) {
          return;
        }
        while (prev[p]) {
          //edge_hash[`${prev[p]}|${p}`].properties.arcFlags[region] = 1;
          edge_hash[`${p}|${prev[p]}`].properties.arcFlags[region] = 1;
          p = prev[p];
        }
        //
      });

    });
  });

  await fs.writeFile(
    '../arc_flag_output/edge_hash.json',
    JSON.stringify(edge_hash),
    'utf8'
  );

  await fs.writeFile(
    '../arc_flag_output/adj_list.json',
    JSON.stringify(adj_list),
    'utf8'
  );
}
