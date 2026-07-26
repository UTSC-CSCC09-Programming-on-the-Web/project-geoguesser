// map object to be displayed
let guessMap;
// current guess = {lat, lng}
let currentGuess = null;
// marker for guess on map
let guessMarker;

// create guess-map object
document.addEventListener("DOMContentLoaded", () => {
  // create Leaflet map object at #guessMap
  guessMap = L.map("guessMap").setView([43.66, -79.39], 13);

  // add map background to map object
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(guessMap);

  guessMap.on("click", updateGuessClick);
});

function updateGuessClick(event) {
  const lat = event.latlng.lat;
  const lng = event.latlng.lng;

  currentGuess = { lat, lng };

  if (guessMarker) {
    // update guessMarker
    guessMarker.setLatLng([lat, lng]);
  } else {
    // initialize guessMarker and include marker on map
    guessMarker = L.marker([lat, lng]).addTo(guessMap);
  }

  console.log("Current guess: ", currentGuess);
}

// #region submit-guess event listener
const submitGuessButton = document.querySelector("#submitGuessButton");
submitGuessButton.addEventListener("click", (event) => {
  if (!currentGuess) {
    throw new Error("Please guess on the map before submitting");
  } else {
    console.log("Guess submitted: ", currentGuess);

    fetch("/streetview/calculate-distance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guessLat: currentGuess.lat,
        guessLng: currentGuess.lng,
      }),
    })
      .then((res) => {
        return res.json();
      })
      .then((distance) => {
        console.log(
          `The distance between guess and actual location is ${+distance.toFixed(2)} km`,
        );
      });
  }
});
// #endregion

// TODO: need to implement reading the response from /streetview/ai-review
const aiReviewButton = document.querySelector("#aiReviewButton");
aiReviewButton.addEventListener("click", async () => {
  // TODO: currently, imageId is hard-coded, but will need to get the actual imageId displayed later
  const response = await fetch("/streetview/ai-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // sending imageId as string to ensure ID is preserved (int might overflow)
    body: JSON.stringify({ imageId: String(3812153535576812) }),
  });

  const aiReview = await response.json();

  if (!response.ok) {
    throw new Error(`Request to /streetview/ai-review failed.`, aiReview.error);
  } else {
    console.log(aiReview.review);
  }
});
