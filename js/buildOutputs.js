exports.buildIdList = buildIdList;

function buildIdList(options, edgeProperties, edgeGeometry, forward_nodeState, backward_nodeState, tentative_shortest_node, startNode) {

  const path = [];

  let current_forward_node = forward_nodeState[tentative_shortest_node];
  let current_backward_node = backward_nodeState[tentative_shortest_node];

  // first check necessary because may not be any nodes in forward or backward path
  // (occasionally entire path may be ONLY in the backward or forward directions)
  if (current_forward_node) {
    while (current_forward_node.attrs != null) {
      path.push({ id: current_forward_node.attrs, direction: 'f' });
      current_forward_node = forward_nodeState[current_forward_node.prev];
    }
  }

  path.reverse();

  if (current_backward_node) {
    while (current_backward_node.attrs != null) {
      path.push({ id: current_backward_node.attrs, direction: 'b' });
      current_backward_node = backward_nodeState[current_backward_node.prev];
    }
  }

  let node = startNode;

  const ordered = path.map(p => {
    const start = p.direction === 'f' ? edgeProperties[p.id]._start_index : edgeProperties[p.id]._end_index;
    const end = p.direction === 'f' ? edgeProperties[p.id]._end_index : edgeProperties[p.id]._start_index;
    const props = [...edgeProperties[p.id]._ordered];

    if (node !== start) {
      props.reverse();
      node = start;
    }
    else {
      node = end;
    }

    return props;
  });

  const flattened = [].concat(...ordered);

  const ids = flattened.map(d => edgeProperties[d]._id);

  const features = flattened.map(f => {

    // remove internal properties
    const { _start_index, _end_index, _ordered, ...originalProperties } = edgeProperties[f];

    return {
      "type": "Feature",
      "properties": originalProperties,
      "geometry": {
        "type": "LineString",
        "coordinates": edgeGeometry[f]
      }
    };

  });

  if (options.path) {
    const ret = { ids, path: { "type": "FeatureCollection", "features": features } };
    // console.log({ path: JSON.stringify(ret.path) })
    return ret;
  }
  else {
    return { ids };
  }

}
