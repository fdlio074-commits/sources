// ============================================================
//  Módulo Sora — AnimeJL (anime-jl.net)
//  Autor: fdlio074
//  Repo: https://github.com/fdlio074-commits/sources
//  Modo: asyncJS = true | Idioma: Español Latino
// ============================================================

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
        const articleRegex = /<article[^>]*class='Anime[^']*'[^>]*>([\s\S]*?)<\/article>/g;
        let articleMatch;

        while ((articleMatch = articleRegex.exec(html)) !== null) {
            const block = articleMatch[1];
            const hrefMatch = block.match(/href='(https:\/\/www\.anime-jl\.net\/anime\/[^']+)'/);
            if (!hrefMatch) continue;
            const href = hrefMatch[1];
            const titleMatch = block.match(/<h3[^>]*class='Title'[^>]*>([^<]+)<\/h3>/);
            if (!titleMatch) continue;
            const title = titleMatch[1].trim();
            const imgMatch = block.match(/<img[^>]+src='([^']+)'/);
            let image = imgMatch ? imgMatch[1] : "";
            if (image.startsWith("/")) image = "https://www.anime-jl.net" + image;
            results.push({ title: title, image: image, href: href });
        }

        return JSON.stringify(results);
    } catch (error) {
        console.log("searchResults error: " + error);
        return JSON.stringify([]);
    }
}

async function extractDetails(url) {
    try {
        const response = await fetchv2(url, {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.anime-jl.net/"
        });
        const html = await response.text();

        let description = "Sin descripción disponible.";
        const descMatch = html.match(/<div[^>]*class="Description"[^>]*>([\s\S]*?)<\/div>/i);
        if (descMatch) description = descMatch[1].replace(/<[^>]+>/g, "").trim();

        const aliases = [];
        const aliasRegex = /<span[^>]*class='TxtAlt'[^>]*>([^<]+)<\/span>/g;
        let aliasMatch;
        while ((aliasMatch = aliasRegex.exec(html)) !== null) {
            const val = aliasMatch[1].trim();
            if (val) aliases.push(val);
        }

        let airdate = "Desconocido";
        const yearMatch = html.match(/published_time.*?(\d{4})/);
        if (yearMatch) airdate = yearMatch[1];

        return JSON.stringify([{
            description: description,
            aliases: aliases.join(", "),
            airdate: airdate
        }]);
    } catch (error) {
        console.log("extractDetails error: " + error);
        return JSON.stringify([{ description: "Error al cargar.", aliases: "", airdate: "Desconocido" }]);
    }
}

async function extractEpisodes(url) {
    try {
        // Intentar el fetch sin headers primero
        const response = await fetchv2(url);
        const html = await response.text();

        const htmlLen = html ? html.length : 0;

        // Si el HTML es muy corto, el sitio bloqueó el request
        if (htmlLen < 1000) {
            console.log("extractEpisodes: HTML bloqueado, largo=" + htmlLen);
            // Intentar con headers
            const response2 = await fetchv2(url, {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "es-ES,es;q=0.9",
                "Referer": "https://www.anime-jl.net/"
            });
            const html2 = await response2.text();
            return extractEpisodesFromHtml(html2, url);
        }

        return extractEpisodesFromHtml(html, url);

    } catch (error) {
        console.log("extractEpisodes error: " + error);
        return JSON.stringify([]);
    }
}

function extractEpisodesFromHtml(html, url) {
    // Extraer id y slug directamente de la URL como fallback
    // URL: https://www.anime-jl.net/anime/1049/naruto-latino-v2
    const urlMatch = url.match(/\/anime\/(\d+)\/([^\/]+)/);
    let animeId = urlMatch ? urlMatch[1] : null;
    let animeSlug = urlMatch ? urlMatch[2] : null;

    // También intentar desde el HTML
    const animeInfoMatch = html.match(/var anime_info\s*=\s*\["(\d+)","[^"]*","([^"]+)"/);
    if (animeInfoMatch) {
        animeId = animeInfoMatch[1];
        animeSlug = animeInfoMatch[2];
    }

    if (!animeId || !animeSlug) {
        console.log("extractEpisodes: no se pudo obtener animeId/animeSlug");
        return JSON.stringify([]);
    }

    // Extraer episodios con regex simple sobre cada par [número, "episodio-N"]
    const epRegex = /\[(\d+),"(episodio-\d+)"/g;
    const episodes = [];
    const seen = new Set();
    let epMatch;

    while ((epMatch = epRegex.exec(html)) !== null) {
        const epNum = parseInt(epMatch[1]);
        const epSlug = epMatch[2];
        if (seen.has(epNum)) continue;
        seen.add(epNum);
        episodes.push({
            href: "https://www.anime-jl.net/anime/" + animeId + "/" + animeSlug + "/" + epSlug,
            number: epNum
        });
    }

    episodes.sort((a, b) => a.number - b.number);
    return JSON.stringify(episodes);
}

async function extractStreamUrl(url) {
    try {
        const response = await fetchv2(url, {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.anime-jl.net/"
        });
        const html = await response.text();

        const m3u8Match = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
        if (m3u8Match) return m3u8Match[0];

        const mp4Match = html.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i);
        if (mp4Match) return mp4Match[0];

        const iframeMatch = html.match(/<iframe[^>]+src=['"]([^'"]+)['"]/i);
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

        const fileMatch2 = html.match(/["'](?:file|src)["']\s*:\s*["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        if (fileMatch2) return fileMatch2[1];

        return null;
    } catch (error) {
        console.log("extractStreamUrl error: " + error);
        return null;
    }
}
