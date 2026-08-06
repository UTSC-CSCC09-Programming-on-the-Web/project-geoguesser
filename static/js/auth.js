const authStatus = document.querySelector("#authStatus");
const loginButton = document.querySelector("#loginButton");
const subscribeButton = document.querySelector("#subscribeButton");
const logoutButton = document.querySelector("#logoutButton");
const authHintButton = document.querySelector("#hintButton");
const gameLayout = document.querySelector(".game-layout");
const accessGate = document.querySelector("#accessGate");
const accessGateMessage = document.querySelector("#accessGateMessage");

const updateAccessState = (user) => {
  const canPlay = Boolean(user && user.subscriptionStatus === "active");
  const message = !user
    ? "Sign in with Google, then complete checkout to unlock gameplay."
    : "Your subscription is pending. Complete checkout to unlock gameplay.";

  window.geoguesserAccessState = {
    ready: true,
    user: user || null,
    canPlay: canPlay,
    message: message,
  };

  window.dispatchEvent(
    new CustomEvent("geoguesser-access-changed", {
      detail: window.geoguesserAccessState,
    }),
  );
};

const updateGateUi = (user) => {
  const canPlay = Boolean(user && user.subscriptionStatus === "active");
  gameLayout.classList.toggle("locked", !canPlay);
  accessGate.classList.toggle("hidden", canPlay);

  if (!canPlay) {
    accessGateMessage.textContent = user
      ? "Your subscription is pending. Complete checkout to unlock gameplay."
      : "Sign in with Google, then complete checkout to unlock gameplay.";
  }
};

const setAuthUi = (user) => {
  if (!user) {
    authStatus.textContent = "Not logged in";
    loginButton.classList.remove("hidden");
    subscribeButton.classList.add("hidden");
    logoutButton.classList.add("hidden");
    authHintButton.disabled = true;
    updateGateUi(null);
    updateAccessState(null);
    return;
  }

  const isSubscribed = user.subscriptionStatus === "active";
  authStatus.textContent = isSubscribed
    ? `Logged in as ${user.username} (subscription active)`
    : `Logged in as ${user.username} (subscription required)`;

  loginButton.classList.add("hidden");
  logoutButton.classList.remove("hidden");
  subscribeButton.classList.toggle("hidden", isSubscribed);
  authHintButton.disabled = !isSubscribed;
  updateGateUi(user);
  updateAccessState(user);
};

const loadCurrentUser = async () => {
  try {
    const response = await fetch("/api/me");
    if (!response.ok) {
      setAuthUi(null);
      return null;
    }

    const data = await response.json();
    setAuthUi(data.user);
    return data.user;
  } catch (error) {
    setAuthUi(null);
    return null;
  }
};

const confirmCheckoutFromQuery = async () => {
  const params = new URLSearchParams(window.location.search);
  const checkoutStatus = params.get("checkout");
  const sessionId = params.get("session_id");

  if (checkoutStatus !== "success" || !sessionId) {
    return;
  }

  try {
    await fetch(
      `/api/checkout/confirm?session_id=${encodeURIComponent(sessionId)}`,
    );
  } finally {
    params.delete("checkout");
    params.delete("session_id");
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `?${nextQuery}` : window.location.pathname;
    window.history.replaceState({}, "", nextUrl);
  }
};

loginButton.addEventListener("click", () => {
  window.location.assign("/auth/google");
});

subscribeButton.addEventListener("click", async () => {
  const response = await fetch("/api/create-checkout-session", {
    method: "POST",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || "Unable to start checkout");
  }

  window.location.assign(data.url);
});

logoutButton.addEventListener("click", async () => {
  await fetch("/auth/logout");
  setAuthUi(null);
});

const initAuth = async () => {
  await confirmCheckoutFromQuery();
  await loadCurrentUser();
};

initAuth();
