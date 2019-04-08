const fs = require('fs').promises;
const { runDijkstra, toGraph } = require('./dijkstra-alt.js');


main();

async function main() {
  const geojson_raw = await fs.readFile('../networks/full_network.geojson'); // full_network

  const geojson = JSON.parse(geojson_raw);

  // set up cost field
  geojson.features.forEach(feat => {
    feat.properties._cost = feat.properties.MILES;
  });

  const graph = toGraph(geojson);

  const adj_keys = Object.keys(graph.lookup);
  const adj_length = adj_keys.length;

  console.time('Dijkstra');
  for (let i = 0; i < 1; i++) {
    let rnd1 = Math.floor(Math.random() * adj_length);
    let rnd2 = Math.floor(Math.random() * adj_length);
    runDijkstra(
      graph,
      adj_keys[rnd1],
      adj_keys[rnd2]
    );
  }
  console.timeEnd('Dijkstra');


}
