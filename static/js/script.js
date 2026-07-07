// create map
const map = L.map("guess-map").setView([20, 0], 2);

// add map tiles
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// store user's guess marker
let guessMarker;

map.on("click", function (event) {
  const latitude = event.latlng.lat;
  const longitude = event.latlng.lng;

  // remove old marker
  if (guessMarker) {
    map.removeLayer(guessMarker);
  }

  // add new marker
  guessMarker = L.marker([latitude, longitude]).addTo(map);

  // log the guess
  console.log("Guess:", latitude, longitude);
});
