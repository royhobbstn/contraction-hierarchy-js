//

exports.toBestRoute = toBestRoute;
exports.getComparator = getComparator;
exports.toEdgeHash = toEdgeHash;
exports.toAdjacencyList = toAdjacencyList;
exports.toIdList = toIdList;

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
    if (!feature.properties.MILES) {
      console.log('NO MILES adj');
      return;
    }
    const start_vertex = coordinates[0].join(',');
    const end_vertex = coordinates[coordinates.length - 1].join(',');

    if (!adjacency_list[start_vertex]) {
      adjacency_list[start_vertex] = [end_vertex];
    } else {
      adjacency_list[start_vertex].push(end_vertex);
    }

    if (!adjacency_list[end_vertex]) {
      adjacency_list[end_vertex] = [start_vertex];
    } else {
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
    if (!feature.properties.MILES) {
      console.log('NO MILES eh');
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
