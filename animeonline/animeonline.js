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
            if (image.startsWith("/")) {
                image = "https://www.anime-jl.net" + image;
            }

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

        // Descripción: <div class="Description" ...><p><p>texto...</p></p></div>
        let description = "Sin descripción disponible.";
        const descMatch = html.match(/<div[^>]*class="Description"[^>]*>([\s\S]*?)<\/div>/i);
        if (descMatch) {
            description = descMatch[1].replace(/<[^>]+>/g, "").trim();
        }

        // Alias: span class TxtAlt
        const aliases = [];
        const aliasRegex = /<span[^>]*class='TxtAlt'[^>]*>([^<]+)<\/span>/g;
        let aliasMatch;
        while ((aliasMatch = aliasRegex.exec(html)) !== null) {
            const val = aliasMatch[1].trim();
            if (val) aliases.push(val);
        }

        // Año: de la meta published_time
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
        const response = await fetchv2(url, {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.anime-jl.net/"
        });
        const html = await response.text();

        // Los episodios están en una variable JS:
        // var anime_info = ["1049","Naruto Español Latino","naruto-latino-v2","","Anime"];
        // var episodes = [[226,"episodio-226","cover.jpg",""],[225,...], ...];

        // Extraer anime_info para obtener el id y slug
        const animeInfoMatch = html.match(/var anime_info\s*=\s*\[([^\]]+)\]/);
        if (!animeInfoMatch) return JSON.stringify([]);

        const parts = animeInfoMatch[1].match(/"([^"]*)"/g);
        if (!parts || parts.length < 3) return JSON.stringify([]);

        const animeId = parts[0].replace(/"/g, "");   // "1049"
        const animeSlug = parts[2].replace(/"/g, ""); // "naruto-latino-v2"

        // Extraer el array episodes completo
        const episodesMatch = html.match(/var episodes\s*=\s*(\[\[[\s\S]*?\]\])\s*;/);
        if (!episodesMatch) return JSON.stringify([]);

        const episodesRaw = episodesMatch[1];

        // Cada entrada: [226,"episodio-226","cover.jpg",""]
        const epRegex = /\[(\d+),"(episodio-\d+)","([^"]*)"[^\]]*\]/g;
        const episodes = [];
        const seen = new Set();
        let epMatch;

        while ((epMatch = epRegex.exec(episodesRaw)) !== null) {
            const epNum = parseInt(epMatch[1]);
            const epSlug = epMatch[2]; // "episodio-226"

            if (seen.has(epNum)) continue;
            seen.add(epNum);

            const epHref = "https://www.anime-jl.net/anime/" + animeId + "/" + animeSlug + "/" + epSlug;
            episodes.push({ href: epHref, number: epNum });
        }

        episodes.sort((a, b) => a.number - b.number);
        return JSON.stringify(episodes);

    } catch (error) {
        console.log("extractEpisodes error: " + error);
        return JSON.stringify([]);
    }
}

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

        // Intento 3: iframe externo
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

        // Intento 4: "file":"..." en la página
        const fileMatch2 = html.match(/["'](?:file|src)["']\s*:\s*["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        if (fileMatch2) return fileMatch2[1];

        console.log("extractStreamUrl: no se encontró stream en " + url);
        return null;

    } catch (error) {
        console.log("extractStreamUrl error: " + error);
        return null;
    }
}
