const fs = require('fs');

var Pbf = require('pbf');
var Structure = require('./structure.js').ContractionHierarchy;

const netfile = JSON.parse(fs.readFileSync('./net.json', 'utf8'));

console.log(JSON.stringify(netfile).length);

// convert to protobuf compatible

netfile.adjacency_list = netfile.adjacency_list.map(list => {
  return {
    edges: list.map(edge => {
      return edge;
    })
  };
});

netfile.reverse_adjacency_list = netfile.reverse_adjacency_list.map(list => {
  return {
    edges: list.map(edge => {
      return edge;
    })
  };
});

netfile._edgeGeometry = netfile._edgeGeometry.map(linestring => {
  return {
    linestrings: linestring.map(coords => {
      return { coords };
    })
  };
});

console.log(JSON.stringify(netfile.adjacency_list));


// write
var pbf = new Pbf();
Structure.write(netfile, pbf);
var buffer = pbf.finish();

fs.writeFileSync('./binary.bs', buffer, null);

// read
var readpbf = new Pbf(buffer);
var obj = Structure.read(readpbf);


// back to graph compatible

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


console.log(JSON.stringify(obj).length);
