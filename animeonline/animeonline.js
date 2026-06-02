function searchResults(html) {
    const results = [];
    const baseUrl = "https://hentaila.com";

    // Cards de resultados: <article class="group/item relative text-body">
    // con <h3 class="...text-lead">TITULO</h3>
    // con <img ... src="https://cdn.hentaila.com/covers/ID.jpg">
    // con <a ... href="/media/slug">
    const itemRegex = /<article class="group\/item relative text-body"[\s\S]*?<\/article>/g;
    const items = html.match(itemRegex) || [];

    items.forEach((item) => {
        const titleMatch = item.match(/<h3[^>]*class="[^"]*text-lead[^"]*"[^>]*>([^<]+)<\/h3>/);
        const imgMatch = item.match(/src="(https:\/\/cdn\.hentaila\.com\/covers\/[^"]+)"/);
        const hrefMatch = item.match(/href="(\/media\/[^"\/]+)"[^>]*><span class="sr-only">/);

        const title = titleMatch ? titleMatch[1].trim() : '';
        const image = imgMatch ? imgMatch[1] : '';
        const href = hrefMatch ? baseUrl + hrefMatch[1] : '';

        if (title && href) {
            results.push({
                title: title,
                image: image,
                href: href
            });
        }
    });

    return results;
}

function extractDetails(html) {
    const details = [];

    // Descripción: <div class="entry line-clamp-4 ..."><p>TEXTO</p></div>
    const descMatch = html.match(/<div class="entry[^"]*"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/);
    let description = descMatch ? descMatch[1].trim() : '';

    // Año: <span>2025</span> dentro del header de info
    const yearMatch = html.match(/<span>(\d{4})<\/span>/);
    let airdate = yearMatch ? yearMatch[1] : '';

    // Tipo como alias: OVA, TV, etc
    const typeMatch = html.match(/<span>(OVA|TV|Movie|Pelicula)<\/span>/);
    let aliases = typeMatch ? typeMatch[1] : 'N/A';

    if (description) {
        details.push({
            description: description,
            aliases: aliases,
            airdate: airdate
        });
    }

    return details;
}

function extractEpisodes(html) {
    const episodes = [];
    const baseUrl = "https://hentaila.com";

    // Links de episodios: href="/media/slug/numero"
    const epRegex = /href="(\/media\/[^"\/]+\/(\d+))"/g;
    let match;
    const seen = new Set();

    while ((match = epRegex.exec(html)) !== null) {
        const path = match[1];
        const number = match[2];
        const href = baseUrl + path;

        if (seen.has(href)) continue;
        seen.add(href);

        episodes.push({
            href: href,
            number: number
        });
    }

    episodes.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));

    return episodes;
}

async function extractStreamUrl(html) {
    try {
        // Buscar iframe del reproductor embebido
        const iframeMatch = html.match(/src="(https?:\/\/(?!(?:cdn|www\.google|www\.facebook)[^"]*)[^"]+(?:embed|player|watch|stream)[^"]*)"/i);
        if (iframeMatch) {
            const embedUrl = iframeMatch[1].replace(/&amp;/g, '&');
            const response = await fetchv2(embedUrl, {
                'Referer': 'https://hentaila.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            });
            const embedHtml = await response.text();

            const m3u8 = embedHtml.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)['"]/);
            if (m3u8) return m3u8[1];

            const mp4 = embedHtml.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)['"]/);
            if (mp4) return mp4[1];
        }

        // Fallback: buscar m3u8 directo en el HTML
        const directM3u8 = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)['"]/);
        if (directM3u8) return directM3u8[1];

        return null;
    } catch (error) {
        return null;
    }
}
