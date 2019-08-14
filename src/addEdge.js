// public API for adding edges
export const addEdge = function(start, end, edge_properties, edge_geometry, is_undirected) {

  if (this._locked) {
    throw new Error('Graph has been contracted.  No additional edges can be added.');
  }

  if (this._geoJsonFlag) {
    throw new Error('Can not add additional edges manually to a GeoJSON network.');
  }

  this._manualAdd = true;
  this._addEdge(start, end, edge_properties, edge_geometry, is_undirected);
};

export const _addEdge = function(start, end, edge_properties, edge_geometry, is_undirected) {

  const start_node = String(start);
  const end_node = String(end);

  if (start_node === end_node) {
    if (this.debugMode) {
      console.log("Start and End Nodes are the same.  Ignoring.");
    }
    return;
  }

  if (this._nodeToIndexLookup[start_node] == null) {
    this._currentNodeIndex++;
    this._nodeToIndexLookup[start_node] = this._currentNodeIndex;
    this._indexToNodeLookup[this._currentNodeIndex] = start_node;
  }
  if (this._nodeToIndexLookup[end_node] == null) {
    this._currentNodeIndex++;
    this._nodeToIndexLookup[end_node] = this._currentNodeIndex;
    this._indexToNodeLookup[this._currentNodeIndex] = end_node;
  }

  let start_node_index = this._nodeToIndexLookup[start_node];
  let end_node_index = this._nodeToIndexLookup[end_node];

  // add to adjacency list
  this._currentEdgeIndex++;
  this._edgeProperties[this._currentEdgeIndex] = JSON.parse(JSON.stringify(edge_properties));
  this._edgeProperties[this._currentEdgeIndex]._start_index = start_node_index;
  this._edgeProperties[this._currentEdgeIndex]._end_index = end_node_index;

  if (edge_geometry) {
    this._edgeGeometry[this._currentEdgeIndex] = JSON.parse(JSON.stringify(edge_geometry));
  }

  // create object to push into adjacency list
  const obj = {
    end: end_node_index,
    cost: edge_properties._cost,
    attrs: this._currentEdgeIndex
  };

  if (this.adjacency_list[start_node_index]) {
    this.adjacency_list[start_node_index].push(obj);
  }
  else {
    this.adjacency_list[start_node_index] = [obj];
  }

  // add to reverse adjacency list
  const reverse_obj = {
    end: start_node_index,
    cost: edge_properties._cost,
    attrs: this._currentEdgeIndex
  };

  if (this.reverse_adjacency_list[end_node_index]) {
    this.reverse_adjacency_list[end_node_index].push(reverse_obj);
  }
  else {
    this.reverse_adjacency_list[end_node_index] = [reverse_obj];
  }


  // specifying is_undirected=true allows us to save space by not duplicating properties
  if (is_undirected) {
    if (this.adjacency_list[end_node_index]) {
      this.adjacency_list[end_node_index].push(reverse_obj);
    }
    else {
      this.adjacency_list[end_node_index] = [reverse_obj];
    }

    if (this.reverse_adjacency_list[start_node_index]) {
      this.reverse_adjacency_list[start_node_index].push(obj);
    }
    else {
      this.reverse_adjacency_list[start_node_index] = [obj];
    }
  }

};


export const _addContractedEdge = function(start_index, end_index, properties) {

  // geometry not applicable here
  this._currentEdgeIndex++;
  this._edgeProperties[this._currentEdgeIndex] = properties;
  this._edgeProperties[this._currentEdgeIndex]._start_index = start_index;
  this._edgeProperties[this._currentEdgeIndex]._end_index = end_index;

  // create object to push into adjacency list
  const obj = {
    end: end_index,
    cost: properties._cost,
    attrs: this._currentEdgeIndex
  };

  if (this.adjacency_list[start_index]) {
    this.adjacency_list[start_index].push(obj);
  }
  else {
    this.adjacency_list[start_index] = [obj];
  }

  // add it to reverse adjacency list
  const reverse_obj = {
    end: start_index,
    cost: properties._cost,
    attrs: this._currentEdgeIndex
  };

  if (this.reverse_adjacency_list[end_index]) {
    this.reverse_adjacency_list[end_index].push(reverse_obj);
  }
  else {
    this.reverse_adjacency_list[end_index] = [reverse_obj];
  }

};
