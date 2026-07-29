"use strict";

// map object to be displayed
let guessMap;
// current guess = {lat, lng}
let currentGuess = null;
// marker for guess on map
let guessMarker;
// holds round data for next round
let pendingRoundData = null;
// variables for displaying result on map
let resultMap;
let resultGuessMarker;
let resultActualMarker;
let resultLine;

// whether gameplay is allowed or not
let gameplayEnabled = false;

window.addEventListener("geoguesser-access-changed", (event) => {
  gameplayEnabled = event.detail.canPlay;
});

// create guess-map object & initialize event-listeners
document.addEventListener("DOMContentLoaded", () => {
  // create Leaflet map object at #guessMap
  guessMap = L.map("guessMap").setView([20, 0], 2);

  // add map background to map object
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(guessMap);

  guessMap.on("click", updateGuessClick);

  document
    .querySelector("#submitGuessButton")
    .addEventListener("click", submitGuess);

  document
    .querySelector("#nextRoundButton")
    .addEventListener("click", goToNextRound);

  document.querySelector("#playAgainBtn").addEventListener("click", playAgain);
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

async function submitGuess() {
  const submitGuessButton = document.querySelector("#submitGuessButton");

  if (!gameplayEnabled) {
    throw new Error("Gameplay is locked until your subscription is active.");
  }

  if (!currentGuess) {
    alert("Please guess on the map before submitting");
    return;
  }
  // change button behaviour after submission
  submitGuessButton.disabled = true;
  submitGuessButton.textContent = "Submitting ...";

  try {
    const response = await fetch(
      `/games/${window.gameId}/rounds/${window.roundId}/guess`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guessLat: currentGuess.lat,
          guessLng: currentGuess.lng,
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to submit guess");
    }

    // store round data for next round
    pendingRoundData = result.newRoundData;

    // display distance from guess
    document.querySelector("#distanceResult").textContent =
      `${result.distance.toFixed(2)} km`;

    document.querySelector("#yourGuess").textContent = formatCoordinate(
      result.guessLocation,
    );
    document.querySelector("#actualLocation").textContent = formatCoordinate(
      result.actualLocation,
    );

    renderResultMap(result.guessLocation, result.actualLocation);

    // update next-round / end-game button
    const nextRoundButton = document.querySelector("#nextRoundButton");

    if (pendingRoundData) {
      nextRoundButton.textContent = "Next Round";
    } else {
      nextRoundButton.textContent = "End Game";
    }

    // display results section
    document.querySelector("#resultsSection").classList.remove("hidden");
  } catch (error) {
    console.error(error);
    alert(error.message);
  } finally {
    // reset submit guess button to "Submit Guess", but is still disabled until next round starts
    submitGuessButton.textContent = "Submit Guess";
  }
}
// #endregion

async function goToNextRound() {
  // hide results section
  const resultsSection = document.querySelector("#resultsSection");

  resultsSection.classList.add("hidden");
  destroyResultMap();

  // if there is no round data for the next round, we completed the final round
  if (!pendingRoundData) {
    document.querySelector("#gameOverSection").classList.remove("hidden");

    return;
  } else {
    // store pendingRoundData and reset it
    const nextRound = pendingRoundData;
    pendingRoundData = null;

    resetGuessMap();

    try {
      await loadRound(nextRound);
      // enable submit guess button
      document.querySelector("#submitGuessButton").disabled = false;
    } catch (error) {
      console.error(error);
      alert("Unable to load the next round");
    }
  }
}

function resetGuessMap() {
  currentGuess = null;

  if (guessMarker) {
    guessMarker.remove();
    guessMarker = null;
  }
}

async function playAgain() {
  document.querySelector("#gameOverSection").classList.add("hidden");
  destroyResultMap();

  resetGuessMap();
  pendingRoundData = null;

  document.querySelector("#submitGuessButton").disabled = false;

  await startGame();
}

function formatCoordinate(location) {
  if (!location) {
    return "--";
  }

  return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
}

function renderResultMap(guessLocation, actualLocation) {
  const resultMapContainer = document.querySelector("#resultMap");

  if (!resultMapContainer || !guessLocation || !actualLocation) {
    return;
  }

  destroyResultMap();

  resultMap = L.map("resultMap", {
    zoomControl: true,
    scrollWheelZoom: true,
    doubleClickZoom: true,
  }).setView([20, 0], 2);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(resultMap);

  const guessLatLng = L.latLng(guessLocation.lat, guessLocation.lng);
  const actualLatLng = L.latLng(actualLocation.lat, actualLocation.lng);

  resultLine = L.polyline([guessLatLng, actualLatLng], {
    color: "#3b82f6",
    weight: 3,
    opacity: 0.8,
  }).addTo(resultMap);

  resultGuessMarker = L.circleMarker(guessLatLng, {
    radius: 8,
    color: "#f59e0b",
    fillColor: "#f59e0b",
    fillOpacity: 0.95,
  }).addTo(resultMap);

  resultActualMarker = L.circleMarker(actualLatLng, {
    radius: 8,
    color: "#10b981",
    fillColor: "#10b981",
    fillOpacity: 0.95,
  }).addTo(resultMap);

  const bounds = L.latLngBounds([guessLatLng, actualLatLng]);
  resultMap.fitBounds(bounds, { padding: [32, 32] });

  requestAnimationFrame(() => {
    resultMap.invalidateSize();
  });
}

function destroyResultMap() {
  if (resultMap) {
    resultMap.remove();
    resultMap = null;
  }

  resultGuessMarker = null;
  resultActualMarker = null;
  resultLine = null;
}

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
    body: JSON.stringify({ imageId: window.imageId }),
  });

  const aiReview = await response.json();

  if (!response.ok) {
    throw new Error(`Request to /streetview/ai-review failed.`, aiReview.error);
  } else {
    console.log(aiReview.review);
  }
});
