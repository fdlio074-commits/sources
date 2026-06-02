function searchResults(html) {
    const results = [];

    const queryMatch = html.match(/search=([^&"<\s]+)/);
    const query = queryMatch ? decodeURIComponent(queryMatch[1]).toLowerCase() : '';

    const blockRegex = /!\[Portada de ([^\]]*)\]\((https:\/\/cdn\.hentaila\.com\/covers\/[^)]+)\)[\s\S]*?\[Ver [^\]]+\]\((https:\/\/hentaila\.com\/media\/[^)\s]+)\)/g;

    let match;
    while ((match = blockRegex.exec(html)) !== null) {
        const title = match[1].trim();
        const image = match[2].trim();
        const href = match[3].trim();

        if (title && href && !/\/\d+$/.test(href)) {
            if (!query || title.toLowerCase().includes(query)) {
                results.push({ title, image, href });
            }
        }
    }

    return results;
}

function extractDetails(html) {
    const details = [];

    // Leer del objeto SvelteKit embebido en el HTML
    const synopsisMatch = html.match(/synopsis:"([\s\S]*?)"/);
    let description = synopsisMatch ? synopsisMatch[1].replace(/\\n/g, ' ').trim() : '';

    const yearMatch = html.match(/startDate:"(\d{4})/);
    let airdate = yearMatch ? yearMatch[1] : '';

    const typeMatch = html.match(/category:\{[^}]*name:"([^"]+)"/);
    let aliases = typeMatch ? typeMatch[1] : 'N/A';

    // Fallback si no viene el objeto SvelteKit
    if (!description) {
        const descMatch = html.match(/\b(OVA|TV|Movie|Pelicula)\b[\s\S]*?\n\n([^\n!#\[]{30,})/);
        description = descMatch ? descMatch[2].trim() : '';
    }

    if (description) {
        details.push({ description, aliases, airdate });
    }

    return details;
}

function extractEpisodes(html) {
    const episodes = [];
    const baseUrl = "https://hentaila.com";

    // Leer slug y episodios del objeto SvelteKit
    const slugMatch = html.match(/slug:"([^"]+)"/);
    const slug = slugMatch ? slugMatch[1] : null;

    if (slug) {
        const episodesMatch = html.match(/episodes:\[([^\]]+)\]/);
        if (episodesMatch) {
            const epRegex = /\{id:\d+,number:(\d+)\}/g;
            let match;
            while ((match = epRegex.exec(episodesMatch[1])) !== null) {
                episodes.push({
                    href: `${baseUrl}/media/${slug}/${match[1]}`,
                    number: match[1]
                });
            }
        }
    }

    // Fallback: links del HTML
    if (episodes.length === 0) {
        const epRegex = /href="(\/media\/[^"\/]+\/(\d+))"/g;
        let match;
        const seen = new Set();
        while ((match = epRegex.exec(html)) !== null) {
            const href = baseUrl + match[1];
            if (seen.has(href)) continue;
            seen.add(href);
            episodes.push({ href, number: match[2] });
        }
    }

    episodes.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
    return episodes;
}

async function extractStreamUrl(html) {
    try {
        // Extraer URL del servidor VIP desde el objeto SvelteKit
        const embedsMatch = html.match(/embeds:\{SUB:\[([^\]]+)\]/);
        if (embedsMatch) {
            const vipMatch = embedsMatch[1].match(/server:"VIP",url:"([^"]+)"/);
            if (vipMatch) {
                const embedUrl = vipMatch[1].replace(/\\u002F/g, '/');
                const response = await fetchv2(embedUrl, {
                    'Referer': 'https://hentaila.com/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                });
                const embedHtml = await response.text();

                const m3u8 = embedHtml.match(/["'`](https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*)['"` ]/);
                if (m3u8) return m3u8[1];

                const mp4 = embedHtml.match(/["'`](https?:\/\/[^"'`\s]+\.mp4[^"'`\s]*)['"` ]/);
                if (mp4) return mp4[1];
            }
        }

        // Fallback: iframe visible en el HTML
        const iframeMatch = html.match(/src="(https:\/\/cdn\.hvidserv\.com\/play\/[^"]+)"/);
        if (iframeMatch) {
            const response = await fetchv2(iframeMatch[1], {
                'Referer': 'https://hentaila.com/',
                'User-Agent': 'Mozilla/5.0'
            });
            const embedHtml = await response.text();

            const m3u8 = embedHtml.match(/["'`](https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*)['"` ]/);
            if (m3u8) return m3u8[1];

            const mp4 = embedHtml.match(/["'`](https?:\/\/[^"'`\s]+\.mp4[^"'`\s]*)['"` ]/);
            if (mp4) return mp4[1];
        }

        return null;
    } catch (e) {
        return null;
    }
}
