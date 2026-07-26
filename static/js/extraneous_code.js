// ============================================
// GeoGuesser Game Logic with Leaflet.js Maps
// ============================================

let gameState = {
  currentRound: 1,
  totalRounds: 5,
  totalScore: 0,
  roundScores: [],
  guessCoordinates: null,
  actualLocation: null,
  maps: {},
};

// ============================================
// Initialize Game
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  initializeMaps();
  setupEventListeners();
  loadNewRound();
});

// ============================================
// Map Initialization
// ============================================

function initializeMaps() {
  // Initialize guess map
  gameState.maps.guessMap = L.map("guessMap").setView([20, 0], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
    minZoom: 2,
    referrerPolicy: "no-referrer-when-downgrade",
  }).addTo(gameState.maps.guessMap);

  // Add click listener to guess map
  gameState.maps.guessMap.on("click", onGuessMapClick);

  // Initialize result map (will be used later)
  // We'll create it when needed to avoid conflicts
}

function createResultMap() {
  if (gameState.maps.resultMap) {
    gameState.maps.resultMap.remove();
  }

  gameState.maps.resultMap = L.map("resultMap").setView([20, 0], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
    minZoom: 2,
    referrerPolicy: "no-referrer-when-downgrade",
  }).addTo(gameState.maps.resultMap);
}

// ============================================
// Map Event Handlers
// ============================================

function onGuessMapClick(event) {
  const lat = event.latlng.lat;
  const lng = event.latlng.lng;

  gameState.guessCoordinates = {
    lat: parseFloat(lat.toFixed(4)),
    lng: parseFloat(lng.toFixed(4)),
  };

  // Update input fields
  document.getElementById("latInput").value = gameState.guessCoordinates.lat;
  document.getElementById("lngInput").value = gameState.guessCoordinates.lng;

  // Clear existing markers and add new one
  clearMapMarkers("guessMap");
  addMarker(gameState.maps.guessMap, lat, lng, "Your Guess", "blue");
}

function addMarker(map, lat, lng, label, color = "blue") {
  const markerIcon = L.divIcon({
    html: `<div style="
            background-color: ${color};
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 3px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
        ">
            <span style="color: white; font-size: 16px; font-weight: bold;">📍</span>
        </div>`,
    iconSize: [30, 30],
    className: "custom-marker",
  });

  const marker = L.marker([lat, lng], { icon: markerIcon })
    .addTo(map)
    .bindPopup(
      `<strong>${label}</strong><br>Lat: ${lat.toFixed(4)}<br>Lng: ${lng.toFixed(4)}`,
    );

  return marker;
}

function clearMapMarkers(mapId) {
  const map = gameState.maps[mapId];
  map.eachLayer((layer) => {
    if (layer instanceof L.Marker) {
      map.removeLayer(layer);
    }
  });
}

// ============================================
// Event Listeners Setup
// ============================================

function setupEventListeners() {
  // Buttons
  document
    .getElementById("submitGuessBtn")
    .addEventListener("click", submitGuess);
  document.getElementById("skipBtn").addEventListener("click", skipRound);
  document.getElementById("nextRoundBtn").addEventListener("click", nextRound);
  document.getElementById("playAgainBtn").addEventListener("click", resetGame);

  // Map controls
  document
    .getElementById("rotateLeftBtn")
    .addEventListener("click", () => rotateView(-45));
  document
    .getElementById("rotateRightBtn")
    .addEventListener("click", () => rotateView(45));
  document
    .getElementById("zoomInBtn")
    .addEventListener("click", () => gameState.maps.guessMap.zoomIn());
  document
    .getElementById("zoomOutBtn")
    .addEventListener("click", () => gameState.maps.guessMap.zoomOut());
}

function rotateView(degrees) {
  // Note: OpenStreetMap doesn't support rotation
  // This is a placeholder for future enhancement
  console.log(
    `Rotate by ${degrees} degrees (requires different tile provider)`,
  );
}

// ============================================
// Game Logic
// ============================================

function loadNewRound() {
  // Clear previous state
  gameState.guessCoordinates = null;
  clearMapMarkers("guessMap");
  document.getElementById("latInput").value = "";
  document.getElementById("lngInput").value = "";

  // Update round counter
  document.getElementById("round").textContent =
    `${gameState.currentRound}/${gameState.totalRounds}`;

  // TODO: Load street view image from your backend
  loadStreetView();

  // Generate random actual location (for testing)
  gameState.actualLocation = generateRandomLocation();
  console.log("Actual location:", gameState.actualLocation);
}

function submitGuess() {
  if (!gameState.guessCoordinates) {
    alert(
      "Please make a guess by clicking on the map or entering coordinates.",
    );
    return;
  }

  // Calculate distance and score
  const distance = calculateDistance(
    gameState.guessCoordinates.lat,
    gameState.guessCoordinates.lng,
    gameState.actualLocation.lat,
    gameState.actualLocation.lng,
  );

  const points = calculatePoints(distance);
  const accuracy = Math.max(0, 100 - distance / 100);

  // Store round score
  gameState.roundScores.push({
    round: gameState.currentRound,
    distance: distance,
    points: points,
    accuracy: accuracy,
  });

  gameState.totalScore += points;

  // Show results
  showResults(distance, points, accuracy);
}

function skipRound() {
  gameState.roundScores.push({
    round: gameState.currentRound,
    distance: "Skipped",
    points: 0,
    accuracy: 0,
  });

  if (gameState.currentRound < gameState.totalRounds) {
    gameState.currentRound++;
    loadNewRound();
  } else {
    showGameOver();
  }
}

function nextRound() {
  hideResults();

  if (gameState.currentRound < gameState.totalRounds) {
    gameState.currentRound++;
    loadNewRound();
  } else {
    showGameOver();
  }
}

function resetGame() {
  gameState.currentRound = 1;
  gameState.totalScore = 0;
  gameState.roundScores = [];
  hideGameOver();
  loadNewRound();
}

// ============================================
// Results Display
// ============================================

function showResults(distance, points, accuracy) {
  document.getElementById("distanceResult").textContent =
    `${distance.toFixed(2)} km`;
  document.getElementById("pointsResult").textContent = points;
  document.getElementById("accuracyResult").textContent =
    `${accuracy.toFixed(1)}%`;

  document.getElementById("yourGuess").textContent =
    `${gameState.guessCoordinates.lat.toFixed(4)}°, ${gameState.guessCoordinates.lng.toFixed(4)}°`;
  document.getElementById("actualLocation").textContent =
    `${gameState.actualLocation.lat.toFixed(4)}°, ${gameState.actualLocation.lng.toFixed(4)}°`;

  // Create and populate result map
  createResultMap();
  setTimeout(() => {
    gameState.maps.resultMap.invalidateSize();
    addMarker(
      gameState.maps.resultMap,
      gameState.guessCoordinates.lat,
      gameState.guessCoordinates.lng,
      "Your Guess",
      "blue",
    );
    addMarker(
      gameState.maps.resultMap,
      gameState.actualLocation.lat,
      gameState.actualLocation.lng,
      "Actual",
      "red",
    );

    // Fit bounds to show both markers
    const group = new L.featureGroup([
      L.latLng(gameState.guessCoordinates.lat, gameState.guessCoordinates.lng),
      L.latLng(gameState.actualLocation.lat, gameState.actualLocation.lng),
    ]);
    gameState.maps.resultMap.fitBounds(group.getBounds(), {
      padding: [50, 50],
    });
  }, 100);

  document.getElementById("resultsSection").classList.remove("hidden");
}

function hideResults() {
  document.getElementById("resultsSection").classList.add("hidden");
}

function showGameOver() {
  document.getElementById("finalScore").textContent = gameState.totalScore;

  // Populate score breakdown
  const breakdown = document.getElementById("scoreBreakdown");
  breakdown.innerHTML = gameState.roundScores
    .map(
      (score, index) => `
        <div class="score-breakdown-row">
            <span>Round ${score.round}: ${score.points} pts</span>
            <span>${typeof score.distance === "number" ? score.distance.toFixed(2) + " km" : score.distance}</span>
        </div>
    `,
    )
    .join("");

  document.getElementById("gameOverSection").classList.remove("hidden");
}

function hideGameOver() {
  document.getElementById("gameOverSection").classList.add("hidden");
}

// ============================================
// Utility Functions
// ============================================

function loadStreetView() {
  // TODO: Replace with actual street view API call
  const placeholder = document.getElementById("streetViewImage");
  placeholder.src = `https://source.unsplash.com/800x600/?street,city&random=${gameState.currentRound}`;
  placeholder.style.display = "block";
}

function generateRandomLocation() {
  return {
    lat: Math.random() * 180 - 90,
    lng: Math.random() * 360 - 180,
  };
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  // Haversine formula to calculate distance between two coordinates
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculatePoints(distance) {
  // Simple scoring: 5000 points if within 1km, decreases with distance
  if (distance < 1) return 5000;
  if (distance < 10) return Math.max(1000, 5000 - distance * 100);
  if (distance < 100) return Math.max(100, 1000 - distance * 10);
  return 0;
}
