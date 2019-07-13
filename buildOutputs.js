exports.buildIdList = buildIdList;

function buildIdList(options, properties, geometry, forward_nodeState, backward_nodeState, tentative_shortest_node, startNode) {

  const path = [];

  let current_forward_node = forward_nodeState[tentative_shortest_node];
  let current_backward_node = backward_nodeState[tentative_shortest_node];

  // first check necessary because may not be any nodes in forward or backward path
  // (occasionally entire path may be ONLY in the backward or forward directions)
  if (current_forward_node) {
    while (current_forward_node.attrs) {
      path.push({ id: current_forward_node.attrs, direction: 'f' });
      current_forward_node = forward_nodeState[current_forward_node.prev];
    }
  }

  path.reverse();

  if (current_backward_node) {
    while (current_backward_node.attrs) {
      path.push({ id: current_backward_node.attrs, direction: 'b' });
      current_backward_node = backward_nodeState[current_backward_node.prev];
    }
  }

  let node = startNode;

  const ordered = path.map(p => {
    const start = p.direction === 'f' ? properties[p.id]._start_index : properties[p.id]._end_index;
    const end = p.direction === 'f' ? properties[p.id]._end_index : properties[p.id]._start_index;
    const props = [...properties[p.id]._ordered];

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

  const ids = flattened.map(d => properties[d]._id);

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

  if (options.path) {
    const ret = { ids, path: { "type": "FeatureCollection", "features": features } };
    // console.log({ path: JSON.stringify(ret.path) })
    return ret;
  }
  else {
    return { ids };
  }

}
