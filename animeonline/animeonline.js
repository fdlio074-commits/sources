function searchResults(html) {
    const results = [];
    const seen = new Set();

    const itemRegex = /\[!\[[^\]]*\]\((https:\/\/image\.tmdb\.org\/t\/p\/w500\/[^)]+)\)\]\((https:\/\/sololatino\.net\/(?:serie|pelicula)\/[^\/\)]+)\)/g;
    let match;

    while ((match = itemRegex.exec(html)) !== null) {
        const image = match[1].trim();
        const href = match[2].trim();

        if (seen.has(href)) continue;
        seen.add(href);

        const titleRegex = new RegExp('\\[([^\\[\\]]+)\\]\\(' + href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\)');
        const titleMatch = html.match(titleRegex);
        const title = titleMatch ? titleMatch[1].trim() : href.split('/').pop();

        if (!title || title.startsWith('Ver ')) continue;

        results.push({ title, image, href });
    }

    return results;
}

function extractDetails(html) {
    const details = [];

    const metaDesc = html.match(/meta-description:\s*([^\n]+)/);
    let description = metaDesc ? metaDesc[1].replace(/\.\.\.$/, '').trim() : '';

    const yearMatch = html.match(/(\d{4})\s+\d+\s*temp\./);
    let airdate = yearMatch ? yearMatch[1] : '';

    const typeMatch = html.match(/Anime|Serie|Película|Dorama/);
    let aliases = typeMatch ? typeMatch[0] : 'N/A';

    if (description) {
        details.push({ description, aliases, airdate });
    }

    return details;
}

function extractEpisodes(html) {
    const episodes = [];
    const seen = new Set();

    const epRegex = /\[E(\d+)[^\]]*\]\((https:\/\/sololatino\.net\/serie\/[^\/]+\/temporada-(\d+)\/episodio-(\d+))\)/g;
    let match;

    while ((match = epRegex.exec(html)) !== null) {
        const href = match[2];
        const season = match[3];
        const epNum = match[4];

        if (seen.has(href)) continue;
        seen.add(href);

        episodes.push({
            href,
            number: String((parseInt(season) - 1) * 1000 + parseInt(epNum))
        });
    }

    return episodes;
}

async function extractStreamUrl(html) {
    try {
        const csrfMatch = html.match(/meta-csrf-token:\s*([^\n]+)/);
        const csrf = csrfMatch ? csrfMatch[1].trim() : '';

        const canonicalMatch = html.match(/canonical:\s*https:\/\/sololatino\.net\/serie\/([^\/]+)\/temporada-(\d+)\/episodio-(\d+)/);
        if (!canonicalMatch) return null;

        const slug = canonicalMatch[1];
        const season = canonicalMatch[2];
        const episode = canonicalMatch[3];

        const apiUrl = `https://sololatino.net/api/episode?serie=${slug}&temporada=${season}&episodio=${episode}`;
        const response = await fetchv2(apiUrl, {
            'Referer': `https://sololatino.net/serie/${slug}/temporada-${season}/episodio-${episode}`,
            'X-CSRF-TOKEN': csrf,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0'
        });
        const data = await response.text();

        const m3u8 = data.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)['"]/);
        if (m3u8) return m3u8[1];

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
