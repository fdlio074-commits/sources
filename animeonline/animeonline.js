// ============================================================
//  Módulo Sora — AnimeJL (anime-jl.net)
//  Autor: fdlio074
//  Repo: https://github.com/fdlio074-commits/sources
//  Modo: asyncJS = true | Idioma: Español Latino
// ============================================================

// ── 1. searchResults ────────────────────────────────────────
// URL real: https://www.anime-jl.net/animes?q=<keyword>
// Estructura HTML:
//   <a href="/anime/309/boruto-latino-v2">
//     <div class="Image fa-play-circle-o">
//       <figure><img src="/storage/..." alt="Título"></figure>
//     </div>
//     <h3 class="Title">Título del Anime</h3>
//   </a>
async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const url = "https://www.anime-jl.net/animes?q=" + encodedKeyword;

        const response = await fetchv2(url, {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.anime-jl.net/"
        });
        const html = await response.text();

        const results = [];

        // Extraer todos los bloques: <a href="/anime/..."> ... <h3 class="Title">...</h3> ... </a>
        const blockRegex = /<a\s+href="(\/anime\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let match;

        while ((match = blockRegex.exec(html)) !== null) {
            const href = "https://www.anime-jl.net" + match[1];
            const inner = match[2];

            // Solo bloques que tengan <h3 class="Title">
            const titleMatch = inner.match(/<h3[^>]*class="[^"]*Title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i);
            if (!titleMatch) continue;

            const title = titleMatch[1].replace(/<[^>]+>/g, "").trim();

            // Imagen: src puede ser relativa (/storage/...) o absoluta
            const imgMatch = inner.match(/<img[^>]+src="([^"]+)"/i);
            let image = imgMatch ? imgMatch[1] : "";
            if (image.startsWith("/")) {
                image = "https://www.anime-jl.net" + image;
            }

            if (title) {
                results.push({ title: title, image: image, href: href });
            }
        }

        return JSON.stringify(results);

    } catch (error) {
        console.log("searchResults error: " + error);
        return JSON.stringify([]);
    }
}

// ── 2. extractDetails ────────────────────────────────────────
async function extractDetails(url) {
    try {
        const response = await fetchv2(url, {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.anime-jl.net/"
        });
        const html = await response.text();

        let description = "Sin descripción disponible.";
        const descMatch = html.match(/<div[^>]*class="[^"]*sinopsis[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
            || html.match(/<div[^>]*class="[^"]*Description[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
            || html.match(/<p[^>]*class="[^"]*sinopsis[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
        if (descMatch) {
            description = descMatch[1].replace(/<[^>]+>/g, "").trim();
        }

        let aliases = "";
        const aliasMatch = html.match(/(?:titulo alterno|otros nombres|alias)[^<]*<[^>]*>([^<]+)/i);
        if (aliasMatch) aliases = aliasMatch[1].trim();

        let airdate = "Desconocido";
        const airMatch = html.match(/(?:año|emitido|estreno|fecha)[^<]*<[^>]*>([0-9]{4})/i)
            || html.match(/>([0-9]{4})<\/(?:span|td|li|p)>/i);
        if (airMatch) airdate = airMatch[1].trim();

        return JSON.stringify([{
            description: description,
            aliases: aliases,
            airdate: airdate
        }]);

    } catch (error) {
        console.log("extractDetails error: " + error);
        return JSON.stringify([{
            description: "Error al cargar detalles.",
            aliases: "",
            airdate: "Desconocido"
        }]);
    }
}

// ── 3. extractEpisodes ───────────────────────────────────────
async function extractEpisodes(url) {
    try {
        const response = await fetchv2(url, {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.anime-jl.net/"
        });
        const html = await response.text();

        const episodes = [];
        // Patrón: /anime/309/boruto-latino-v2/episodio-1
        const epRegex = /href="(\/anime\/[^"]+\/episodio-(\d+))\/?"/gi;
        const seen = new Set();
        let match;

        while ((match = epRegex.exec(html)) !== null) {
            const epPath = match[1];
            const epNum = parseInt(match[2]);
            if (seen.has(epPath)) continue;
            seen.add(epPath);
            episodes.push({ href: "https://www.anime-jl.net" + epPath, number: epNum });
        }

        episodes.sort((a, b) => a.number - b.number);
        return JSON.stringify(episodes);

    } catch (error) {
        console.log("extractEpisodes error: " + error);
        return JSON.stringify([]);
    }
}

// ── 4. extractStreamUrl ──────────────────────────────────────
async function extractStreamUrl(url) {
    try {
        const response = await fetchv2(url, {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.anime-jl.net/"
        });
        const html = await response.text();

        // Intento 1: .m3u8 directo
        const m3u8Match = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
        if (m3u8Match) return m3u8Match[0];

        // Intento 2: .mp4 directo
        const mp4Match = html.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i);
        if (mp4Match) return mp4Match[0];

        // Intento 3: iframe → seguir al reproductor externo
        const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
        if (iframeMatch) {
            const iframeUrl = iframeMatch[1].startsWith("//")
                ? "https:" + iframeMatch[1]
                : iframeMatch[1];

            const iframeResp = await fetchv2(iframeUrl, {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
                "Referer": "https://www.anime-jl.net/"
            });
            const iframeHtml = await iframeResp.text();

            const iframeM3u8 = iframeHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
            if (iframeM3u8) return iframeM3u8[0];

            const iframeMp4 = iframeHtml.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i);
            if (iframeMp4) return iframeMp4[0];

            const fileMatch = iframeHtml.match(/["'](?:file|src)["']\s*:\s*["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
            if (fileMatch) return fileMatch[1];
        }

        // Intento 4: "file":"..." en la página del episodio
        const fileMatch2 = html.match(/["'](?:file|src)["']\s*:\s*["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        if (fileMatch2) return fileMatch2[1];

        console.log("extractStreamUrl: no se encontró stream en " + url);
        return null;

    } catch (error) {
        console.log("extractStreamUrl error: " + error);
        return null;
    }
}
