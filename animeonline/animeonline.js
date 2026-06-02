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
        const response = await fetchv2(url);
        const html = await response.text();

        const htmlLen = html ? html.length : 0;

        if (htmlLen < 1000) {
            console.log("extractEpisodes: HTML bloqueado, largo=" + htmlLen);
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
    const urlMatch = url.match(/\/anime\/(\d+)\/([^\/]+)/);
    let animeId = urlMatch ? urlMatch[1] : null;
    let animeSlug = urlMatch ? urlMatch[2] : null;

    const animeInfoMatch = html.match(/var anime_info\s*=\s*\["(\d+)","[^"]*","([^"]+)"/);
    if (animeInfoMatch) {
        animeId = animeInfoMatch[1];
        animeSlug = animeInfoMatch[2];
    }

    if (!animeId || !animeSlug) {
        console.log("extractEpisodes: no se pudo obtener animeId/animeSlug");
        return JSON.stringify([]);
    }

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
            "Referer": "https://www.anime-jl.net/",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        });
        const html = await response.text();

        // 1. Buscar m3u8 directo en el HTML principal
        const directM3u8 = html.match(/https?:\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?/i);
        if (directM3u8) return directM3u8[0];

        // 2. Recolectar todos los iframes
        const iframeRegex = /<iframe[^>]+src=['"]([^'"]+)['"]/gi;
        let iframeMatch;
        const iframes = [];

        while ((iframeMatch = iframeRegex.exec(html)) !== null) {
            let src = iframeMatch[1];
            if (src.startsWith("//")) src = "https:" + src;
            if (src.startsWith("http")) iframes.push(src);
        }

        // También buscar data-src de reproductores conocidos
        const dataSrcRegex = /data-src=['"]([^'"]*(?:streamwish|filemoon|dood|voe|streamtape)[^'"]*)['"]|data-video=['"]([^'"]+)['"]/gi;
        let dsMatch;
        while ((dsMatch = dataSrcRegex.exec(html)) !== null) {
            let src = dsMatch[1] || dsMatch[2];
            if (!src) continue;
            if (src.startsWith("//")) src = "https:" + src;
            if (src.startsWith("http")) iframes.push(src);
        }

        // 3. Iterar cada iframe buscando el stream
        for (const iframeUrl of iframes) {
            try {
                const iframeResp = await fetchv2(iframeUrl, {
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
                    "Referer": "https://www.anime-jl.net/",
                    "Origin": "https://www.anime-jl.net"
                });
                const iframeHtml = await iframeResp.text();

                // m3u8 directo
                const m3u8 = iframeHtml.match(/https?:\/\/[^\s"'\\>]+\.m3u8(?:\?[^\s"'\\>]*)?/i);
                if (m3u8) return m3u8[0];

                // JSON embebido: "file":"url"
                const fileJson = iframeHtml.match(/['"](?:file|src)['"]\s*:\s*['"](https?:\/\/[^'"]+\.(?:m3u8|mp4)[^'"]*)['"]/i);
                if (fileJson) return fileJson[1];

                // jwplayer setup sources
                const jwMatch = iframeHtml.match(/sources\s*:\s*\[\s*\{[^}]*file\s*:\s*['"]([^'"]+)['"]/i);
                if (jwMatch) return jwMatch[1];

                // mp4 como fallback
                const mp4 = iframeHtml.match(/https?:\/\/[^\s"'\\>]+\.mp4(?:\?[^\s"'\\>]*)?/i);
                if (mp4) return mp4[0];

            } catch (iframeError) {
                console.log("iframe fetch error: " + iframeUrl + " — " + iframeError);
            }
        }

        // 4. Último intento: buscar en el HTML principal con patrón file/src JSON
        const fileMatch2 = html.match(/['"](?:file|src)['"]\s*:\s*['"](https?:\/\/[^'"]+\.(?:m3u8|mp4)[^'"]*)['"]/i);
        if (fileMatch2) return fileMatch2[1];

        console.log("extractStreamUrl: no se encontró stream en " + url);
        return null;

    } catch (error) {
        console.log("extractStreamUrl error: " + error);
        return null;
    }
}
