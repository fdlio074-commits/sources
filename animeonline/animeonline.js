// ============================================================
//  Módulo Sora — TioAnime (tioanime.com)
//  Idioma: Español (Sub)  |  Tipo: anime, shows, movies
//  Autor: generado con asistencia de Claude
// ============================================================

// ----- Helpers -----

function cleanText(str) {
    return str
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#\d+;/g, "")
        .trim();
}

// ----- 1. searchResults -----
// Input : HTML de https://tioanime.com/buscar?q=%s
// Output: [{title, image, href}]

function searchResults(html) {
    const results = [];
    const base = "https://tioanime.com";

    // Cada card de resultado tiene un <article> o un <li> con clase "anime"
    // Patrón real observado en el sitio: <li> con enlace a /anime/slug e img
    const cardRegex = /<li[^>]*>[\s\S]*?<a[^>]+href="(\/anime\/[^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>[\s\S]*?<\/li>/g;
    let match;

    while ((match = cardRegex.exec(html)) !== null) {
        const href  = base + match[1];
        const image = match[2].startsWith("http") ? match[2] : base + match[2];
        const title = cleanText(match[3]);
        if (title && href) {
            results.push({ title, image, href });
        }
    }

    // Fallback: patrón alternativo más simple
    if (results.length === 0) {
        const altRegex = /<a[^>]+href="(\/anime\/[^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<p[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/p>/g;
        while ((match = altRegex.exec(html)) !== null) {
            const href  = base + match[1];
            const image = match[2].startsWith("http") ? match[2] : base + match[2];
            const title = cleanText(match[3]);
            if (title && href) results.push({ title, image, href });
        }
    }

    return results;
}

// ----- 2. extractDetails -----
// Input : HTML de https://tioanime.com/anime/[slug]
// Output: [{description, aliases, airdate}]

function extractDetails(html) {
    const details = [];

    // Descripción — está en un <p> dentro del bloque de info
    const descMatch = html.match(/<p[^>]*class="[^"]*sinopsis[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
                   || html.match(/<div[^>]*class="[^"]*sinopsis[^"]*"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/i)
                   || html.match(/<p[^>]*itemprop="description"[^>]*>([\s\S]*?)<\/p>/i);
    const description = descMatch ? cleanText(descMatch[1].replace(/<[^>]+>/g, "")) : "Sin descripción disponible.";

    // Año / airdate — busca algo como "2020" o "Invierno 2022"
    const yearMatch = html.match(/(\d{4})\s*(?:Temporada|Season|<)/i)
                   || html.match(/<span[^>]*class="[^"]*year[^"]*"[^>]*>([^<]+)<\/span>/i)
                   || html.match(/TV\s+(\d{4})/i);
    const airdate = yearMatch ? yearMatch[1].trim() : "";

    // Titulo alternativo / aliases — suele estar en un <span> o <h2> con el nombre japonés
    const aliasMatch = html.match(/<h2[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h2>/i)
                    || html.match(/<span[^>]*class="[^"]*alt[^"]*"[^>]*>([^<]+)<\/span>/i)
                    || html.match(/<p[^>]*class="[^"]*alt[^"]*"[^>]*>([^<]+)<\/p>/i);
    const aliases = aliasMatch ? cleanText(aliasMatch[1]) : "";

    details.push({ description, aliases, airdate });
    return details;
}

// ----- 3. extractEpisodes -----
// Input : HTML de https://tioanime.com/anime/[slug]
// Output: [{href, number}]

function extractEpisodes(html) {
    const episodes = [];
    const base = "https://tioanime.com";

    // Los episodios están en una lista con links a /ver/[slug]-[num]
    const epRegex = /<a[^>]+href="(\/ver\/[^"]+)"[^>]*>[\s\S]*?(\d+)[\s\S]*?<\/a>/g;
    let match;
    const seen = new Set();

    while ((match = epRegex.exec(html)) !== null) {
        const href   = base + match[1];
        const number = match[2];

        // Extraer el número del final de la URL para mayor fiabilidad
        const numFromUrl = href.match(/-(\d+)$/);
        const epNum = numFromUrl ? numFromUrl[1] : number;

        if (!seen.has(href)) {
            seen.add(href);
            episodes.push({ href, number: epNum });
        }
    }

    // Ordenar de menor a mayor
    episodes.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
    return episodes;
}

// ----- 4. extractStreamUrl -----
// Input : HTML de https://tioanime.com/ver/[slug]-[num]
// Output: URL del stream (string) o null

function extractStreamUrl(html) {
    // TioAnime carga el player via iframe externo (biribup.com / otros)
    // El src del iframe principal se puede extraer así:
    const iframeRegex = /<iframe[^>]+src="(https?:\/\/[^"]+)"[^>]*>/gi;
    let match;
    const skipDomains = ["cuevadeana", "youtube", "google", "facebook", "disqus"];

    while ((match = iframeRegex.exec(html)) !== null) {
        const src = match[1];
        if (!skipDomains.some(d => src.includes(d))) {
            return src;
        }
    }

    // Fallback: buscar URL directa .m3u8 o .mp4
    const directMatch = html.match(/["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)['"]/i);
    if (directMatch) return directMatch[1];

    // Fallback: biribup widget ID → construir URL
    const biribupMatch = html.match(/https:\/\/biribup\.com\/full\?[^"']+/i);
    if (biribupMatch) return biribupMatch[0].replace(/&amp;/g, "&");

    return null;
}
