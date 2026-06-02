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

        // Estructura real del sitio:
        // <article class='Anime alt B'>
        //   <a href='https://www.anime-jl.net/anime/1049/naruto-latino-v2'>
        //     <figure><img src='/storage/animes_tumbl/....jpg' alt='Título'></figure>
        //     <h3 class='Title'>Título</h3>
        //   </a>
        // </article>

        const articleRegex = /<article[^>]*class='Anime[^']*'[^>]*>([\s\S]*?)<\/article>/g;
        let articleMatch;

        while ((articleMatch = articleRegex.exec(html)) !== null) {
            const block = articleMatch[1];

            // Href: viene completo con el dominio
            const hrefMatch = block.match(/href='(https:\/\/www\.anime-jl\.net\/anime\/[^']+)'/);
            if (!hrefMatch) continue;
            const href = hrefMatch[1];

            // Título: <h3 class='Title'>Naruto Español Latino</h3>
            const titleMatch = block.match(/<h3[^>]*class='Title'[^>]*>([^<]+)<\/h3>/);
            if (!titleMatch) continue;
            const title = titleMatch[1].trim();

            // Imagen: src relativo /storage/...
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

        let description = "Sin descripción disponible.";
        const descMatch = html.match(/<div[^>]*class="[^"]*sinopsis[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
            || html.match(/<div[^>]*class='[^']*sinopsis[^']*'[^>]*>([\s\S]*?)<\/div>/i)
            || html.match(/<p[^>]*>([\s\S]{80,500}?)<\/p>/i);
        if (descMatch) {
            description = descMatch[1].replace(/<[^>]+>/g, "").trim();
        }

        let aliases = "";
        const aliasMatch = html.match(/titulo alterno[^<]*<[^>]*>([^<]+)/i);
        if (aliasMatch) aliases = aliasMatch[1].trim();

        let airdate = "Desconocido";
        const airMatch = html.match(/>(\d{4})<\/(?:span|td|li|p|strong)>/);
        if (airMatch) airdate = airMatch[1];

        return JSON.stringify([{
            description: description,
            aliases: aliases,
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

        const episodes = [];
        // Patrón: href='https://www.anime-jl.net/anime/1049/naruto-latino-v2/episodio-1'
        const epRegex = /href='(https:\/\/www\.anime-jl\.net\/anime\/[^']+\/episodio-(\d+))'/gi;
        const seen = new Set();
        let match;

        while ((match = epRegex.exec(html)) !== null) {
            const epHref = match[1];
            const epNum = parseInt(match[2]);
            if (seen.has(epHref)) continue;
            seen.add(epHref);
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
