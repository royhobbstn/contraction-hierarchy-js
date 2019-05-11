//
const NodeHeap = require('../geojson-dijkstra/queue.js');

exports.contractGraph = contractGraph;

// node containing contraction order score
function OrderNode(score, id) {
  this.score = score;
  this.id = id;
}

function createReverseAdjList(graph) {

  // create a reverse adjacency list
  const reverse_adj = {};

  Object.keys(graph.adjacency_list).forEach(node => {
    graph.adjacency_list[node].forEach(edge => {
      // reverse obj
      const reverse_obj = {
        start: edge.end,
        end: edge.start,
        start_lat: edge.end_lat,
        start_lng: edge.end_lng,
        end_lat: edge.start_lat,
        end_lng: edge.start_lng,
        cost: edge.cost,
        lookup_index: edge.lookup_index
        // reverse_flag:?
      };
      // add reversed obj to reverse adj list
      if (!reverse_adj[reverse_obj.start]) {
        reverse_adj[reverse_obj.start] = [reverse_obj];
      }
      else {
        reverse_adj[reverse_obj.start].push(reverse_obj);
      }

    });

  });

  return reverse_adj;
}

function contractGraph(graph) {

  const reverse_adj = createReverseAdjList(graph);

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
  Object.keys(graph.adjacency_list).forEach(node => {
    const from_rank = contracted_nodes[node];
    graph.adjacency_list[node] = graph.adjacency_list[node].filter(
      to_coords => {
        const to_rank = contracted_nodes[to_coords.end];
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

    const from_connections = (reverse_adj[v] || []).filter(c => {
      return !contracted_nodes[c.end];
    });

    const to_connections = (graph.adjacency_list[v] || []).filter(c => {
      return !contracted_nodes[c.end];
    });


    let shortcut_count = 0;

    // TODO from
    to_connections.forEach(u => {

      let max_total = 0;

      // dist u to v
      const dist1 = u.cost;

      to_connections.forEach(w => {

        // ignore node to itself
        if (u.end === w.end) {
          return;
        }

        // dist v to w
        const dist2 = w.cost;

        const total = dist1 + dist2;

        if (total > max_total) {
          max_total = total;
        }
      });

      const path = runDijkstra(
        graph, u.end,
        null,
        v,
        max_total
      );

      to_connections.forEach(w => {
        // ignore node
        if (u.end === w.end) {
          return;
        }

        // dist v to w
        const dist2 = w.cost;
        const total = dist1 + dist2;

        const dijkstra = path.distances[w.end] || Infinity;

        // Infinity does happen - what are the consequences
        if (total < dijkstra) {

          shortcut_count++;

          if (!get_count_only) {

            const seg1 = u.lookup_index;

            const seg2 = w.lookup_index;

            const attrs = {
              _cost: total,
              _id: `${graph.properties[seg1]._id},${graph.properties[seg2]._id}`
            };

            const s = u.end.split(',').map(d => Number(d));
            const e = w.end.split(',').map(d => Number(d));

            graph.addEdge(s, e, attrs, true);

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

    // TODO problem???? heuristic on by default
    while (current) {

      graph.adjacency_list[current.id]
        .filter(edge => {
          // this is a modification for contraction hierarchy
          // otherwise vertex===undefined
          return edge.end !== vertex;
        })
        .forEach(edge => {

          let node = nodeState.get(edge.end);
          if (node === undefined) {
            node = graph.pool.createNewState({ id: edge.end });
            nodeState.set(edge.end, node);
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
      if (current && (current.id === end)) {
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
