"use strict";

// #region game variables
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
// #endregion

// #region event-listeners
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

// #region ai-review button
const aiReviewParentDiv = document.querySelector("#aiReviewContent");
const aiReviewButton = document.querySelector("#aiReviewButton");
const aiReviewStatus = document.querySelector("#aiReviewStatus");
const aiReviewText = document.querySelector("#aiReviewText");

aiReviewButton.addEventListener("click", async () => {
  if (!gameplayEnabled) {
    throw new Error("Gameplay is locked until your subscription is active.");
  }

  if (!window.imageId) {
    throw new Error("No streetview image loaded yet.");
  }

  // modify aiReview elements
  aiReviewParentDiv.classList.remove("hidden");
  aiReviewButton.disabled = true;
  aiReviewStatus.textContent = "Analyzing image ...";
  aiReviewText.textContent = "";

  try {
    const response = await fetch("/streetview/ai-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // sending imageId as string to ensure ID is preserved (int might overflow)
      body: JSON.stringify({ imageId: window.imageId, mode: "review" }),
    });

    const aiReview = await response.json();

    if (!response.ok) {
      throw new Error(
        aiReview.error || `Request to /streetview/ai-review failed.`,
      );
    } else {
      aiReviewStatus.textContent = "";
      aiReviewText.textContent = aiReview.text;
      aiReviewButton.textContent = "Review Generated";
    }
  } catch (error) {
    aiReviewStatus.textContent = error.message;
    aiReviewButton.disabled = false;
  }
});
// #endregion

// #region ai-hint button
const hintButton = document.querySelector("#hintButton");
const hintCard = document.querySelector("#hintCard");
const hintText = document.querySelector("#hintText");
hintButton.addEventListener("click", async () => {
  if (!gameplayEnabled) {
    alert("Gameplay is locked until your subscription is active.");
    return;
  }

  if (!window.imageId) {
    alert("No streetview image loaded yet");
    return;
  }

  hintButton.disabled = true;
  hintButton.textContent = "Thinking ...";
  hintCard.classList.remove("hidden");
  hintText.textContent = "Analyzing the visible clues ...";

  try {
    const response = await fetch("/streetview/ai-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId: window.imageId, mode: "hint" }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to generate a hint");
    }

    hintText.textContent = result.text;
    hintButton.textContent = "Hint Used";
  } catch (error) {
    console.log(error);
    hintCard.classList.add("hidden");
    hintText.textContent = "";
    hintButton.disabled = false;
    hintButton.textContent = "Hint";
  }
});
// #endregion

// #endregion

// #region helper functions
function normalizeLongitude(lng) {
  const normalized = ((((lng + 180) % 360) + 360) % 360) - 180;
  return normalized === -180 ? 180 : normalized;
}

function updateGuessClick(event) {
  if (!gameplayEnabled) {
    return;
  }

  const lat = event.latlng.lat;
  const lng = normalizeLongitude(event.latlng.lng);

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

    // display actual location
    document.querySelector("#distanceResult").textContent =
      `${result.distance.toFixed(2)} km`;

    document.querySelector("#actualLocation").textContent =
      result.actualLocation.location;

    // render the result map (draws where guesses and actual location are)
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

    // add streetview to results section
    showReviewStreetview();

    // hide game container underneath
    gameLayoutInvisible(true);
  } catch (error) {
    console.error(error);
    alert(error.message);
  } finally {
    // reset submit guess button to "Submit Guess", but is still disabled until next round starts
    submitGuessButton.textContent = "Submit Guess";
  }
}

async function goToNextRound() {
  // hide results section
  const resultsSection = document.querySelector("#resultsSection");
  resultsSection.classList.add("hidden");

  destroyResultMap();

  // move streetview from results section back to the main game area
  restoreGameStreetview();

  // if there is no round data for the next round, we completed the final round
  if (!pendingRoundData) {
    endGameScreen();
  } else {
    // store pendingRoundData and reset it
    const nextRound = pendingRoundData;
    pendingRoundData = null;

    resetGuessMap();
    resetHint();

    try {
      await loadRound(nextRound);

      // show game container after round loads
      gameLayoutInvisible(false);

      // enable submit guess button
      document.querySelector("#submitGuessButton").disabled = false;
    } catch (error) {
      console.error(error);
      alert("Unable to load the next round");
    }
  }
}

function endGameScreen() {
  document.querySelector("#gameOverSection").classList.remove("hidden");
  const finalScoreDisplay = document.querySelector("#finalScore");

  fetch(`/games/${window.gameId}/score`)
    .then((response) => {
      return response.json();
    })
    .then((result) => {
      finalScoreDisplay.textContent = `${result.totalDistance.toFixed(0)} km`;
    });

  return;
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
  resetHint();
  pendingRoundData = null;

  document.querySelector("#submitGuessButton").disabled = false;

  await startGame();

  // show game container after game loads
  gameLayoutInvisible(false);
}

// draws the result map with markers for guess and actual location
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

  // draw line between guess and actual location
  resultLine = L.polyline([guessLatLng, actualLatLng], {
    color: "#3b82f6",
    weight: 3,
    opacity: 0.8,
  }).addTo(resultMap);

  // mark the guess
  resultGuessMarker = L.circleMarker(guessLatLng, {
    radius: 8,
    color: "#c93b45",
    fillColor: "#c93b45",
    fillOpacity: 0.95,
  }).addTo(resultMap);

  // mark the actual location
  resultActualMarker = L.circleMarker(actualLatLng, {
    radius: 8,
    color: "#10b981",
    fillColor: "#10b981",
    fillOpacity: 0.95,
  }).addTo(resultMap);

  // make the result map zoomed around the guess and actual coordinates
  const bounds = L.latLngBounds([guessLatLng, actualLatLng]);
  resultMap.fitBounds(bounds, {
    padding: [40, 40],
    maxZoom: 3,
  });

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

// hides / shows main game layout (streetview and guessmap)
function gameLayoutInvisible(isInvisible) {
  const gameContainer = document.querySelector(".game-container");

  if (gameContainer) {
    gameContainer.classList.toggle("game-layout-invisible", isInvisible);
  }
}

// reset UI of hint button
function resetHint() {
  hintCard.classList.add("hidden");
  hintText.textContent = "Hint";
  hintButton.disabled = !gameplayEnabled;
  hintButton.textContent = "Hint";
}

// moves current streetview into the results section
function showReviewStreetview() {
  const streetviewContainer = document.querySelector("#streetview-container");
  const reviewSlot = document.querySelector("#review-streetview-slot");

  // modify aiReview elements
  aiReviewParentDiv.classList.add("hidden");
  aiReviewButton.disabled = false;
  aiReviewButton.textContent = "AI Review";
  aiReviewStatus.textContent = "";
  aiReviewText.textContent = "";

  if (streetviewContainer && reviewSlot) {
    // add streetview into the review
    reviewSlot.appendChild(streetviewContainer);

    requestAnimationFrame(() => {
      if (window.streetviewViewer?.resize) {
        window.streetviewViewer.resize();
      }
    });
  }
}

// moves streetview element back to the main game area
function restoreGameStreetview() {
  const streetviewContainer = document.querySelector("#streetview-container");
  const mapContainer = document.querySelector("#mapContainer");

  if (streetviewContainer && mapContainer) {
    mapContainer.appendChild(streetviewContainer);

    requestAnimationFrame(() => {
      if (window.streetviewViewer?.resize) {
        window.streetviewViewer.resize();
      }
    });
  }
}
// #endregion
