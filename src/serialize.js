import { ContractionHierarchy as CH } from './structure.js';
import Pbf from 'pbf';

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


export const loadPbfCH = function(buffer) {

  var readpbf = new Pbf(buffer);
  var obj = CH.read(readpbf);

  // back to graph compatible structure
  obj.adjacency_list = obj.adjacency_list.map(list => {
    return list.edges;
  });

  obj.reverse_adjacency_list = obj.reverse_adjacency_list.map(list => {
    return list.edges;
  });

  obj._edgeGeometry = obj._edgeGeometry.map(l => {
    return l.linestrings.map(c => {
      return c.coords;
    });
  });

  obj._edgeProperties = obj._edgeProperties.map(props => {
    return JSON.parse(props);
  });


  this._locked = obj._locked;
  this._geoJsonFlag = obj._geoJsonFlag;
  this.adjacency_list = obj.adjacency_list;
  this.reverse_adjacency_list = obj.reverse_adjacency_list;
  this._nodeToIndexLookup = obj._nodeToIndexLookup;
  this._edgeProperties = obj._edgeProperties; // TODO... misc user properties
  this._edgeGeometry = obj._edgeGeometry;

  console.log(`done loading pbf`);

};

export const savePbfCH = function(path) {

  if (!this._locked) {
    throw new Error('No sense in saving network before it is contracted.');
  }

  // Check if we're in Node.js environment
  let fs;
  try {
    // Use dynamic import for ES modules
    const fsModule = eval('require')('fs');
    fs = fsModule;
  } catch (e) {
    console.log('saving as PBF only works in NodeJS');
    return;
  }

  const data = {
    _locked: this._locked,
    _geoJsonFlag: this._geoJsonFlag,
    adjacency_list: this.adjacency_list,
    reverse_adjacency_list: this.reverse_adjacency_list,
    _nodeToIndexLookup: this._nodeToIndexLookup,
    _edgeProperties: this._edgeProperties,
    _edgeGeometry: this._edgeGeometry
  };

  // convert to protobuf compatible

  data.adjacency_list = data.adjacency_list.map(list => {
    return {
      edges: list.map(edge => {
        return edge;
      })
    };
  });

  data.reverse_adjacency_list = data.reverse_adjacency_list.map(list => {
    return {
      edges: list.map(edge => {
        return edge;
      })
    };
  });

  data._edgeGeometry = data._edgeGeometry.map(linestring => {
    return {
      linestrings: linestring.map(coords => {
        return { coords };
      })
    };
  });

  // a poor solution.  seek a better way to serialize arbitrary properties
  data._edgeProperties = data._edgeProperties.map(props => {
    return JSON.stringify(props);
  });

  // write
  var pbf = new Pbf();
  CH.write(data, pbf);

  var buffer = pbf.finish();

  fs.writeFileSync(path, buffer, null);

  console.log(`done saving ${path}`);

};
