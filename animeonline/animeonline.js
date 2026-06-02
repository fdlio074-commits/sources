// TioAnime - Source Script
// Author: fdlio074
// Compatible con: Mojuru, Dartotsu, Sora, Luna, Anymex, Tsumi, Hiyoku, Shirox

const BASE_URL = "https://tioanime.com";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9",
  "Referer": "https://tioanime.com/",
};

// ─── BÚSQUEDA ───────────────────────────────────────────────────────────────
async function search(query) {
  const url = `${BASE_URL}/buscar?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: HEADERS });
  const html = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const results = [];
  doc.querySelectorAll("ul.animes li article").forEach((el) => {
    const title = el.querySelector("h3.title")?.textContent?.trim();
    const href = el.querySelector("a")?.getAttribute("href");
    const image = el.querySelector("img")?.getAttribute("src");
    if (title && href) {
      results.push({
        title,
        url: href.startsWith("http") ? href : BASE_URL + href,
        image: image?.startsWith("http") ? image : BASE_URL + image,
      });
    }
  });

  return results;
}

// ─── DETALLE DEL ANIME ───────────────────────────────────────────────────────
async function getAnimeDetails(animeUrl) {
  const res = await fetch(animeUrl, { headers: HEADERS });
  const html = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const title = doc.querySelector("h1.title")?.textContent?.trim();
  const description = doc.querySelector("p.sinopsis")?.textContent?.trim();
  const image = doc.querySelector(".cover img")?.getAttribute("src");
  const status = doc.querySelector(".status")?.textContent?.trim();
  const genres = [...doc.querySelectorAll(".genres a")].map(a => a.textContent.trim());

  // Episodios desde el array JS embebido en la página
  const episodes = [];
  const scriptMatch = html.match(/var episodes\s*=\s*(\[.*?\]);/s);
  if (scriptMatch) {
    try {
      const epData = JSON.parse(scriptMatch[1]);
      const slug = animeUrl.split("/anime/")[1];
      epData.forEach(([epNum]) => {
        episodes.push({
          title: `Episodio ${epNum}`,
          url: `${BASE_URL}/ver/${slug}-${epNum}`,
        });
      });
    } catch (e) {}
  }

  // Fallback: buscar enlaces directos
  if (episodes.length === 0) {
    doc.querySelectorAll(".episodes-list a").forEach((a) => {
      const href = a.getAttribute("href");
      const epTitle = a.querySelector(".num")?.textContent?.trim() || a.textContent.trim();
      if (href) {
        episodes.push({
          title: `Episodio ${epTitle}`,
          url: href.startsWith("http") ? href : BASE_URL + href,
        });
      }
    });
  }

  return {
    title,
    description,
    image: image?.startsWith("http") ? image : BASE_URL + image,
    status,
    genres,
    episodes,
  };
}

// ─── OBTENER STREAM ──────────────────────────────────────────────────────────
async function getStream(episodeUrl) {
  const res = await fetch(episodeUrl, { headers: HEADERS });
  const html = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const servers = [];

  // Servidores embebidos en variable JS
  const videosMatch = html.match(/var videos\s*=\s*(\[.*?\]);/s);
  if (videosMatch) {
    try {
      const videoData = JSON.parse(videosMatch[1]);
      videoData.forEach(([name, url]) => {
        if (url) servers.push({ name, url });
      });
    } catch (e) {}
  }

  // Fallback: iframes directos
  if (servers.length === 0) {
    doc.querySelectorAll("iframe").forEach((iframe, i) => {
      const src = iframe.getAttribute("src") || iframe.getAttribute("data-src");
      if (src) servers.push({ name: `Server ${i + 1}`, url: src });
    });
  }

  // Buscar m3u8 directo en el HTML
  const m3u8Match = html.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
  if (m3u8Match) {
    servers.push({ name: "HLS Directo", url: m3u8Match[0] });
  }

  return servers;
}

// ─── ÚLTIMOS EPISODIOS ───────────────────────────────────────────────────────
async function getLatestEpisodes() {
  const res = await fetch(BASE_URL, { headers: HEADERS });
  const html = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const episodes = [];
  doc.querySelectorAll("ul.episodes-list li").forEach((li) => {
    const title = li.querySelector(".title")?.textContent?.trim();
    const href = li.querySelector("a")?.getAttribute("href");
    const image = li.querySelector("img")?.getAttribute("src");
    const epNum = li.querySelector(".episode")?.textContent?.trim();
    if (title && href) {
      episodes.push({
        title,
        episode: epNum || "",
        url: href.startsWith("http") ? href : BASE_URL + href,
        image: image?.startsWith("http") ? image : BASE_URL + image,
      });
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
