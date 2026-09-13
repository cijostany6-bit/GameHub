const exploreButton = document.querySelector(".primary-button");
const tournamentButton = document.querySelector(".secondary-button");
const navButton = document.querySelector(".nav-button");

exploreButton.addEventListener("click", () => {
  document.querySelector("#games").scrollIntoView({
    behavior: "smooth"
  });
});

tournamentButton.addEventListener("click", () => {
  document.querySelector("#tournaments").scrollIntoView({
    behavior: "smooth"
  });
});

navButton.addEventListener("click", () => {
  alert("Arena access will be available soon!");
});

const gameCards = document.querySelectorAll(".game-card");

gameCards.forEach((card) => {
  card.addEventListener("click", () => {
    const gameName = card.querySelector("h3").textContent;

    alert(`${gameName} selected! More details coming soon.`);
  });
});

// Live system status
const statusElement = document.querySelector(".status-badge");

if (statusElement) {
  const statuses = [
    "SYSTEM ONLINE",
    "ARENA STABLE",
    "SERVERS READY",
    "MATCHMAKING ACTIVE"
  ];

  let index = 0;

  setInterval(() => {
    index = (index + 1) % statuses.length;
    statusElement.textContent = statuses[index];
  }, 3000);
}