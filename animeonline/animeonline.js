// AnimeOnline Ninja - Source Script
// Author: fdlio074
// Compatible con: Mojuru, Dartotsu, Sora, Luna, Anymex, Tsumi, Hiyoku, Shirox

const BASE_URL = "https://ww3.animeonline.ninja";

// ─── BÚSQUEDA ───────────────────────────────────────────────────────────────
async function search(query) {
  const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  const html = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const results = [];
  doc.querySelectorAll("article.TPost").forEach((el) => {
    const title = el.querySelector(".Title")?.textContent?.trim();
    const href = el.querySelector("a")?.getAttribute("href");
    const image = el.querySelector("img")?.getAttribute("src") ||
                  el.querySelector("img")?.getAttribute("data-src");
    if (title && href) {
      results.push({ title, url: href, image });
    }
  });

  return results;
}

// ─── DETALLE DEL ANIME ───────────────────────────────────────────────────────
async function getAnimeDetails(animeUrl) {
  const res = await fetch(animeUrl);
  const html = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const title = doc.querySelector(".Title")?.textContent?.trim();
  const description = doc.querySelector(".Description p")?.textContent?.trim();
  const image = doc.querySelector(".Image img")?.getAttribute("src") ||
                doc.querySelector(".Image img")?.getAttribute("data-src");
  const status = doc.querySelector(".Info .fa-circle")?.parentElement?.textContent?.trim();
  const genres = [...doc.querySelectorAll(".Nvgnrs a")].map(a => a.textContent.trim());

  // Episodios
  const episodes = [];
  doc.querySelectorAll("#episode_by_temp li").forEach((li) => {
    const epTitle = li.querySelector("a .Num")?.textContent?.trim();
    const epUrl = li.querySelector("a")?.getAttribute("href");
    if (epTitle && epUrl) {
      episodes.push({ title: `Episodio ${epTitle}`, url: epUrl });
    }
  });

  return { title, description, image, status, genres, episodes };
}

// ─── OBTENER STREAM ──────────────────────────────────────────────────────────
async function getStream(episodeUrl) {
  const res = await fetch(episodeUrl);
  const html = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const servers = [];

  // Iframes embebidos directamente
  doc.querySelectorAll(".TPlayerTb iframe, #playerContainer iframe").forEach((iframe) => {
    const src = iframe.getAttribute("src") || iframe.getAttribute("data-src");
    if (src) servers.push({ name: "Server 1", url: src });
  });

  // Opciones de servidor (botones)
  doc.querySelectorAll(".ServerList li, .optns-server li").forEach((li, i) => {
    const dataUrl = li.getAttribute("data-url") || li.getAttribute("data-video");
    const name = li.querySelector("span")?.textContent?.trim() || `Server ${i + 1}`;
    if (dataUrl) servers.push({ name, url: dataUrl });
  });

  // Buscar m3u8 en el HTML crudo
  const m3u8Match = html.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
  if (m3u8Match) {
    servers.push({ name: "HLS Directo", url: m3u8Match[0] });
  }

  return servers;
}

// ─── ÚLTIMOS EPISODIOS ───────────────────────────────────────────────────────
async function getLatestEpisodes() {
  const res = await fetch(BASE_URL);
  const html = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const episodes = [];
  doc.querySelectorAll("article.TPost").forEach((el) => {
    const title = el.querySelector(".Title")?.textContent?.trim();
    const href = el.querySelector("a")?.getAttribute("href");
    const image = el.querySelector("img")?.getAttribute("src") ||
                  el.querySelector("img")?.getAttribute("data-src");
    const ep = el.querySelector(".Epsds")?.textContent?.trim();
    if (title && href) {
      episodes.push({ title, episode: ep || "", url: href, image });
    }
  });

  return episodes;
}

// ─── EXPORTAR ────────────────────────────────────────────────────────────────
export default {
  search,
  getAnimeDetails,
  getStream,
  getLatestEpisodes,
};
