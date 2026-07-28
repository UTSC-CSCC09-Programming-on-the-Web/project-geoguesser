// map object to be displayed
let guessMap;
// current guess = {lat, lng}
let currentGuess = null;
// marker for guess on map
let guessMarker;
let gameplayEnabled = false;

window.addEventListener("geoguesser-access-changed", (event) => {
  gameplayEnabled = event.detail.canPlay;
});

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
  if (!gameplayEnabled) {
    return;
  }

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
  if (!gameplayEnabled) {
    throw new Error("Gameplay is locked until your subscription is active.");
  }

  if (!currentGuess) {
    throw new Error("Please guess on the map before submitting");
  } else {
    console.log("Guess submitted: ", currentGuess);

    // calculate distance between guess and actual location
    fetch("/streetview/calculate-distance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageId: window.currentImageId,
        guessLat: currentGuess.lat,
        guessLng: currentGuess.lng,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((payload) => {
            throw new Error(
              payload.message ||
                payload.error ||
                "Unable to calculate distance.",
            );
          });
        }
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

const aiReviewButton = document.querySelector("#aiReviewButton");
aiReviewButton.addEventListener("click", async () => {
  if (!gameplayEnabled) {
    throw new Error("Gameplay is locked until your subscription is active.");
  }

  if (!window.imageId) {
    throw new Error("No streetview image loaded yet.");
  }

  const response = await fetch("/streetview/ai-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // sending imageId as string to ensure ID is preserved (int might overflow)
    body: JSON.stringify({ imageId: String(3812153535576812) }),
  });

  const aiReview = await response.json();

  if (!response.ok) {
    throw new Error(
      aiReview.message ||
        aiReview.error ||
        "Request to /streetview/ai-review failed.",
    );
  } else {
    console.log(aiReview.review);
  }
});
