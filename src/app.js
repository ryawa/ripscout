import { Client } from "robotevents";

const teamId = 122732;

function getSearchDate() {
  const now = new Date();
  const searchUTC = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 10)
  );
  return searchUTC.toISOString().slice(0, 10);
}

const client = Client({
  authorization: {
    token: process.env.TOKEN,
  },
});

const eventsSelect = document.getElementById("events");
const divisionsSelect = document.getElementById("divisions");
eventsSelect.addEventListener("change", (event) => {
  const eventId = event.target.value;
  loadDivisions(eventId);
});
divisionsSelect.addEventListener("change", (event) => {
  const divisionId = event.target.value;
  loadTeams(divisionId);
});

const thresholdInput = document.getElementById("threshold");
let threshold = parseFloat(thresholdInput.value);
thresholdInput.addEventListener("input", (event) => {
  threshold = parseFloat(event.target.value);
  loadTeams(parseInt(eventsSelect.value), parseInt(divisionsSelect.value));
});

const teamsTableBody = document.getElementById("teams").querySelector("tbody");

const teamsCache = {};

async function loadEvents() {
  const season = await client.seasons.all({
    "program[]": [client.programs.V5RC],
    active: true,
  });
  const events = await client.events.search({
    "team[]": [teamId],
    "season[]": [season.data[0].id],
    end: getSearchDate(),
  });
  for (const event of events.data) {
    const option = document.createElement("option");
    option.value = event.id;
    option.text = `${event.name} - ${new Date(event.start).toLocaleDateString(
      "en-US"
    )}`;
    eventsSelect.appendChild(option);
  }
  if (events.data.length > 0) {
    loadDivisions(events.data[0].id);
  }
}

async function loadDivisions(eventId) {
  const event = await client.events.get(eventId);
  divisionsSelect.innerHTML = "";
  for (const division of event.data.divisions) {
    const option = document.createElement("option");
    option.value = division.id;
    option.text = division.name;
    divisionsSelect.appendChild(option);
  }
  if (event.data.divisions.length > 0) {
    loadTeams(eventId, event.data.divisions[0].id);
  }
}

async function loadTeams(eventId, divisionId) {
  teamsCache[eventId] = teamsCache[eventId] ?? {};
  let matchData = teamsCache[eventId][divisionId];
  if (!teamsCache[eventId][divisionId]) {
    matchData = {};

    const event = await client.events.get(eventId);
    const matches = await event.data.matches(divisionId);
    for (const match of matches.data) {
      for (const alliance of match.alliances) {
        for (const team of alliance.teams) {
          updateStats(matchData, team.team.name, alliance.score);
        }
      }
    }
    const keys = Object.keys(matchData);
    keys.sort((a, b) => matchData[b].mean - matchData[a].mean);
    matchData.sortedKeys = keys;
    teamsCache[eventId][divisionId] = matchData;
  }
  displayTeams(matchData);
}

// https://math.stackexchange.com/questions/2148877/iterative-calculation-of-mean-and-standard-deviation
function updateStats(cache, teamName, allianceScore) {
  cache[teamName] = cache[teamName] ?? { n: 0, s1: 0, s2: 0 };
  let { n, s1, s2 } = cache[teamName];
  n++;
  s1 += allianceScore;
  s2 += allianceScore * allianceScore;
  const mean = s1 / n;
  const stddev = Math.sqrt(s2 / n - Math.pow(s1 / n, 2));
  cache[teamName] = { n: n, s1: s1, s2: s2, mean: mean, stddev: stddev };
}

async function displayTeams(data) {
  teamsTableBody.innerHTML = "";
  for (const teamName of data.sortedKeys) {
    const stats = data[teamName];
    const row = document.createElement("tr");
    const cellNumber = document.createElement("td");
    const cellMean = document.createElement("td");
    const cellStddev = document.createElement("td");
    cellStddev.style.backgroundColor = `hsl(${Math.exp(
      Math.log(120) - stats.stddev / 10
    )}, 100%, 50%)`;
    cellNumber.textContent = teamName;
    cellMean.textContent = (stats.mean - threshold).toFixed(2);
    cellStddev.textContent = stats.stddev.toFixed(2);
    row.appendChild(cellNumber);
    row.appendChild(cellMean);
    row.appendChild(cellStddev);
    teamsTableBody.appendChild(row);
  }
}

loadEvents();
