const clone = require('@turf/clone').default;


exports.buildIdList = buildIdList;

function buildIdList(options, properties, geometry, forward_nodeState, backward_nodeState, tentative_shortest_node, startNode) {
  console.time('iterate')

  const path = [];

  let current_forward_node = forward_nodeState[tentative_shortest_node];
  let current_backward_node = backward_nodeState[tentative_shortest_node];

  // first check necessary because may not be any nodes in forward or backward path
  // (occasionally entire path may be ONLY in the backward or forward directions)
  if (current_forward_node) {
    while (current_forward_node.attrs) {
      path.push(current_forward_node.attrs);
      current_forward_node = forward_nodeState[current_forward_node.prev];
    }
  }

  path.reverse();

  if (current_backward_node) {
    while (current_backward_node.attrs) {
      path.push(current_backward_node.attrs);
      current_backward_node = backward_nodeState[current_backward_node.prev];
    }
  }
  console.timeEnd('iterate')

  console.time('order')

  let node = startNode;

  const ordered = path.map(p => {
    const start = properties[p]._start_index;
    const end = properties[p]._end_index;
    const props = [...properties[p]._ordered];

    if (node !== start) {
      props.reverse();
      node = start;
    }
    else {
      node = end;
    }

    return props;
  });
  console.timeEnd('order')


  console.time('flatten')

  const flattened = [].concat(...ordered);
  console.timeEnd('flatten')


  console.time('mapgeo')

  const features = flattened.map(f => {

    return {
      "type": "Feature",
      "properties": properties[f],
      "geometry": {
        "type": "LineString",
        "coordinates": geometry[f]
      }
    };

  });

  console.timeEnd('mapgeo')



  if (options.path) {
    console.time('detangle')
    const ret = { ids: flattened, path: /*detangle*/ ({ "type": "FeatureCollection", "features": features }) };

    // console.log(JSON.stringify(ret.path))
    console.timeEnd('detangle')
    return ret;
  }
  else {
    return { ids: flattened };
  }

}


function detangle(geo) {

  // ------ de-tangle routine
  // aligns start and end coordinate of each geojson linestring segment

  // copy source to avoid mutation
  const features = clone(geo).features;

  const collection = {
    type: "FeatureCollection",
    features: features
  };

  // if only one feature return
  if (features.length <= 1) {
    return collection;
  }

  // modify first feature
  const cf = features[0];
  const nf = features[1];

  const ce = cf.geometry.coordinates[cf.geometry.coordinates.length - 1];

  const ns = nf.geometry.coordinates[0];
  const ne = nf.geometry.coordinates[nf.geometry.coordinates.length - 1];

  // in case of ce !== ns && ce !== ne. (flip first feature)

  // ce === ns
  const ce_ns = ce[0] === ns[0] && ce[1] === ns[1];
  // ce === ne
  const ce_ne = ce[0] === ne[0] && ce[1] === ne[1];

  if (!ce_ns && !ce_ne) {
    features[0].geometry.coordinates.reverse();
  }

  // modify rest of the features to match orientation of the first
  for (let i = 1; i < features.length; i++) {
    const lastFeature = features[i - 1];
    const currentFeature = features[i];

    const last_end = lastFeature.geometry.coordinates[lastFeature.geometry.coordinates.length - 1];
    const current_end = currentFeature.geometry.coordinates[currentFeature.geometry.coordinates.length - 1];

    // in the case of last_end == current_end  (flip this)
    const le_ce = last_end[0] === current_end[0] && last_end[1] === current_end[1];

    if (le_ce) {
      currentFeature.geometry.coordinates.reverse();
    }

  }

  return collection;
}
