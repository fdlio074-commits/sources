function searchResults(html) {
    const results = [];
    const baseUrl = "https://tioanime.com";

    // Cada card de búsqueda es un <li> con <a href="/anime/slug"> + <img> + <p class="title">
    const itemRegex = /<li[\s\S]*?<\/li>/g;
    const items = html.match(itemRegex) || [];

    items.forEach((item) => {
        const hrefMatch = item.match(/href="(\/anime\/[^"]+)"/);
        const imgMatch = item.match(/<img[^>]+src="([^"]+)"/);
        const titleMatch = item.match(/<p[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/p>/) ||
                           item.match(/<h3[^>]*>([^<]+)<\/h3>/);

        const href = hrefMatch ? baseUrl + hrefMatch[1] : '';
        const image = imgMatch ? imgMatch[1] : '';
        const title = titleMatch ? titleMatch[1].trim() : '';

        if (href && title) {
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

    const descriptionMatch = html.match(/<p[^>]*itemprop="description"[^>]*>([\s\S]*?)<\/p>/) ||
                             html.match(/<div[^>]*class="[^"]*sinopsis[^"]*"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/);
    let description = descriptionMatch ? descriptionMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    const aliasesMatch = html.match(/<span[^>]*class="[^"]*titalt[^"]*"[^>]*>([^<]+)<\/span>/) ||
                         html.match(/<p[^>]*class="[^"]*alt[^"]*"[^>]*>([^<]+)<\/p>/);
    let aliases = aliasesMatch ? aliasesMatch[1].trim() : 'N/A';

    const airdateMatch = html.match(/TV\s+(\d{4})/) ||
                         html.match(/OVA\s+(\d{4})/) ||
                         html.match(/Pel[ií]cula\s+(\d{4})/) ||
                         html.match(/(\d{4})\s*Temporada/);
    let airdate = airdateMatch ? airdateMatch[1].trim() : '';

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
    const baseUrl = "https://tioanime.com";

    const episodeLinks = html.match(/href="(\/ver\/[^"]+)"/g);

    if (!episodeLinks) {
        return episodes;
    }

    const seen = new Set();

    episodeLinks.forEach((link) => {
        const hrefMatch = link.match(/href="(\/ver\/[^"]+)"/);
        if (!hrefMatch) return;

        const path = hrefMatch[1];
        const fullHref = baseUrl + path;

        if (seen.has(fullHref)) return;
        seen.add(fullHref);

        // Extrae el número del final del slug: /ver/naruto-1 → 1
        const numberMatch = path.match(/-(\d+(?:\.\d+)?)$/);
        const number = numberMatch ? numberMatch[1] : '';

        if (number) {
            episodes.push({
                href: fullHref,
                number: number
            });
        }
    });

    episodes.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));

    return episodes;
}

async function extractStreamUrl(html) {
    try {
        // TioAnime carga el stream en un iframe externo (biribup.com)
        const iframeMatch = html.match(/src="(https:\/\/biribup\.com[^"]+)"/);
        if (!iframeMatch) return null;

        const iframeUrl = iframeMatch[1].replace(/&amp;/g, '&');

        const response = await fetchv2(iframeUrl, {
            'Referer': 'https://tioanime.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });
        const iframeHtml = await response.text();

        // Buscar .m3u8 dentro del iframe
        const m3u8Match = iframeHtml.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)['"]/);
        if (m3u8Match) return m3u8Match[1];

        // Buscar .mp4 dentro del iframe
        const mp4Match = iframeHtml.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)['"]/);
        if (mp4Match) return mp4Match[1];

        return null;
    } catch (error) {
        return null;
    }
}
