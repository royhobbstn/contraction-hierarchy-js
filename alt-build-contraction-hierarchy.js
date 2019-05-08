//
let debug = false;

const NodeHeap = require('../geojson-dijkstra/queue.js');

exports.contractGraph = contractGraph;

// node containing contraction order score
function OrderNode(score, id) {
  this.score = score;
  this.id = id;
}

function contractGraph(graph) {
  const nh = new NodeHeap(null, { rank: 'score' });

  const contraction_order_nodes = {};
  const contracted_nodes = {};

  // create an additional node ordering
  Object.keys(graph.adjacency_list).forEach(vertex => {
    const score = getVertexScore(vertex);
    const node = new OrderNode(score, vertex);
    nh.push(node);
    contraction_order_nodes[vertex] = node;
  });

  function getVertexScore(v) {
    const shortcut_count = contract(v, true);
    // console.log({ v, shortcut_count })
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

  // console.log({ contraction_order_nodes });

  let contraction_level = 1;

  // main contraction loop
  while (nh.length > 0) {

    // recompute to make sure that first node in priority queue
    // is still best candidate to contract
    let found_lowest = false;
    let node_obj = nh.peek();
    const old_score = node_obj.score;

    do {
      const first_vertex = node_obj.id;
      const new_score = getVertexScore(first_vertex);
      if (new_score > old_score) {
        node_obj.score = new_score;
        nh.updateItem(node_obj.heapIndex);
      }
      node_obj = nh.peek();
      if (node_obj.id === first_vertex) {
        found_lowest = true;
      }
    } while (found_lowest === false);

    // lowest found, pop it off the queue and contract it
    const v = nh.pop();

    contract(v.id, false);

    // keep a record of contraction level of each node
    contracted_nodes[v.id] = contraction_level;
    contraction_level++;

  }

  // remove links to lower ranked nodes
  // TODO we may not need to do more than this
  Object.keys(graph.adjacency_list).forEach(node => {
    const from_rank = contracted_nodes[node];
    graph.adjacency_list[node] = graph.adjacency_list[node].filter(
      to_coords => {
        const to_rank = contracted_nodes[to_coords];
        return from_rank < to_rank;
      }
    );
  });

  // this was returning an adjacency list, edge list, and list of contracted nodes
  // but now, we can just store the contracted nodes on the graph
  // and return nothing

  graph.contracted_nodes = contracted_nodes;

  return;

  // this function is multi-use:  actually contract a node  OR
  // with `get_count_only = true` find number of shortcuts added
  // if node were to be contracted

  function contract(v, get_count_only) {

    if (!get_count_only && debug) {
      console.log('-------------------------------------');
      console.log('contract: ' + v);
    }

    const from_connections = (graph.rev_adjacency_list[v] || []).filter(c => {
      return !contracted_nodes[c];
    });
    const to_connections = (graph.adjacency_list[v] || []).filter(c => {
      return !contracted_nodes[c];
    });

    // console.log({ from_connections, to_connections })


    let shortcut_count = 0;


    from_connections.forEach(u => {

      let max_total = 0;

      // dist u to v
      const uv_path = graph.paths[`${u}|${v}`];
      const uv_lookup = uv_path.lookup_index;
      const uv_start_lng = uv_path.start_lng;
      const uv_start_lat = uv_path.start_lat;
      const dist1 = graph.properties[uv_lookup]._cost;

      to_connections.forEach(w => {
        // ignore node to itself
        if (u === w) {
          return;
        }

        // dist v to w
        const vw_lookup = graph.paths[`${v}|${w}`].lookup_index;
        const dist2 = graph.properties[vw_lookup]._cost;

        const total = dist1 + dist2;

        if (total > max_total) {
          max_total = total;
        }
      });

      const path = runDijkstra(
        graph, [uv_start_lng, uv_start_lat],
        null,
        v,
        max_total
      );

      to_connections.forEach(w => {
        // ignore node
        if (u === w) {
          return;
        }

        // dist v to w
        const vw_lookup = graph.paths[`${v}|${w}`].lookup_index;
        const dist2 = graph.properties[vw_lookup]._cost;
        const total = dist1 + dist2;

        const dijkstra = path.distances[w] || Infinity;

        // Infinity does happen - what are the consequences
        if (!get_count_only && debug) {
          console.log({ u, w, v });
          console.log({ path: path.distances[w] });
          console.log({ total });
          console.log({ dijkstra });
        }

        if (total < dijkstra) {
          if (!get_count_only && debug) {
            console.log('shortcut !');
          }

          shortcut_count++;


          if (!get_count_only) {

            const seg1 = graph.paths[`${u}|${v}`].lookup_index;
            const seg2 = graph.paths[`${v}|${w}`].lookup_index;

            const attrs = {
              _cost: total,
              _id: `${graph.properties[seg1]._id},${graph.properties[seg2]._id}`
            };

            graph.addEdge(u.split(',').map(d => Number(d)), w.split(',').map(d => Number(d)), attrs, true);

          }
        }
      });

    });

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

    const nodeState = new Map();

    const distances = {};

    var openSet = new NodeHeap(null, { rank: 'dist' });

    let current = graph.pool.createNewState({ id: str_start, dist: 0 });
    nodeState.set(str_start, current);
    current.opened = 1;
    distances[current.id] = 0;

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
          return edge !== vertex;
        })
        .forEach(exploring_node => {

          const edge = graph.paths[`${current.id}|${exploring_node}`];

          let node = nodeState.get(exploring_node);
          if (node === undefined) {
            node = graph.pool.createNewState({ id: exploring_node });
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
            return;
          }

          node.dist = proposed_distance;
          distances[node.id] = proposed_distance;
          node.prev = current.id;

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