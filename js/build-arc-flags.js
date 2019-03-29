//

const fs = require('fs').promises;
const turf = require('@turf/turf');
const dissolve = require('geojson-dissolve');
const geojsonRbush = require('geojson-rbush').default;
const { runArcFlagsDijkstra } = require('./arc-flags-dijkstra.js');
const { clustersKmeans } = require('./turf-kmeans-mod.js');
const { toAdjacencyList, toEdgeHash } = require('./common.js');

const NUMBER_OF_REGIONS = 20;

main();

async function main() {
  //
  const geojson_raw = await fs.readFile('../networks/full_network.geojson');
  const geojson = JSON.parse(geojson_raw);

  const pts = new Set();

  // clean geojson of missing coordinates and no cost field TODO MILES hardcoded
  geojson.features = geojson.features.filter(feature => {
    return (
      feature.geometry &&
      feature.geometry.coordinates &&
      feature.geometry.coordinates.length &&
      feature.properties.MILES
    );
  });

  // mutate coordinate precision to 5 decimal places
  geojson.features.forEach(feature => {
    const length = feature.geometry.coordinates.length;
    feature.geometry.coordinates[0] = feature.geometry.coordinates[0].map(d =>
      Number(d.toFixed(5))
    );
    feature.geometry.coordinates[length - 1] = feature.geometry.coordinates[
      length - 1
    ].map(d => Number(d.toFixed(5)));
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

  const pt_feature_collection = {
    type: 'FeatureCollection',
    features: point_collection
  };

  const clustered = clustersKmeans(pt_feature_collection, {
    numberOfClusters: NUMBER_OF_REGIONS
  });

  await fs.writeFile(
    '../arc_flag_output/clustered_points.geojson',
    JSON.stringify(clustered),
    'utf8'
  );

  // create lookup, pt to region
  // and list of pts per region

  const pt_region_lookup = {};
  const region_list = {};
  clustered.features.forEach(f => {
    const region = f.properties.cluster;
    const pt = f.properties.pt;
    pt_region_lookup[f.properties.pt] = region;
    if (!region_list[region]) {
      region_list[region] = [pt];
    } else {
      region_list[region].push(pt);
    }
  });

  await fs.writeFile(
    '../arc_flag_output/pt_region_lookup.json',
    JSON.stringify(pt_region_lookup),
    'utf8'
  );

  await fs.writeFile(
    '../arc_flag_output/region_list.json',
    JSON.stringify(region_list),
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

  const converted_lines = [];

  dissolved_regions.forEach(region => {
    converted_lines.push(turf.polygonToLine(region).features[0]);
  });

  const lines = {
    type: 'FeatureCollection',
    features: converted_lines
  };

  await fs.writeFile(
    '../arc_flag_output/region_lines.geojson',
    JSON.stringify(lines),
    'utf8'
  );

  // chunk apart lines!
  const chunk_lines = turf.lineChunk(lines, 15, { units: 'miles' });

  await fs.writeFile(
    '../arc_flag_output/chunk_region_lines.geojson',
    JSON.stringify(chunk_lines),
    'utf8'
  );

  // index geojson linestrings
  const tree = geojsonRbush();
  tree.load(geojson);

  const boundary_points = new Set();

  // find intersecting arcs & boundary points
  chunk_lines.features.forEach(line => {
    // find closest linestrings
    const results = tree.search(line);

    // boolean check to see if intersection
    results.features.forEach(result => {
      const intersects = turf.lineIntersect(result, line);
      // if true, add end points to boundary_pt_list
      if (intersects.features.length) {
        boundary_points.add(result.geometry.coordinates[0].join(','));
        boundary_points.add(
          result.geometry.coordinates[
            result.geometry.coordinates.length - 1
          ].join(',')
        );
      }
    });
  });

  // convert boundary points to geojson
  const boundary_pt_geojson = [];

  boundary_points.forEach(pt => {
    boundary_pt_geojson.push({
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

  const boundary_pt_collection = {
    type: 'FeatureCollection',
    features: boundary_pt_geojson
  };

  await fs.writeFile(
    '../arc_flag_output/boundary_pt_collection.geojson',
    JSON.stringify(boundary_pt_collection),
    'utf8'
  );

  // tag points with polygons
  const tagged = turf.tag(
    boundary_pt_collection,
    dissolved_regions_collection,
    'region',
    'region'
  );

  await fs.writeFile(
    '../arc_flag_output/tagged_boundary_pts.geojson',
    JSON.stringify(tagged),
    'utf8'
  );

  // create a set of boundary points for each region
  const boundary_pt_set = {};
  tagged.features.forEach(pt => {
    const region = pt.properties.region;
    const point = pt.properties.pt;
    if (!boundary_pt_set[region]) {
      boundary_pt_set[region] = [point];
    } else {
      boundary_pt_set[region].push(point);
    }
  });

  await fs.writeFile(
    '../arc_flag_output/boundary_pt_set.geojson',
    JSON.stringify(boundary_pt_set),
    'utf8'
  );

  // TODO build miniature version
  process.exit();

  // initialize arc flags on edge hash
  Object.keys(edge_hash).forEach(key => {
    edge_hash[key].properties.arcFlags = Array(NUMBER_OF_REGIONS).fill(0);
  });

  // assign arc flags
  Object.keys(boundary_pt_set).forEach(region => {
    console.log(region);
    boundary_pt_set[region].forEach((pt, i) => {
      console.log(i / boundary_pt_set[region].length);
      const prev = runArcFlagsDijkstra(adj_list, edge_hash, pt, 'MILES');
      //
      Array.from(pts).forEach((p, i) => {
        while (prev[p]) {
          edge_hash[`${p}|${prev[p]}`].properties.arcFlags[region] = 1;
          p = prev[p];
        }
      });
      //
    });
  });

  await fs.writeFile(
    '../arc_flag_output/edge_hash.geojson',
    JSON.stringify(edge_hash),
    'utf8'
  );

  await fs.writeFile(
    '../arc_flag_output/adj_list.geojson',
    JSON.stringify(adj_list),
    'utf8'
  );
}
