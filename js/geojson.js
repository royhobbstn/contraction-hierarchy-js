const clone = require('nanoclone');

exports.loadFromGeoJson = function(filedata) {

  if (this._locked) {
    throw new Error('Cannot add GeoJSON to a contracted network');
  }

  if (this._geoJsonFlag) {
    throw new Error('Cannot load more than one GeoJSON file.');
  }

  if (this._manualAdd) {
    throw new Error('Cannot load GeoJSON file after adding Edges manually via the API.');
  }


  // make a copy
  const geo = clone(filedata);

  // cleans geojson (mutates in place)
  const features = this._cleanseGeoJsonNetwork(geo);

  features.forEach((feature, index) => {
    const coordinates = feature.geometry.coordinates;
    const properties = feature.properties;

    if (!properties || !coordinates || !properties._cost) {
      if (this.debugMode) {
        console.log('invalid feature detected.  skipping...');
      }
      return;
    }

    const start_vertex = coordinates[0];
    const end_vertex = coordinates[coordinates.length - 1];

    // add forward
    this._addEdge(start_vertex, end_vertex, properties, clone(coordinates));

    // add backward
    this._addEdge(end_vertex, start_vertex, properties, clone(coordinates).reverse());

  });

  // after loading a GeoJSON, no further edges can be added
  this._geoJsonFlag = true;


};


exports._cleanseGeoJsonNetwork = function(file) {

  // get rid of duplicate edges (same origin to dest)
  const inventory = {};

  const features = file.features;

  features.forEach(feature => {
    const start = feature.geometry.coordinates[0].join(',');
    const end = feature.geometry.coordinates[feature.geometry.coordinates.length - 1].join(',');
    const id = `${start}|${end}`;

    const reverse_id = `${end}|${start}`;


    if (!inventory[id]) {
      // new segment
      inventory[id] = feature;
    }
    else {

      if (this.debugMode) {
        console.log('Duplicate feature found, choosing shortest.');
      }

      // a segment with the same origin/dest exists.  choose shortest.
      const old_cost = inventory[id].properties._cost;
      const new_cost = feature.properties._cost;
      if (new_cost < old_cost) {
        // mark old segment for deletion
        inventory[id].properties.__markDelete = true;
        // rewrite old segment because this one is shorter
        inventory[id] = feature;
      }
      else {
        // instead mark new feature for deletion
        feature.properties.__markDelete = true;
      }
    }


    // now reverse
    if (!inventory[reverse_id]) {
      // new segment
      inventory[reverse_id] = feature;
    }
    else {

      // In theory this error is already pointed out in the block above

      // a segment with the same origin/dest exists.  choose shortest.
      const old_cost = inventory[reverse_id].properties._cost;
      const new_cost = feature.properties._cost;
      if (new_cost < old_cost) {
        // mark old segment for deletion
        inventory[reverse_id].properties.__markDelete = true;
        // rewrite old segment because this one is shorter
        inventory[reverse_id] = feature;
      }
      else {
        // instead mark new feature for deletion
        feature.properties.__markDelete = true;
      }
    }
  });

  // filter out marked items
  return features.filter(feature => {
    return !feature.properties.__markDelete;
  });

};
