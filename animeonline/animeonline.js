function searchResults(html) {
    const results = [];
    const seen = new Set();

    // Buscar en divs con clase de contenedor de resultados
    const containerRegex = /<div[^>]*class="[^"]*(?:item|resultado|contenedor|card)[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
    let containerMatch;

    while ((containerMatch = containerRegex.exec(html)) !== null) {
        const container = containerMatch[0];

        // Extraer imagen
        const imgRegex = /<img[^>]*src="([^"]+)"[^>]*>/i;
        const imgMatch = container.match(imgRegex);
        const image = imgMatch ? imgMatch[1].trim() : '';

        // Extraer enlace
        const linkRegex = /<a[^>]*href="(https:\/\/sololatino\.net\/(?:serie|pelicula)\/[^"]+)"[^>]*>/i;
        const linkMatch = container.match(linkRegex);
        const href = linkMatch ? linkMatch[1].trim() : '';

        // Extraer título
        const titleRegex = /<(?:h[1-6]|span|div)[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/(?:h[1-6]|span|div)>/i;
        const titleMatch = container.match(titleRegex);
        let title = titleMatch ? titleMatch[1].trim() : '';

        // Si no hay título en clase especial, buscar en el texto del enlace
        if (!title) {
            const titleFromLink = container.match(/<a[^>]*href="[^"]*"[^>]*>([^<]+)<\/a>/i);
            title = titleFromLink ? titleFromLink[1].trim() : '';
        }

        if (href && title && !seen.has(href)) {
            seen.add(href);
            results.push({ title, image, href });
        }
    }

    // Si no encuentra con contenedores, intentar con enlaces directos
    if (results.length === 0) {
        const linkRegex = /<a[^>]*href="(https:\/\/sololatino\.net\/(?:serie|pelicula)\/[^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/a>/gi;
        while ((containerMatch = linkRegex.exec(html)) !== null) {
            const href = containerMatch[1].trim();
            const image = containerMatch[2].trim();
            const titleMatch = html.match(new RegExp(`\\[([^\\[\\]]+)\\]\\(${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`));
            const title = titleMatch ? titleMatch[1].trim() : href.split('/').pop();

            if (href && title && !seen.has(href)) {
                seen.add(href);
                results.push({ title, image, href });
            }
        }
    }

    return results;
}

function extractDetails(html) {
    const details = [];

    // Buscar descripción en múltiples patrones
    let description = '';
    const descRegex1 = /<meta\s+name="description"\s+content="([^"]+)"/i;
    const descMatch1 = html.match(descRegex1);
    if (descMatch1) description = descMatch1[1].replace(/\.\.\.$/, '').trim();

    if (!description) {
        const descRegex2 = /<p[^>]*class="[^"]*descripcion?[^"]*"[^>]*>([^<]+)<\/p>/i;
        const descMatch2 = html.match(descRegex2);
        if (descMatch2) description = descMatch2[1].trim();
    }

    if (!description) {
        const descRegex3 = /<div[^>]*class="[^"]*sinopsis[^"]*"[^>]*>([^<]+)<\/div>/i;
        const descMatch3 = html.match(descRegex3);
        if (descMatch3) description = descMatch3[1].trim();
    }

    // Buscar año
    let airdate = '';
    const yearRegex = /(\d{4})/;
    const yearMatch = html.match(yearRegex);
    if (yearMatch) airdate = yearMatch[1];

    // Buscar tipo (Anime, Serie, Película, Dorama)
    let aliases = 'N/A';
    const typeRegex = /(Anime|Serie|Película|Dorama|Pelicula)/i;
    const typeMatch = html.match(typeRegex);
    if (typeMatch) aliases = typeMatch[1];

    if (description || airdate || aliases !== 'N/A') {
        details.push({ description, aliases, airdate });
    }

    return details;
}

function extractEpisodes(html) {
    const episodes = [];
    const seen = new Set();

    // Buscar patrón de episodios en enlaces
    const epRegex = /<a[^>]*href="(https:\/\/sololatino\.net\/(?:serie|pelicula)\/[^\/]+\/temporada-(\d+)\/episodio-(\d+))"[^>]*>[\s\S]*?<\/a>/gi;
    let match;

    while ((match = epRegex.exec(html)) !== null) {
        const href = match[1];
        const season = match[2];
        const epNum = match[3];

        if (seen.has(href)) continue;
        seen.add(href);

        episodes.push({
            href,
            number: String((parseInt(season) - 1) * 1000 + parseInt(epNum))
        });
    }

    // Si no encuentra con regex de enlace, buscar en divs o spans con número de episodio
    if (episodes.length === 0) {
        const epDivRegex = /<(?:div|span)[^>]*class="[^"]*episodio[^"]*"[^>]*>[\s\S]*?<a[^>]*href="(https:\/\/sololatino\.net\/(?:serie|pelicula)\/[^\/]+\/temporada-(\d+)\/episodio-(\d+))"[^>]*>/gi;
        while ((match = epDivRegex.exec(html)) !== null) {
            const href = match[1];
            const season = match[2];
            const epNum = match[3];

            if (seen.has(href)) continue;
            seen.add(href);

            episodes.push({
                href,
                number: String((parseInt(season) - 1) * 1000 + parseInt(epNum))
            });
        }
    }

    return episodes;
}

async function extractStreamUrl(html) {
    try {
        // Buscar CSRF token en meta tags
        const csrfRegex = /<meta[^>]*name="csrf-token"[^>]*content="([^"]+)"/i;
        const csrfMatch = html.match(csrfRegex);
        const csrf = csrfMatch ? csrfMatch[1].trim() : '';

        // Buscar URL canónica para serie/episodio
        const canonicalRegex = /<link[^>]*rel="canonical"[^>]*href="https:\/\/sololatino\.net\/(?:serie|pelicula)\/([^\/]+)(?:\/temporada-(\d+))?(?:\/episodio-(\d+))?"[^>]*>/i;
        const canonicalMatch = html.match(canonicalRegex);
        
        if (!canonicalMatch) return null;

        const slug = canonicalMatch[1];
        const season = canonicalMatch[2] || '1';
        const episode = canonicalMatch[3];

        // Si es una película, no necesita temporada/episodio
        if (!episode) {
            // Es película, buscar stream directamente
            const movieStreamRegex = /["'](https?:\/\/[^"']+\.m3u8[^"']*)['"]/;
            const movieStream = html.match(movieStreamRegex);
            if (movieStream) return movieStream[1];
        }

        // Para series, usar API
        const apiUrl = `https://sololatino.net/api/episode?serie=${slug}&temporada=${season}&episodio=${episode}`;
        const response = await fetchv2(apiUrl, {
            'Referer': `https://sololatino.net/serie/${slug}/temporada-${season}/episodio-${episode}`,
            'X-CSRF-TOKEN': csrf,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0'
        });
        const data = await response.text();

        // Buscar m3u8 en respuesta
        const m3u8 = data.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)['"]/);
        if (m3u8) return m3u8[1];

        // Buscar URL embed como alternativa
        const embedUrl = data.match(/["'](https?:\/\/[^"']+(?:embed|player|watch)[^"']*)['"]/);
        if (embedUrl) {
            const embedResponse = await fetchv2(embedUrl[1], {
                'Referer': 'https://sololatino.net/'
            });
            const embedHtml = await embedResponse.text();
            const m3u8Embed = embedHtml.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)['"]/);
            if (m3u8Embed) return m3u8Embed[1];
        }

        return null;
    } catch (e) {
        return null;
    }
}
