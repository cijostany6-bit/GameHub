// =========================================================
// GAMEHUB — FRONTEND SCRIPT
// =========================================================


// =========================================================
// HOME PAGE — HERO BUTTONS
// =========================================================

// Explore Games button
const exploreButton = document.querySelector(".primary-button");

if (exploreButton) {
  exploreButton.addEventListener("click", () => {

    // If this button exists on the homepage,
    // take the user to the Games page.
    if (window.location.pathname.endsWith("index.html") ||
        window.location.pathname === "/") {

      window.location.href = "games.html";

    }
  });
}


// View Tournaments button
const tournamentButton = document.querySelector(".secondary-button");

if (tournamentButton) {
  tournamentButton.addEventListener("click", () => {

    const tournamentsSection =
      document.querySelector("#tournaments");

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


// =========================================================
// SYSTEM STATUS
// =========================================================

const statusElement =
  document.querySelector(".status-badge");

if (statusElement) {

  const statuses = [
    "SYSTEM ONLINE",
    "ARENA STABLE",
    "SERVERS READY",
    "MATCHMAKING ACTIVE"
  ];

  let statusIndex = 0;

  setInterval(() => {

    statusIndex =
      (statusIndex + 1) % statuses.length;

    statusElement.textContent =
      statuses[statusIndex];

  }, 3000);

}


// =========================================================
// GAMES PAGE
// =========================================================

// Check whether we are currently on the Games page.
const gamesGrid =
  document.querySelector("#games-grid");


// Store games received from the backend.
// This allows category filtering without
// making another database request.
let allGames = [];


// =========================================================
// LOAD GAMES FROM BACKEND
// =========================================================

async function loadGames() {

  if (!gamesGrid) {
    return;
  }

  try {

    console.log("Connecting to GameHub backend...");


    // Request game data through the Nginx
    // reverse proxy.
    const response =
      await fetch("/api/games");


    // Check HTTP response.
    if (!response.ok) {

      throw new Error(
        `Backend returned HTTP ${response.status}`
      );

    }


    // Convert JSON response into JavaScript data.
    const games =
      await response.json();


    console.log(
      "Games received from backend:",
      games
    );


    // Store the complete game list.
    allGames = games;


    // Display all games initially.
    renderGames(allGames);


  } catch (error) {

    console.error(
      "Game database connection failed:",
      error
    );


    gamesGrid.innerHTML = `

      <div class="games-error">

        <strong>
          GAME DATABASE OFFLINE
        </strong>

        <p>
          Unable to retrieve games from the
          GameHub backend.
        </p>

        <small>
          Check Docker containers,
          Nginx and RDS connectivity.
        </small>

      </div>

    `;

  }

}


// =========================================================
// RENDER GAME CARDS
// =========================================================

function renderGames(games) {


  // No games returned.
  if (!games || games.length === 0) {

    gamesGrid.innerHTML = `

      <div class="games-empty">

        <h3>
          NO GAMES FOUND
        </h3>

        <p>
          The GameHub database currently
          contains no games.
        </p>

      </div>

    `;

    return;
  }


  // Clear the loading state.
  gamesGrid.innerHTML = "";


  // Create a card for every game.
  games.forEach((game) => {


    const card =
      document.createElement("article");


    card.className =
      "game-card dynamic-game-card";


    // Determine the image class.
    const imageClass =
      getGameImageClass(game.name);


    card.innerHTML = `

      <div
        class="game-image ${imageClass}">
      </div>


      <div class="game-card-content">

        <p class="game-category">
          ${escapeHTML(game.category)}
        </p>


        <h3>
          ${escapeHTML(game.name)}
        </h3>


        <p class="game-description">
          ${escapeHTML(game.description)}
        </p>


        <button
          class="card-button"
          data-game-id="${game.id}">

          View Game

        </button>

      </div>

    `;


    gamesGrid.appendChild(card);

  });


  // Activate View Game buttons.
  attachGameButtons();

}


// =========================================================
// CATEGORY FILTERING
// =========================================================

const filterButtons =
  document.querySelectorAll(".filter-button");


filterButtons.forEach((button) => {

  button.addEventListener("click", () => {


    // Remove active state from every button.
    filterButtons.forEach((item) => {

      item.classList.remove("active");

    });


    // Activate selected button.
    button.classList.add("active");


    const selectedCategory =
      button.dataset.category;


    // Show everything.
    if (selectedCategory === "all") {

      renderGames(allGames);

      return;

    }


    // Filter games locally.
    const filteredGames =
      allGames.filter((game) => {

        return game.category === selectedCategory;

      });


    renderGames(filteredGames);

  });

});


// =========================================================
// VIEW GAME BUTTONS
// =========================================================

function attachGameButtons() {

  const buttons =
    document.querySelectorAll(
      ".dynamic-game-card .card-button"
    );


  buttons.forEach((button) => {

    button.addEventListener("click", () => {

      const gameId =
        button.dataset.gameId;


      alert(
        `Game details for game ID ${gameId} will be available soon!`
      );

    });

  });

}


// =========================================================
// GAME IMAGE MAPPING
// =========================================================

function getGameImageClass(gameName) {

  const name =
    gameName.toLowerCase();


  if (name.includes("cyber")) {

    return "cyber-strike";

  }


  if (name.includes("neon")) {

    return "neon-rivals";

  }


  if (name.includes("shadow")) {

    return "shadow-protocol";

  }


  // Default image class.
  return "default-game";

}


// =========================================================
// BASIC HTML ESCAPING
// =========================================================

// Prevent database text from being interpreted
// directly as HTML.
function escapeHTML(value) {

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


// =========================================================
// START APPLICATION
// =========================================================

loadGames();