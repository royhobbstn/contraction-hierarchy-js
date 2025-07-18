// Helper function to reconstruct complete node sequence from edges
function reconstructNodesFromEdges(edgeList, edgeProperties, indexToNodeLookup, startNodeIndex) {
  if (edgeList.length === 0) {
    return [indexToNodeLookup[startNodeIndex]];
  }
  
  const nodeSequence = [];
  let currentNode = startNodeIndex;
  
  // Add starting node
  nodeSequence.push(indexToNodeLookup[currentNode]);
  
  // Traverse edges to build complete node sequence
  for (const edgeIndex of edgeList) {
    const edge = edgeProperties[edgeIndex];
    
    // Determine which direction we're traversing this edge
    if (currentNode === edge._start_index) {
      // Going from start to end
      currentNode = edge._end_index;
    } else if (currentNode === edge._end_index) {
      // Going from end to start
      currentNode = edge._start_index;
    } else {
      // Edge doesn't connect to current node - this shouldn't happen in a valid path
      // but we'll handle it gracefully by using the edge's start node
      currentNode = edge._end_index;
    }
    
    nodeSequence.push(indexToNodeLookup[currentNode]);
  }
  
  return nodeSequence;
}

export function buildIdList(options, edgeProperties, edgeGeometry, forward_nodeState, backward_nodeState, tentative_shortest_node, indexToNodeLookup, startNode) {

  const pathway = [];
  const node_list = [tentative_shortest_node];

  let current_forward_node = forward_nodeState[tentative_shortest_node];
  let current_backward_node = backward_nodeState[tentative_shortest_node];

  // first check necessary because may not be any nodes in forward or backward pathway
  // (occasionally entire pathway may be ONLY in the backward or forward directions)
  if (current_forward_node) {
    while (current_forward_node.attrs != null) {
      pathway.push({ id: current_forward_node.attrs, direction: 'f' });
      node_list.push(current_forward_node.prev);
      current_forward_node = forward_nodeState[current_forward_node.prev];
    }
  }

  pathway.reverse();
  node_list.reverse();

  if (current_backward_node) {
    while (current_backward_node.attrs != null) {
      pathway.push({ id: current_backward_node.attrs, direction: 'b' });
      node_list.push(current_backward_node.prev);
      current_backward_node = backward_nodeState[current_backward_node.prev];
    }
  }

  let node = startNode;

  const ordered = pathway.map(p => {
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



  let properties, property_list, path, nodes;


  if (options.nodes) {
    // Use edge-based reconstruction to ensure all nodes are included
    nodes = reconstructNodesFromEdges(flattened, edgeProperties, indexToNodeLookup, startNode);
  }


  if (options.properties || options.path) {

    property_list = flattened.map(f => {

      // remove internal properties
      const { _start_index, _end_index, _ordered, ...originalProperties } = edgeProperties[f];

      return originalProperties;

    });

  }


  if (options.path) {

    const features = flattened.map((f, i) => {

      return {
        "type": "Feature",
        "properties": property_list[i],
        "geometry": {
          "type": "LineString",
          "coordinates": edgeGeometry[f]
        }
      };

    });

    path = { "type": "FeatureCollection", "features": features };

  }

  if (options.properties) {
    properties = property_list;
  }

  return { ids, path, properties, nodes };

}
