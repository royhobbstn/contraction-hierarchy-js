//
let debug = false;

const NodeHeap = require('./node_modules/geojson-dijkstra/queue.js');

exports.contractGraph = contractGraph;

// node containing contraction order score
function OrderNode(score, id) {
  this.score = score;
  this.id = id;
}

function contractGraph(graph) {

  const nh = new NodeHeap();

  const contraction_order_nodes = {};
  const contracted_nodes = {};

  // create an additional node ordering
  Object.keys(graph.adjacency_list).forEach(vertex => {
    const score = getVertexScore(vertex);
    const node = new OrderNode(score, vertex);
    contraction_order_nodes[vertex] = nh.push(node);
  });

  function getVertexScore(v) {
    const shortcut_count = contract(v, true);
    const edge_count = graph.adjacency_list[v].length;
    const edge_difference = shortcut_count - edge_count;
    const contracted_neighbors = getContractedNeighborCount(v);
    return edge_difference + contracted_neighbors;
  }

  function getContractedNeighborCount(v) {
    return graph.adjacency_list[v].reduce((acc, node) => {
      const is_contracted = contracted_nodes[node] ? 1 : 0;
      return acc + is_contracted;
    }, 0);
  }

  // TODO, work on initial node ordering
  process.exit();

  let contraction_level = 1;

  // main contraction loop
  while (bh.size() > 0) {

    // recompute to make sure that first node in priority queue
    // is still best candidate to contract
    let found_lowest = false;
    let node_obj = bh.findMinimum();
    const old_score = node_obj.key;

    do {
      const first_vertex = node_obj.value;
      const new_score = getVertexScore(first_vertex);
      if (new_score > old_score) {
        bh.delete(node_obj);
        key_to_nodes[first_vertex] = bh.insert(new_score, first_vertex);
      }
      node_obj = key_to_nodes[first_vertex];
      if (node_obj.value === first_vertex) {
        found_lowest = true;
      }
    } while (found_lowest === false);

    // lowest found, pop it off the queue and contract it
    const v = bh.extractMinimum();

    contract(v.value, false);

    // keep a record of contraction level of each node
    contracted_nodes[v.value] = contraction_level;
    contraction_level++;

  }

  // remove links to lower ranked nodes
  Object.keys(graph.adjacency_list).forEach(from_coords => {
    const from_rank = contracted_nodes[from_coords];
    graph.adjacency_list[from_coords] = graph.adjacency_list[from_coords].filter(
      to_coords => {
        const to_rank = contracted_nodes[to_coords];
        return from_rank < to_rank;
      }
    );
  });

  // TODO this was returning an adjacency list, edge list, and list of contracted nodes
  // but now, we can just store the contracted nodes on the graph
  // and return nothing
  return contracted_nodes;

  // this function is multi-use:  actually contract a node  OR
  // with `get_count_only = true` find number of shortcuts added
  // if node were to be contracted
  function contract(v, get_count_only) {
    if (!get_count_only && debug) {
      console.log('-------------------------------------');
      console.log('contract: ' + v);
    }

    const connections = graph.adjacency_list[v].filter(c => {
      return !contracted_nodes[c];
    });

    let shortcut_count = 0;

    // TODO this will not work for a directed graph
    // seems like youd need to keep track of which
    // nodes go towards other nodes

    connections.forEach(u => {

      let max_total = 0;

      // dist u to v
      // console.log({ v })
      const uv_path = graph.paths[`${u.end}|${v}`];
      const uv_lookup = uv_path.lookup_index;
      const uv_end_lng = uv_path.end_lng;
      const uv_end_lat = uv_path.end_lat;
      // console.log(uv_path)
      const dist1 = graph.properties[uv_lookup]._cost;

      connections.forEach(w => {
        // ignore node to itself
        if (u.end === w.end) {
          return;
        }

        // dist v to w
        const vw_lookup = graph.paths[`${v}|${w.end}`].lookup_index;
        const dist2 = graph.properties[vw_lookup]._cost;

        const total = dist1 + dist2;

        if (total > max_total) {
          max_total = total;
        }
      });

      const path = runDijkstra(
        graph, [uv_end_lng, uv_end_lat],
        null,
        v,
        max_total
      );

      // console.log({ path })

      connections.forEach(w => {
        // ignore node
        if (u.end === w.end) {
          return;
        }

        // dist v to w
        const vw_lookup = graph.paths[`${v}|${w.end}`].lookup_index;
        const dist2 = graph.properties[vw_lookup]._cost;
        const total = dist1 + dist2;

        const dijkstra = path.distances[w.end] || Infinity;

        // Infinity does happen - what are the consequences
        if (!get_count_only && debug) {
          console.log({ u, w, v });
          console.log({ path: path.distances[w.end] });
          console.log({ total });
          console.log({ dijkstra });
        }

        if (total < dijkstra) {
          if (!get_count_only && debug) {
            console.log('shortcut !');
          }

          console.log('shortcut')

          shortcut_count++;

          if (!get_count_only) {
            graph.adjacency_list[u].push(w);

            const seg1_id = edge_hash[`${u}|${v}`].properties.ID;
            const seg2_id = edge_hash[`${v}|${w}`].properties.ID;

            edge_hash[`${u}|${w}`] = {
              properties: {
                _cost: total,
                ID: `${seg1_id},${seg2_id}`
              }
            };

            edge_hash[`${w}|${u}`] = {
              properties: {
                _cost: total,
                ID: `${seg1_id},${seg2_id}`
              }
            };
          }
        }
      });
    });

    // todo shortcut count doesnt work
    // ------
    // console.log(shortcut_count)
    return shortcut_count;
  }

  function runDijkstra(
    graph,
    start,
    end,
    vertex,
    total
  ) {

    graph.pool.reset();

    const str_start = String(start);
    const str_end = String(end);

    const end_lng = end && end[0];
    const end_lat = end && end[1];

    const start_lng = start[0];
    const start_lat = start[1];

    const nodeState = new Map();

    const distances = {};

    var openSet = new NodeHeap();

    let current = graph.pool.createNewState({ id: str_start, dist: 0, start_lat, start_lng, end_lat, end_lng });
    nodeState.set(str_start, current);
    current.opened = 1;
    current.score = 0;

    // quick exit for start === end
    if (str_start === str_end) {
      current = '';
    }

    // TODO problem, heuristic on by default
    while (current) {

      graph.adjacency_list[current.id]
        .filter(edge => {
          // this is a modification for contraction hierarchy
          // otherwise vertex===undefined
          return edge.end !== vertex;
        })
        .forEach(edge => {

          const exploring_node = edge.end;

          let node = nodeState.get(exploring_node);
          if (node === undefined) {
            node = graph.pool.createNewState({ id: exploring_node, start_lat: edge.end_lat, start_lng: edge.end_lng, end_lat, end_lng });
            nodeState.set(exploring_node, node);
          }

          if (node.visited === true) {
            return;
          }

          if (!node.opened) {
            openSet.push(node);
            node.opened = true;
          }

          const proposed_distance = current.dist + edge.cost;
          if (proposed_distance >= node.dist) {
            // longer path
            return;
          }

          node.dist = proposed_distance;
          distances[node.id] = proposed_distance;
          node.prev = current.id;
          node.score = proposed_distance;

          openSet.updateItem(node.heapIndex);
        });

      current.visited = true;
      const settled_amt = current.dist;

      // get lowest value from heap
      current = openSet.pop();

      // exit early if current node becomes end node
      if (current === end) {
        current = '';
      }

      // stopping condition
      if (settled_amt > total) {
        current = '';
      }
    }

    // total cost included by default
    let response = { distances };


    return response;
  }
}
