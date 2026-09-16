// Explore Games button
const exploreButton = document.querySelector(".primary-button");

if (exploreButton) {
  exploreButton.addEventListener("click", () => {
    const gamesSection = document.querySelector("#games");

    if (gamesSection) {
      gamesSection.scrollIntoView({
        behavior: "smooth"
      });
    }
  });
}

// View Tournaments button
const tournamentButton = document.querySelector(".secondary-button");

if (tournamentButton) {
  tournamentButton.addEventListener("click", () => {
    const tournamentsSection = document.querySelector("#tournaments");

    if (tournamentsSection) {
      tournamentsSection.scrollIntoView({
        behavior: "smooth"
      });
    }
  });
}

// Join Arena button
const navButton = document.querySelector(".nav-button");

if (navButton) {
  navButton.addEventListener("click", () => {
    alert("Arena access will be available soon!");
  });
}

// Rotating system status
const statusElement = document.querySelector(".status-badge");

if (statusElement) {
  const statuses = [
    "SYSTEM ONLINE",
    "ARENA STABLE",
    "SERVERS READY",
    "MATCHMAKING ACTIVE"
  ];

  let statusIndex = 0;

  setInterval(() => {
    statusIndex = (statusIndex + 1) % statuses.length;
    statusElement.textContent = statuses[statusIndex];
  }, 3000);
}

// Load games through the Nginx reverse proxy
async function loadGames() {
  try {
    const response = await fetch("/api/games");

    if (!response.ok) {
      throw new Error("Failed to fetch games from backend");
    }

    const games = await response.json();

    console.log("Games received through Nginx:", games);

    const gameCards = document.querySelectorAll(".game-card");

    games.forEach((game, index) => {
      const card = gameCards[index];

      if (!card) {
        return;
      }

      const titleElement = card.querySelector("h3");

      if (titleElement) {
        titleElement.textContent = game.name;
      }

      card.dataset.gameId = game.id;
      card.dataset.category = game.category;

      console.log(`Updated game card: ${game.name}`);
    });

    console.log("Game cards successfully updated.");
  } catch (error) {
    console.error("Backend connection failed:", error);
  }
}

// Start the API request
loadGames();