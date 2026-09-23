const form = document.querySelector("#proxyForm");
const input = document.querySelector("#url");
const status = document.querySelector("#status");
const viewer = document.querySelector("#viewer");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "Loading…";
  viewer.srcdoc = "";

  try {
    const response = await fetch("/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: input.value.trim() })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed.");

    status.textContent = `Loaded with status ${data.status}.`;
    viewer.srcdoc = data.html;
  } catch (error) {
    status.textContent = error.message;
  }
});
