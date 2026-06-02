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

        let description = "Sin descripción disponible.";
        const descMatch = html.match(/<div[^>]*class="Description"[^>]*>([\s\S]*?)<\/div>/i);
        if (descMatch) {
            description = descMatch[1].replace(/<[^>]+>/g, "").trim();
        }

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
        const response = await fetchv2(url, {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.anime-jl.net/"
        });
        const html = await response.text();

        // Buscar la línea que tiene anime_info con datos reales (no la vacía "")
        // Patrón: var anime_info = ["1049","Naruto...","naruto-latino-v2",...];
        const animeInfoMatch = html.match(/var anime_info\s*=\s*\["(\d+)","([^"]+)","([^"]+)"/);
        if (!animeInfoMatch) {
            console.log("extractEpisodes: no se encontró anime_info con datos");
            return JSON.stringify([]);
        }

        const animeId   = animeInfoMatch[1]; // "1049"
        const animeSlug = animeInfoMatch[3]; // "naruto-latino-v2"

        // Buscar el array episodes — termina con ],]; así que usamos un regex más flexible
        const episodesMatch = html.match(/var episodes\s*=\s*(\[[\s\S]*?\],?\])\s*;/);
        if (!episodesMatch) {
            console.log("extractEpisodes: no se encontró el array episodes");
            return JSON.stringify([]);
        }

        const episodesRaw = episodesMatch[1];

        // Cada entrada: [226,"episodio-226","cover.jpg",""]
        const epRegex = /\[(\d+),"(episodio-\d+)"/g;
        const episodes = [];
        const seen = new Set();
        let epMatch;

        while ((epMatch = epRegex.exec(episodesRaw)) !== null) {
            const epNum  = parseInt(epMatch[1]);
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

    } catch (error) {
        console.log("extractEpisodes error: " + error);
        return JSON.stringify([]);
    }
}

async function extractEpisodes(url) {
    try {
        const response = await fetchv2(url, {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.anime-jl.net/"
        });
        const html = await response.text();

        // Devolver los primeros 500 caracteres del HTML para ver qué llega
        const snippet = html.substring(0, 500);
        
        // Buscar si existe "anime_info" en el html
        const hasAnimeInfo = html.indexOf("anime_info") !== -1 ? "SI tiene anime_info" : "NO tiene anime_info";
        const hasEpisodes = html.indexOf("var episodes") !== -1 ? "SI tiene var episodes" : "NO tiene var episodes";
        const htmlLength = "largo del html: " + html.length;

        // Retornar como un episodio de diagnóstico
        return JSON.stringify([{
            href: "https://www.anime-jl.net",
            number: 0,
            title: hasAnimeInfo + " | " + hasEpisodes + " | " + htmlLength
        }]);

    } catch (error) {
        return JSON.stringify([{ href: "error", number: 0, title: "ERROR: " + error }]);
    }
}
