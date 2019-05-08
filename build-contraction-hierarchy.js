//
let debug = false;

const FibonacciHeap = require('@tyriar/fibonacci-heap').FibonacciHeap;

const { toAdjacencyList, toEdgeHash, getComparator } = require('./common.js');

exports.contractGraph = contractGraph;

function contractGraph(geojson, options) {
  const cost_field = '_cost'; // options.cost_field

  const adjacency_list = toAdjacencyList(geojson);
  const edge_hash = toEdgeHash(geojson);

  const bh = new FibonacciHeap();
  const key_to_nodes = {};

  const ih = new FibonacciHeap();
  const key_to_nodes_extra = {};

  const contracted_nodes = {};

  // create an additional node ordering
  Object.keys(adjacency_list).forEach((vertex, i) => {
    const score = getVertexScore(vertex);
    key_to_nodes[vertex] = bh.insert(score, vertex);
    key_to_nodes_extra[vertex] = ih.insert(score, vertex);
  });

  function getVertexScore(v) {
    const shortcut_count = contract(v, true);
    // console.log({ v, shortcut_count })

    const edge_count = adjacency_list[v].length;
    const edge_difference = shortcut_count - edge_count;
    const contracted_neighbors = getContractedNeighborCount(v);
    return edge_difference + contracted_neighbors;
  }

  function getContractedNeighborCount(v) {
    return adjacency_list[v].reduce((acc, node) => {
      const is_contracted = contracted_nodes[node] ? 1 : 0;
      return acc + is_contracted;
    }, 0);
  }

  // console.log({ key_to_nodes });

  let contraction_level = 1;

  // main contraction loop
  while (bh.size() > 0) {

    // console.time('loop');
    // recompute to make sure that first node in priority queue
    // is still best candidate to contract
    let found_lowest = false;
    let node_obj = bh.findMinimum();

    const old_score = node_obj.key;

    // console.time('doWhile');
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
    // console.timeEnd('doWhile');

    // lowest found, pop it off the queue and contract it
    const v = bh.extractMinimum();
    // console.time('innerLoop');
    contract(v.value, false);
    // console.timeEnd('innerLoop');
    // keep a record of contraction level of each node
    contracted_nodes[v.value] = contraction_level;
    contraction_level++;

    // console.timeEnd('loop');
  }

  // remove links to lower ranked nodes
  Object.keys(adjacency_list).forEach(from_coords => {
    const from_rank = contracted_nodes[from_coords];
    adjacency_list[from_coords] = adjacency_list[from_coords].filter(
      to_coords => {
        const to_rank = contracted_nodes[to_coords];
        return from_rank < to_rank;
      }
    );
  });

  return [adjacency_list, edge_hash, contracted_nodes];

  // this function is multi-use:  actually contract a node  OR
  // with `get_count_only = true` find number of shortcuts added
  // if node were to be contracted
  function contract(v, get_count_only) {

    if (!get_count_only && debug) {
      console.log('-------------------------------------');
      console.log('contract: ' + v);
    }

    const connections = adjacency_list[v].filter(c => {
      return !contracted_nodes[c];
    });

    // console.log({ connections })

    let shortcut_count = 0;

    connections.forEach(u => {

      let max_total = 0;

      // dist u to v
      const dist1 = edge_hash[`${u}|${v}`].properties[cost_field];

      connections.forEach(w => {

        // ignore node to itself
        if (u === w) {
          return;
        }

        // dist v to w
        const dist2 = edge_hash[`${v}|${w}`].properties[cost_field];
        const total = dist1 + dist2;

        if (total > max_total) {
          max_total = total;
        }
      });

      const path = runDijkstra(
        adjacency_list,
        edge_hash,
        u,
        null,
        cost_field,
        v,
        max_total
      );

      connections.forEach(w => {
        // ignore node
        if (u === w) {
          return;
        }

        // dist v to w
        const dist2 = edge_hash[`${v}|${w}`].properties[cost_field];
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

          //console.log({ edge: 'edge', u, w })

          if (!get_count_only) {

            adjacency_list[u].push(w);

            const seg1_id = edge_hash[`${u}|${v}`].properties._id;
            const seg2_id = edge_hash[`${v}|${w}`].properties._id;

            const attrs = {
              [cost_field]: total,
              ID: `${seg1_id},${seg2_id}`
            };


            edge_hash[`${u}|${w}`] = {
              properties: attrs
            };

            edge_hash[`${w}|${u}`] = {
              properties: attrs
            };
          }
        }
      });
    });
    return shortcut_count;
  }

  function runDijkstra(
    adj_list,
    edge_hash,
    start,
    end,
    cost_field,
    vertex,
    total
  ) {

    // quick exit for start === end
    if (start === end) {
      return {
        distance: 0,
        segments: [],
        route: {
          type: 'FeatureCollection',
          features: []
        }
      };
    }

    if (debug) {
      console.log('dij', { start, end, vertex });
    }

    const heap = new FibonacciHeap();
    const key_to_nodes = {};

    const dist = {}; // distances to each node
    const prev = {}; // node to parent_node lookup
    const visited = {}; // node has been fully explored

    let current = start;
    let current_key = 0;
    dist[start] = 0;

    do {

      adj_list[current]
        .filter(node => {
          // maybe not necessary?
          // this is a modification for contraction hierarchy.  otherwise vertex===undefined
          return node !== vertex;
        })
        .forEach(node => {

          if (visited[node]) {
            return;
          }

          const segment_distance =
            edge_hash[`${current}|${node}`].properties[cost_field];
          const proposed_distance = dist[current] + segment_distance;

          if (proposed_distance < getComparator(dist[node])) {
            if (dist[node] !== undefined) {
              heap.decreaseKey(key_to_nodes[node], proposed_distance);
            }
            else {
              key_to_nodes[node] = heap.insert(proposed_distance, node);
            }
            dist[node] = proposed_distance;
            prev[node] = current;
          }
        });
      visited[current] = true;
      const settled_key = current_key;

      // get lowest value from heap
      const elem = heap.extractMinimum();

      if (elem) {
        current = elem.value;
        current_key = elem.key;
      }
      else {
        current = '';
      }

      // exit early if current node becomes end node
      if (current === end) {
        current = '';
      }

      // stopping condition
      if (settled_key > total) {
        current = '';
      }
    } while (current);

    return { distances: dist };
  }
}
