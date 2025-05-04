// Function to toggle dark mode
document.getElementById("toggleMode").onclick = function() {
  document.body.classList.toggle("dark-mode");
  const mode = document.body.classList.contains("dark-mode") ? "🌞" : "🌙";
  document.getElementById("toggleMode").textContent = mode;
};

// Function to fetch GitHub profile data
function getProfile() {
  const username = document.getElementById("username").value;
  const url = `https://api.github.com/users/${username}`;

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      if (data.message === "Not Found") {
        document.getElementById("profile").innerHTML = "User not found!";
        return;
      }

      document.getElementById("profile").innerHTML = `
        <img src="${data.avatar_url}" width="150" style="border-radius: 50%" />
        <h2>${data.name || data.login}</h2>
        <p>${data.bio || "No bio available"}</p>
        <p>Public Repos: ${data.public_repos}</p>
        <p>Followers: ${data.followers}</p>
        <a href="${data.html_url}" target="_blank">View Profile</a>
      `;
      // Fetch and display top 5 repositories
      getTopRepos(username);
      // Fetch and display contribution details
      getContributions(username);
    })
    .catch((err) => console.error(err));
}

// Function to fetch and display top 5 repositories sorted by stars
function getTopRepos(username) {
  const url = `https://api.github.com/users/${username}/repos?sort=stars&per_page=5`;

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      let repoList = `<h3>Top 5 Repositories</h3><ul>`;
      data.forEach(repo => {
        repoList += `<li><strong>${repo.name}</strong> - ⭐${repo.stargazers_count}</li>`;
      });
      repoList += `</ul>`;
      document.getElementById("profile").innerHTML += repoList;
    })
    .catch((err) => console.error(err));
}

// Function to fetch and display recent contributions
function getContributions(username) {
  const url = `https://api.github.com/users/${username}/events/public`;

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      let contributions = data.filter(event => event.type === "PushEvent");
      document.getElementById("profile").innerHTML += `
        <h3>Recent Contributions</h3>
        <p>${contributions.length} contributions made recently</p>
      `;
    })
    .catch((err) => console.error(err));
}