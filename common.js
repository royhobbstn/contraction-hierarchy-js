//
const fs = require('fs').promises;

exports.toBestRoute = toBestRoute;
exports.getComparator = getComparator;
exports.toEdgeHash = toEdgeHash;
exports.toAdjacencyList = toAdjacencyList;
exports.toIdList = toIdList;
exports.readyNetwork = readyNetwork;
exports.cleanseNetwork = cleanseNetwork;
exports.getNGraphDist = getNGraphDist;
exports.populateNGraph = populateNGraph;

async function readyNetwork() {

  const geojson_raw = await fs.readFile('./networks/faf.geojson'); // full_network
  const geojson = JSON.parse(geojson_raw);


  // set up cost field
  geojson.features.forEach(feat => {
    const mph = getMPH(feat.properties.NHS);
    feat.properties._cost = (feat.properties.MILES / 60) * mph;
    feat.properties._id = feat.properties.ID;
  });

  // clean network
  geojson.features = geojson.features.filter(feat => {
    if (feat.properties._cost && feat.geometry.coordinates &&
      (feat.properties.STFIPS === 6 || feat.properties.STFIPS === 41 || feat.properties.STFIPS === 53)) {
      return true;
    }
  });
  console.log(geojson.features.length)

  return geojson;
}

function getMPH(nhs) {
  switch (nhs) {
    case 1:
      return 70;
    case 2:
      return 60;
    case 3:
      return 50;
    case 4:
      return 40;
    case 7:
      return 30;
    case 8:
      return 20;
    default:
      return 10;
  }
}

function cleanseNetwork(geojson) {

  // get rid of duplicate edges (same origin to dest)
  const inventory = {};
  geojson.features.forEach(feature => {
    const start = feature.geometry.coordinates[0].join(',');
    const end = feature.geometry.coordinates[feature.geometry.coordinates.length - 1].join(',');
    const id = `${start}|${end}`;

    const reverse_id = `${end}|${start}`;

    if (!feature.properties._direction || feature.properties._direction === 'all' || feature.properties._direction === 'f') {

      if (!inventory[id]) {
        // new segment
        inventory[id] = feature;
      }
      else {
        // a segment with the same origin/dest exists.  choose shortest.
        const old_cost = inventory[id].properties._cost;
        const new_cost = feature.properties._forward_cost || feature.properties._cost;
        if (new_cost < old_cost) {
          // mark old segment for deletion
          inventory[id].properties.__markDelete = true;
          // rewrite old segment because this one is shorter
          inventory[id] = feature;
        }
        else {
          // instead mark new feature for deletion
          feature.properties.__markDelete = true;
        }
      }

    }

    if (!feature.properties._direction || feature.properties._direction === 'all' || feature.properties._direction === 'b') {
      // now reverse
      if (!inventory[reverse_id]) {
        // new segment
        inventory[reverse_id] = feature;
      }
      else {
        // a segment with the same origin/dest exists.  choose shortest.
        const old_cost = inventory[reverse_id].properties._cost;
        const new_cost = feature.properties._backward_cost || feature.properties._cost;
        if (new_cost < old_cost) {
          // mark old segment for deletion
          inventory[reverse_id].properties.__markDelete = true;
          // rewrite old segment because this one is shorter
          inventory[reverse_id] = feature;
        }
        else {
          // instead mark new feature for deletion
          feature.properties.__markDelete = true;
        }
      }
    }

  });


  // filter out marked items
  geojson.features = geojson.features.filter(feature => {
    return !feature.properties.__markDelete;
  });

  return geojson;
}

function toIdList(geojson) {
  const obj = {};

  geojson.features.forEach(feature => {
    obj[feature.properties.ID] = feature;
  });

  return obj;
}

function toAdjacencyList(geo) {
  const features = Array.isArray(geo) ? geo : geo.features;

  const adjacency_list = {};

  features.forEach(feature => {
    const coordinates = feature.geometry.coordinates;
    if (!coordinates) {
      return;
    }
    if (!feature.properties) {
      console.log('no features adj');
      return;
    }
    if (!feature.properties._cost) {
      console.log('NO _cost adj');
      return;
    }
    const start_vertex = coordinates[0].join(',');
    const end_vertex = coordinates[coordinates.length - 1].join(',');

    if (!adjacency_list[start_vertex]) {
      adjacency_list[start_vertex] = [end_vertex];
    }
    else {
      adjacency_list[start_vertex].push(end_vertex);
    }

    if (!adjacency_list[end_vertex]) {
      adjacency_list[end_vertex] = [start_vertex];
    }
    else {
      adjacency_list[end_vertex].push(start_vertex);
    }
  });

  return adjacency_list;
}

function toEdgeHash(geo) {
  const features = Array.isArray(geo) ? geo : geo.features;

  const edge_hash = {};

  features.forEach(feature => {
    const coordinates = feature.geometry.coordinates;
    if (!coordinates) {
      console.log('No Coords eh');
      return;
    }
    if (!feature.properties._cost) {
      console.log('NO _cost eh');
    }
    const start_vertex = coordinates[0].join(',');
    const end_vertex = coordinates[coordinates.length - 1].join(',');

    edge_hash[`${start_vertex}|${end_vertex}`] = feature;
    edge_hash[`${end_vertex}|${start_vertex}`] = feature;
  });

  return edge_hash;
}

function toBestRoute(end_pt, prev, edge_hash) {
  const features = [];

  while (prev[end_pt]) {
    features.push(edge_hash[`${end_pt}|${prev[end_pt]}`]);
    end_pt = prev[end_pt];
  }

  return {
    type: 'FeatureCollection',
    features: features
  };
}

function getComparator(dist_node) {
  // excessive check necessary to distinguish undefined from 0
  // (dist[node] can on rare circumstances be 'start')
  if (dist_node === 0) {
    return 0;
  }
  if (dist_node === undefined) {
    return Infinity;
  }

  return dist_node;
}



function populateNGraph(ngraph, geojson) {

  geojson.features.forEach(feature => {
    const start = feature.geometry.coordinates[0];
    const end = feature.geometry.coordinates[feature.geometry.coordinates.length - 1];
    const properties = Object.assign({}, feature.properties, { _geometry: feature.geometry.coordinates });

    ngraph.addNode(String(start), { lng: start[0], lat: start[1] });
    ngraph.addNode(String(end), { lng: end[0], lat: end[1] });
    ngraph.addLink(String(start), String(end), properties);
    ngraph.addLink(String(end), String(start), properties);
  });

}

function getNGraphDist(path) {
  const edge_ids = [];
  let distance = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const start_node = path[i].id;
    const end_node = path[i + 1].id;
    path[i]['links'].forEach(link => {
      if ((link.fromId === start_node && link.toId === end_node)) {
        edge_ids.push(link.data.ID);
        distance += link.data._cost;
      }
    });
  }

  return { edgelist: edge_ids.reverse(), distance };
}
