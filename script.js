
const API = "https://api.github.com";

const $ = (id) => document.getElementById(id);

const form = $("searchForm");
const input = $("username");
const searchButton = $("searchButton");
const message = $("message");
const results = $("results");
const themeButton = $("toggleMode");

let currentSearch = 0;

// Escape API-provided text before inserting it into HTML.
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatNumber(value = 0) {
  return new Intl.NumberFormat("en", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  return new Date(value).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function safeWebsite(value) {
  if (!value) return "";

  try {
    const url = new URL(
      value.startsWith("http://") || value.startsWith("https://")
        ? value
        : `https://${value}`
    );

    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.href;
  } catch {
    return "";
  }
}

async function fetchJSON(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json"
    }
  });

  if (response.status === 404) {
    throw new Error("not-found");
  }

  if (response.status === 403 || response.status === 429) {
    throw new Error("rate-limit");
  }

  if (!response.ok) {
    throw new Error("request-failed");
  }

  return response.json();
}

function showMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`.trim();
  message.hidden = false;
}

function hideMessage() {
  message.hidden = true;
  message.textContent = "";
}

function setLoading(loading) {
  searchButton.disabled = loading;
  input.disabled = loading;
  searchButton.innerHTML = loading
    ? "<span>Searching...</span><span>⟳</span>"
    : '<span>Search</span><span aria-hidden="true">↗</span>';
}

function resetProfile() {
  $("avatar").src = "";
  $("displayName").textContent = "Developer";
  $("login").textContent = "";
  $("bio").textContent = "";
  $("joined").textContent = "📅 Joined —";
  $("location").hidden = true;
  $("blog").hidden = true;
  $("company").hidden = true;

  $("repositories").innerHTML = "";
  $("activity").innerHTML = "";
  $("repoNote").textContent = "";

  ["repoCount", "followers", "following", "gistCount"]
    .forEach(id => $(id).textContent = "—");
}

function renderProfile(user) {
  $("avatar").src = user.avatar_url;
  $("avatar").alt = `${user.login}'s GitHub avatar`;

  $("displayName").textContent = user.name || user.login;
  $("login").textContent = `@${user.login}`;
  $("login").href = user.html_url;

  $("bio").textContent = user.bio || "This developer hasn't added a bio yet.";

  $("profileLink").href = user.html_url;
  $("allReposLink").href = `${user.html_url}?tab=repositories`;

  $("repoCount").textContent = formatNumber(user.public_repos);
  $("followers").textContent = formatNumber(user.followers);
  $("following").textContent = formatNumber(user.following);
  $("gistCount").textContent = formatNumber(user.public_gists);

  $("joined").textContent = `📅 Joined ${formatDate(user.created_at)}`;

  if (user.location) {
    $("location").querySelector("span").textContent = user.location;
    $("location").hidden = false;
  } else {
    $("location").hidden = true;
  }

  const website = safeWebsite(user.blog);

  if (website) {
    $("blog").href = website;
    $("blog").textContent = `🔗 ${new URL(website).hostname}`;
    $("blog").hidden = false;
  } else {
    $("blog").hidden = true;
  }

  if (user.company) {
    $("company").textContent = `Works at ${user.company}`;
    $("company").href = user.html_url;
    $("company").hidden = false;
  } else {
    $("company").hidden = true;
  }
}

function renderRepositories(repos) {
  const container = $("repositories");

  $("repoBadge").textContent = `${repos.length} shown`;

  if (!repos.length) {
    container.innerHTML = `
      <div class="repo-empty">
        No public repositories were returned for this profile.
      </div>`;
    $("repoNote").textContent = "";
    return;
  }

  container.innerHTML = repos.map(repo => {
    const description = repo.description || "No description provided.";
    const language = repo.language
      ? `<span><span class="language-dot"></span>${escapeHTML(repo.language)}</span>`
      : "";

    return `
      <article class="repo-card">
        <div class="repo-title-row">
          <a class="repo-name"
             href="${escapeHTML(repo.html_url)}"
             target="_blank" rel="noopener noreferrer">
            ↗ ${escapeHTML(repo.name)}
          </a>
          <span class="repo-visibility">
            ${repo.fork ? "Fork" : "Public"}
          </span>
        </div>

        <p class="repo-description">
          ${escapeHTML(description)}
        </p>

        <div class="repo-footer">
          ${language}
          <span>⭐ ${formatNumber(repo.stargazers_count)}</span>
          <span>⑂ ${formatNumber(repo.forks_count)}</span>
        </div>
      </article>`;
  }).join("");

  $("repoNote").textContent =
    "Repositories are ordered by stars using GitHub's API. " +
    "Only the six returned repositories are shown here.";
}

const eventDescriptions = {
  PushEvent: "Pushed commits",
  PullRequestEvent: "Worked on a pull request",
  IssuesEvent: "Updated an issue",
  IssueCommentEvent: "Commented on an issue",
  CreateEvent: "Created a branch or repository",
  WatchEvent: "Starred a repository",
  ForkEvent: "Forked a repository",
  ReleaseEvent: "Published a release",
  DeleteEvent: "Deleted a branch or tag",
  PublicEvent: "Made a repository public",
  PullRequestReviewEvent: "Reviewed a pull request",
  CommitCommentEvent: "Commented on a commit"
};

function renderActivity(events) {
  const container = $("activity");

  // Events endpoint returns recent public events, not every contribution.
  const recent = events
    .filter(event => event.type !== "PushEvent" ||
      (event.payload?.commits?.length > 0))
    .slice(0, 6);

  if (!recent.length) {
    container.innerHTML = `
      <div class="repo-empty">
        No recent public activity was returned.
        The account may be inactive or its recent events may be unavailable.
      </div>`;
    return;
  }

  container.innerHTML = recent.map(event => {
    const description =
      eventDescriptions[event.type] || "Public GitHub activity";

    const repo = event.repo?.name || "Unknown repository";
    let extra = "";

    if (event.type === "PushEvent") {
      const count = event.payload?.commits?.length || 0;
      extra = `<span class="activity-time">
        ${count} commit${count === 1 ? "" : "s"} in this event
      </span>`;
    }

    return `
      <article class="activity-item">
        <div class="activity-type">${escapeHTML(description)}</div>
        <a class="activity-repo"
           href="https://github.com/${escapeHTML(repo)}"
           target="_blank" rel="noopener noreferrer">
          ${escapeHTML(repo)}
        </a>
        <span class="activity-time">${formatDate(event.created_at)}</span>
        ${extra}
      </article>`;
  }).join("");
}

function explainError(error) {
  if (error.message === "not-found") {
    return "We couldn't find that GitHub user. Check the spelling and try again.";
  }

  if (error.message === "rate-limit") {
    return "GitHub's API rate limit may have been reached. Please wait a little and try again.";
  }

  return "Something went wrong while contacting GitHub. Check your connection and try again.";
}

async function getProfile(username) {
  const searchId = ++currentSearch;

  hideMessage();
  results.hidden = true;
  setLoading(true);
  resetProfile();

  showMessage("Fetching profile information...", "");

  try {
    const user = await fetchJSON(
      `${API}/users/${encodeURIComponent(username)}`
    );

    if (searchId !== currentSearch) return;

    renderProfile(user);
    results.hidden = false;

    showMessage(`Profile loaded for @${user.login}.`, "success");

    // Load repositories and events independently so one failure
    // doesn't prevent the other section from displaying.
    const [reposResult, eventsResult] = await Promise.allSettled([
      fetchJSON(
        `${API}/users/${encodeURIComponent(user.login)}/repos` +
        "?sort=stars&direction=desc&per_page=6"
      ),
      fetchJSON(
        `${API}/users/${encodeURIComponent(user.login)}/events/public?per_page=30`
      )
    ]);

    if (searchId !== currentSearch) return;

    if (reposResult.status === "fulfilled") {
      renderRepositories(reposResult.value);
    } else {
      $("repositories").innerHTML = `
        <div class="repo-empty">
          Couldn't load repositories. Please try again later.
        </div>`;
      $("repoNote").textContent = explainError(reposResult.reason);
    }

    if (eventsResult.status === "fulfilled") {
      renderActivity(eventsResult.value);
    } else {
      $("activity").innerHTML = `
        <div class="repo-empty">
          Couldn't load recent public activity.
        </div>`;
    }

    if (reposResult.status === "rejected" ||
        eventsResult.status === "rejected") {
      showMessage(
        "The profile loaded, but some additional information could not be retrieved.",
        ""
      );
    }
  } catch (error) {
    if (searchId !== currentSearch) return;

    results.hidden = true;
    showMessage(explainError(error), "error");
  } finally {
    if (searchId === currentSearch) {
      setLoading(false);
    }
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const username = input.value.trim();

  if (!username) {
    showMessage("Please enter a GitHub username.", "error");
    input.focus();
    return;
  }

  getProfile(username);
});

document.querySelectorAll(".example-user").forEach(button => {
  button.addEventListener("click", () => {
    input.value = button.dataset.username;
    getProfile(button.dataset.username);
  });
});

// Theme toggle with preference persistence.
function updateTheme(isLight) {
  document.body.classList.toggle("light-mode", isLight);
  themeButton.textContent = isLight ? "🌙" : "☀️";
  themeButton.setAttribute(
    "aria-label",
    isLight ? "Switch to dark mode" : "Switch to light mode"
  );
}

let savedTheme = null;

try {
  savedTheme = localStorage.getItem("devlens-theme");
} catch {
  // The app still works when browser storage is unavailable.
}

updateTheme(savedTheme === "light");

themeButton.addEventListener("click", () => {
  const isLight = !document.body.classList.contains("light-mode");

  updateTheme(isLight);

  try {
    localStorage.setItem("devlens-theme", isLight ? "light" : "dark");
  } catch {
    // Theme still changes for the current page.
  }
});
