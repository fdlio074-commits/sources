// TioAnime - Sora Module
// Author: fdlio074
// Funciones: searchResults, extractDetails, extractEpisodes, extractStreamUrl

const BASE_URL = "https://tioanime.com";

// ─── BÚSQUEDA ────────────────────────────────────────────────────────────────
async function searchResults(keyword) {
    try {
        const url = `${BASE_URL}/buscar?q=${encodeURIComponent(keyword)}`;
        const response = await fetchv2(url, {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": BASE_URL + "/"
        }, "GET", null);
        const html = await response.text();

        const results = [];
        const seen = new Set();

        // TioAnime carga resultados via JS, pero el HTML tiene un listado
        const regex = /<article[^>]*>[\s\S]*?<a[^>]+href="(https?:\/\/tioanime\.com\/anime\/[^"]+)"[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<h3[^>]*>([^<]+)<\/h3>[\s\S]*?<\/article>/gi;
        let match;
        while ((match = regex.exec(html)) !== null) {
            const href = match[1];
            if (seen.has(href)) continue;
            seen.add(href);
            results.push({
                title: match[3].trim(),
                image: match[2].trim(),
                href: href
            });
        }

        // Fallback: buscar cards simples
        if (results.length === 0) {
            const cardRegex = /<a[^>]+href="(https?:\/\/tioanime\.com\/anime\/[^"]+)"[^>]*>[\s\S]*?<img[^>]+(?:src|data-src)="([^"]+)"[\s\S]*?<\/a>/gi;
            while ((match = cardRegex.exec(html)) !== null) {
                const href = match[1];
                if (seen.has(href)) continue;
                seen.add(href);
                // Extraer título del alt o título de imagen
                const titleMatch = match[0].match(/(?:alt|title)="([^"]+)"/i);
                const title = titleMatch ? titleMatch[1].trim() : href.split("/anime/")[1]?.replace(/-/g, " ") || "Unknown";
                results.push({
                    title: title,
                    image: match[2].trim(),
                    href: href
                });
            }
        }

        return JSON.stringify(results);
    } catch (e) {
        console.error("searchResults error:", e);
        return JSON.stringify([]);
    }
}

// ─── DETALLES DEL ANIME ──────────────────────────────────────────────────────
async function extractDetails(url) {
    try {
        const response = await fetchv2(url, {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": BASE_URL + "/"
        }, "GET", null);
        const html = await response.text();

        // Sinopsis
        const descMatch = html.match(/<p[^>]*class="[^"]*sinopsis[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
            || html.match(/<div[^>]*class="[^"]*sinopsis[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
            || html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
        const description = cleanText(descMatch ? descMatch[1] : "Sin descripción disponible");

        // Año / fecha
        const airdateMatch = html.match(/(?:Año|Estreno|Emision)[^\d]*(\d{4})/i)
            || html.match(/<span[^>]*class="[^"]*year[^"]*"[^>]*>([^<]+)<\/span>/i);
        const airdate = airdateMatch ? airdateMatch[1].trim() : "Desconocido";

        // Alias / títulos alternativos
        const aliasMatch = html.match(/<span[^>]*class="[^"]*alt[^"]*"[^>]*>([^<]+)<\/span>/i)
            || html.match(/Títulos?[^:]*:\s*<\/[^>]+>\s*<[^>]+>([^<]+)/i);
        const aliases = aliasMatch ? aliasMatch[1].trim() : "";

        return JSON.stringify([{
            description,
            airdate,
            aliases
        }]);
    } catch (e) {
        console.error("extractDetails error:", e);
        return JSON.stringify([{
            description: "Error al cargar descripción",
            airdate: "Desconocido",
            aliases: ""
        }]);
    }
}

// ─── EPISODIOS ───────────────────────────────────────────────────────────────
async function extractEpisodes(url) {
    try {
        const response = await fetchv2(url, {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": BASE_URL + "/"
        }, "GET", null);
        const html = await response.text();

        const episodes = [];
        const seen = new Set();

        // TioAnime guarda episodios en: var episodes = [[1],[2],...]
        // y el slug del anime en la URL
        const slug = url.split("/anime/")[1]?.replace(/\/$/, "") || "";

        const epDataMatch = html.match(/var\s+episodes\s*=\s*(\[[\s\S]*?\]);/);
        if (epDataMatch) {
            try {
                const epData = JSON.parse(epDataMatch[1]);
                epData.forEach((ep) => {
                    const num = Array.isArray(ep) ? ep[0] : ep;
                    const href = `${BASE_URL}/ver/${slug}-${num}`;
                    if (seen.has(href)) return;
                    seen.add(href);
                    episodes.push({ href, number: parseInt(num, 10) });
                });
            } catch (err) {
                console.error("Episode JSON parse error:", err);
            }
        }

        // Fallback: buscar links /ver/ directamente
        if (episodes.length === 0) {
            const epRegex = /href="(https?:\/\/tioanime\.com\/ver\/[^"]+)"/gi;
            let match;
            while ((match = epRegex.exec(html)) !== null) {
                const href = match[1];
                if (seen.has(href)) continue;
                seen.add(href);
                const numMatch = href.match(/-(\d+(?:\.\d+)?)$/);
                const number = numMatch ? parseFloat(numMatch[1]) : episodes.length + 1;
                episodes.push({ href, number });
            }
        }

        return JSON.stringify(episodes);
    } catch (e) {
        console.error("extractEpisodes error:", e);
        return JSON.stringify([]);
    }
}

// ─── STREAM ──────────────────────────────────────────────────────────────────
async function extractStreamUrl(url) {
    try {
        const response = await fetchv2(url, {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": BASE_URL + "/"
        }, "GET", null);
        const html = await response.text();

        const streams = [];

        // TioAnime guarda servidores en: var videos = [["Nombre","url"],...]
        const videosMatch = html.match(/var\s+videos\s*=\s*(\[[\s\S]*?\]);/);
        if (videosMatch) {
            try {
                const videoData = JSON.parse(videosMatch[1]);
                for (const item of videoData) {
                    const name = item[0] || "Server";
                    const embedUrl = item[1] || "";
                    if (!embedUrl) continue;

                    // Si ya es m3u8 directo
                    if (embedUrl.includes(".m3u8")) {
                        streams.push({
                            title: name,
                            streamUrl: embedUrl,
                            headers: {
                                "Referer": BASE_URL + "/",
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                            }
                        });
                        continue;
                    }

                    // Intentar resolver el embed
                    const resolved = await resolveEmbed(embedUrl, name);
                    if (resolved) streams.push(resolved);
                }
            } catch (err) {
                console.error("Videos parse error:", err);
            }
        }

        // Fallback: buscar m3u8 directo en el HTML
        if (streams.length === 0) {
            const m3u8Match = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
            if (m3u8Match) {
                streams.push({
                    title: "HLS Directo",
                    streamUrl: m3u8Match[1],
                    headers: {
                        "Referer": BASE_URL + "/",
                        "User-Agent": "Mozilla/5.0"
                    }
                });
            }
        }

        // Fallback: buscar iframes
        if (streams.length === 0) {
            const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/i);
            if (iframeMatch) {
                const resolved = await resolveEmbed(iframeMatch[1], "Server 1");
                if (resolved) streams.push(resolved);
            }
        }

        return JSON.stringify({ streams, subtitles: null });
    } catch (e) {
        console.error("extractStreamUrl error:", e);
        return JSON.stringify({ streams: [], subtitles: null });
    }
}

// ─── HELPER: Resolver embed a m3u8 ──────────────────────────────────────────
async function resolveEmbed(embedUrl, name) {
    try {
        const referer = embedUrl.match(/^(https?:\/\/[^\/]+)/)?.[1] + "/" || "";
        const resp = await fetchv2(embedUrl, {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": referer,
            "Origin": referer.replace(/\/$/, "")
        }, "GET", null);
        if (!resp) return null;
        const html = await resp.text();

        // Buscar m3u8
        let m3u8 = (html.match(/file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)/i) || [])[1]
            || (html.match(/"file"\s*:\s*"([^"]+\.m3u8[^"]*)"/i) || [])[1]
            || (html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i) || [])[1];

        if (!m3u8) return null;

        return {
            title: name,
            streamUrl: m3u8.trim(),
            headers: {
                "Referer": referer,
                "Origin": referer.replace(/\/$/, ""),
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        };
    } catch (e) {
        return null;
    }
}

// ─── HELPER: Limpiar texto ───────────────────────────────────────────────────
function cleanText(text) {
    return String(text || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/?[^>]+(>|$)/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();
}
