function searchResults(html) {
    const results = [];
    const seen = new Set();

    // Buscar en divs con clase de contenedor de resultados (anime-item, result, card, etc.)
    const containerRegex = /<div[^>]*class="[^"]*(?:anime-item|result|contenedor|card|item)[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
    let containerMatch;

    while ((containerMatch = containerRegex.exec(html)) !== null) {
        const container = containerMatch[0];

        // Extraer imagen
        const imgRegex = /<img[^>]*src="([^"]+)"[^>]*>/i;
        const imgMatch = container.match(imgRegex);
        const image = imgMatch ? imgMatch[1].trim() : '';

        // Extraer enlace
        const linkRegex = /<a[^>]*href="(https:\/\/animeav1\.com\/(?:anime|pelicula)\/[^"]+)"[^>]*>/i;
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
        const linkRegex = /<a[^>]*href="(https:\/\/animeav1\.com\/(?:anime|pelicula)\/[^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/a>/gi;
        while ((containerMatch = linkRegex.exec(html)) !== null) {
            const href = containerMatch[1].trim();
            const image = containerMatch[2].trim();
            const titleMatch = html.match(new RegExp(`\\[([^\\[\\]]+)\\]\\(${href.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\`));
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

    // Buscar tipo (Anime, Película, OVA, etc.)
    let aliases = 'Anime';
    const typeRegex = /(Anime|Película|OVA|Especial|Película|Pelicula)/i;
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
    const epRegex = /<a[^>]*href="(https:\/\/animeav1\.com\/(?:anime|ver)\/[^"]+\/(?:ep|capitulo|episodio)[-\\d]+)"[^>]*>[\s\S]*?<\/a>/gi;
    let match;

    while ((match = epRegex.exec(html)) !== null) {
        const href = match[1];

        // Extraer número de episodio de la URL
        const epNumRegex = /(?:ep|capitulo|episodio)[-\\s]*(\d+)/i;
        const epNumMatch = href.match(epNumRegex);
        const epNum = epNumMatch ? epNumMatch[1] : '1';

        if (seen.has(href)) continue;
        seen.add(href);

        episodes.push({
            href,
            number: String(epNum)
        });
    }

    // Si no encuentra con regex de enlace, buscar en divs o spans con número de episodio
    if (episodes.length === 0) {
        const epDivRegex = /<(?:div|span)[^>]*class="[^"]*(?:episodio|ep|capitulo)[^"]*"[^>]*>[\s\S]*?<a[^>]*href="(https:\/\/animeav1\.com\/(?:anime|ver)\/[^"]+\/(?:ep|capitulo|episodio)[-\\d]+)"[^>]*>/gi;
        while ((match = epDivRegex.exec(html)) !== null) {
            const href = match[1];
            const epNumRegex = /(?:ep|capitulo|episodio)[-\\s]*(\d+)/i;
            const epNumMatch = href.match(epNumRegex);
            const epNum = epNumMatch ? epNumMatch[1] : '1';

            if (seen.has(href)) continue;
            seen.add(href);

            episodes.push({
                href,
                number: String(epNum)
            });
        }
    }

    return episodes;
}

async function extractStreamUrl(html) {
    try {
        // Buscar URL de stream directamente en iframes o scripts
        const iframeRegex = /<iframe[^>]*src="([^"]+)"[^>]*><\/iframe>/i;
        const iframeMatch = html.match(iframeRegex);
        if (iframeMatch) {
            const iframeSrc = iframeMatch[1];
            // Si el iframe apunta a un reproductor, intenta obtener el stream
            if (iframeSrc.includes('player') || iframeSrc.includes('embed')) {
                const iframeResponse = await fetchv2(iframeSrc, {
                    'Referer': 'https://animeav1.com/'
                });
                const iframeHtml = await iframeResponse.text();
                
                // Buscar m3u8 en el iframe
                const m3u8Iframe = iframeHtml.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
                if (m3u8Iframe) return m3u8Iframe[1];
            }
        }

        // Buscar m3u8 directo en el HTML
        const m3u8Regex = /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i;
        const m3u8Match = html.match(m3u8Regex);
        if (m3u8Match) return m3u8Match[1];

        // Buscar URL de embed
        const embedUrl = html.match(/["'](https?:\/\/[^"']+(?:embed|player|watch)[^"']*)["']/i);
        if (embedUrl) {
            const embedResponse = await fetchv2(embedUrl[1], {
                'Referer': 'https://animeav1.com/'
            });
            const embedHtml = await embedResponse.text();
            const m3u8Embed = embedHtml.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
            if (m3u8Embed) return m3u8Embed[1];
        }

        return null;
    } catch (e) {
        return null;
    }
}
