// TioAnime - Source Script (via JIMOV API)
// Author: fdlio074
// Compatible con: Mojuru, Dartotsu, Sora, Luna, Anymex, Tsumi, Hiyoku, Shirox

const API = "https://jimov-api.vercel.app";
const BASE_URL = "https://tioanime.com";

// ─── BÚSQUEDA ───────────────────────────────────────────────────────────────
async function search(query) {
  const url = `${API}/anime/tioanime/search?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  const data = await res.json();

  return (data.results || []).map((item) => ({
    title: item.name,
    url: `${BASE_URL}/anime/${item.url.split("/").pop()}`,
    image: item.image?.url || item.image || "",
  }));
}

// ─── DETALLE DEL ANIME ───────────────────────────────────────────────────────
async function getAnimeDetails(animeUrl) {
  const slug = animeUrl.split("/anime/").pop();
  const url = `${API}/anime/tioanime/name/${slug}`;
  const res = await fetch(url);
  const data = await res.json();

  const episodes = (data.episodes || []).map((ep) => ({
    title: `Episodio ${ep.number || ep.id}`,
    url: `${BASE_URL}/ver/${slug}-${ep.number || ep.id}`,
  }));

  return {
    title: data.name,
    description: data.synopsis,
    image: data.image?.url || data.image || "",
    status: data.status || "",
    genres: data.genres || [],
    episodes,
  };
}

// ─── OBTENER STREAM ──────────────────────────────────────────────────────────
async function getStream(episodeUrl) {
  // Extraer slug del episodio: /ver/naruto-1 → naruto-1
  const epSlug = episodeUrl.split("/ver/").pop();
  const url = `${API}/anime/tioanime/episode/${epSlug}`;
  const res = await fetch(url);
  const data = await res.json();

  const servers = [];

  (data.servers || data.links || []).forEach((s, i) => {
    const name = s.name || s.server || `Server ${i + 1}`;
    const link = s.url || s.link || s.src;
    if (link) servers.push({ name, url: link });
  });

  // Fallback: scraping directo del HTML del episodio
  if (servers.length === 0) {
    try {
      const pageRes = await fetch(episodeUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Referer": BASE_URL,
        },
      });
      const html = await pageRes.text();

      // tioanime guarda los videos en: var videos = [["Nombre","url"],...]
      const match = html.match(/var\s+videos\s*=\s*(\[[\s\S]*?\]);/);
      if (match) {
        const videoList = JSON.parse(match[1]);
        videoList.forEach(([name, link]) => {
          if (link) servers.push({ name, url: link });
        });
      }
    } catch (e) {}
  }

  return servers;
}

// ─── ÚLTIMOS EPISODIOS ───────────────────────────────────────────────────────
async function getLatestEpisodes() {
  const url = `${API}/anime/tioanime/latest`;
  const res = await fetch(url);
  const data = await res.json();

  return (data.results || data || []).map((item) => ({
    title: item.name || item.title,
    episode: item.episode ? `Episodio ${item.episode}` : "",
    url: item.url?.startsWith("http") ? item.url : `${BASE_URL}${item.url}`,
    image: item.image?.url || item.image || item.preview || "",
  }));
}

// ─── EXPORTAR ────────────────────────────────────────────────────────────────
export default {
  search,
  getAnimeDetails,
  getStream,
  getLatestEpisodes,
};
