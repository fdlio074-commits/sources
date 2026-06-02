// ============================================================
//  Módulo Sora — TioAnime (tioanime.com)
//  Autor: Fdlio
//  Idioma: Español (Sub)  |  Tipo: anime
// ============================================================

function cleanText(str) {
    return str
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#\d+;/g, "")
        .replace(/<[^>]+>/g, "")
        .trim();
}

// ----- 1. searchResults -----
// Input : HTML de https://tioanime.com/buscar?q=%s
// Output: [{title, image, href}]

function searchResults(html) {
    const results = [];
    const base = "https://tioanime.com";

    // Patrón principal: lista de animes en resultados de búsqueda
    const cardRegex = /<article[^>]*>[\s\S]*?<a[^>]+href="(\/anime\/[^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<\/a>[\s\S]*?<a[^>]+href="\/anime\/[^"]+"[^>]*>([^<]+)<\/a>[\s\S]*?<\/article>/g;
    let match;

    while ((match = cardRegex.exec(html)) !== null) {
        const href  = base + match[1];
        const image = match[2].startsWith("http") ? match[2] : base + match[2];
        const title = cleanText(match[3]);
        if (title && href) results.push({ title, image, href });
    }

    // Fallback 1: <li> con enlace a /anime/
    if (results.length === 0) {
        const liRegex = /<li[^>]*>[\s\S]*?<a[^>]+href="(\/anime\/[^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>[\s\S]*?<\/li>/g;
        while ((match = liRegex.exec(html)) !== null) {
            const href  = base + match[1];
            const image = match[2].startsWith("http") ? match[2] : base + match[2];
            const title = cleanText(match[3]);
            if (title && href) results.push({ title, image, href });
        }
    }

    // Fallback 2: patrón genérico href + img + título
    if (results.length === 0) {
        const genRegex = /<a[^>]+href="(\/anime\/[^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<p[^>]*>([^<]+)<\/p>/g;
        while ((match = genRegex.exec(html)) !== null) {
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

    // Descripción
    const descMatch =
        html.match(/<p[^>]*class="[^"]*sinopsis[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
        html.match(/<div[^>]*class="[^"]*sinopsis[^"]*"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/i) ||
        html.match(/<p[^>]*itemprop="description"[^>]*>([\s\S]*?)<\/p>/i) ||
        html.match(/<div[^>]*class="[^"]*descripcion[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const description = descMatch
        ? cleanText(descMatch[1])
        : "Sin descripción disponible.";

    // Año de emisión
    const yearMatch =
        html.match(/TV\s+(\d{4})/) ||
        html.match(/(\d{4})\s*(?:Temporada|Season)/) ||
        html.match(/<span[^>]*class="[^"]*year[^"]*"[^>]*>([^<]+)<\/span>/i);
    const airdate = yearMatch ? yearMatch[1].trim() : "";

    // Título alternativo / alias (nombre japonés u otro)
    const aliasMatch =
        html.match(/<h2[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h2>/i) ||
        html.match(/<span[^>]*class="[^"]*alt[^"]*"[^>]*>([^<]+)<\/span>/i) ||
        html.match(/<p[^>]*class="[^"]*alt[^"]*"[^>]*>([^<]+)<\/p>/i);
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
    const seen = new Set();

    // Patrón principal: links a /ver/[slug]-[numero]
    const epRegex = /href="(\/ver\/[^"]+)"/g;
    let match;

    while ((match = epRegex.exec(html)) !== null) {
        const path = match[1];
        const href = base + path;

        if (seen.has(href)) continue;
        seen.add(href);

        // Extraer número del final de la URL: /ver/nombre-del-anime-12 → 12
        const numMatch = path.match(/-(\d+(?:\.\d+)?)$/);
        const number = numMatch ? numMatch[1] : null;

        if (number) {
            episodes.push({ href, number });
        }
    }

    // Ordenar de menor a mayor episodio
    episodes.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
    return episodes;
}

// ----- 4. extractStreamUrl -----
// Input : HTML de https://tioanime.com/ver/[slug]-[num]
// Output: URL del stream (string) o null

function extractStreamUrl(html) {
    // Dominios a ignorar (banners, redes sociales, etc.)
    const skipDomains = [
        "cuevadeana", "youtube", "google", "facebook",
        "disqus", "twitter", "googleapis", "gstatic"
    ];

    // 1. Buscar iframe de reproductor
    const iframeRegex = /<iframe[^>]+src="(https?:\/\/[^"]+)"[^>]*>/gi;
    let match;
    while ((match = iframeRegex.exec(html)) !== null) {
        const src = match[1];
        if (!skipDomains.some(d => src.includes(d))) {
            return src;
        }
    }

    // 2. Buscar stream directo .m3u8
    const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)['"]/i);
    if (m3u8Match) return m3u8Match[1];

    // 3. Buscar stream directo .mp4
    const mp4Match = html.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)['"]/i);
    if (mp4Match) return mp4Match[1];

    // 4. Fallback: URL biribup (player embebido de TioAnime)
    const biribupMatch = html.match(/(https:\/\/biribup\.com\/full\?[^"'<\s]+)/i);
    if (biribupMatch) return biribupMatch[1].replace(/&amp;/g, "&");

    return null;
}
