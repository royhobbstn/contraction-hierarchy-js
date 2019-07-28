export const loadCH = function(ch) {
  const parsed = (typeof ch === 'object') ? ch : JSON.parse(ch);
  this._locked = parsed._locked;
  this._geoJsonFlag = parsed._geoJsonFlag;
  this.adjacency_list = parsed.adjacency_list;
  this.reverse_adjacency_list = parsed.reverse_adjacency_list;
  this._nodeToIndexLookup = parsed._nodeToIndexLookup;
  this._edgeProperties = parsed._edgeProperties;
  this._edgeGeometry = parsed._edgeGeometry;
};

export const saveCH = function() {

  if (!this._locked) {
    throw new Error('No sense in saving network before it is contracted.');
  }

  return JSON.stringify({
    _locked: this._locked,
    _geoJsonFlag: this._geoJsonFlag,
    adjacency_list: this.adjacency_list,
    reverse_adjacency_list: this.reverse_adjacency_list,
    _nodeToIndexLookup: this._nodeToIndexLookup,
    _edgeProperties: this._edgeProperties,
    _edgeGeometry: this._edgeGeometry
  });
};
