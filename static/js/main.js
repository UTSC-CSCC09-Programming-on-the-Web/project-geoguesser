document.addEventListener("DOMContentLoaded", () => {
  fetch("/games/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(),
  })
    .then((res) => {
      return res.json();
    })
    .then();
});
