// AnimeOnline (anime-jl.net) Module for Sora
// Author: Fdlio
// Source: https://www.anime-jl.net

async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const responseText = await fetch(`https://www.anime-jl.net/?s=${encodedKeyword}`);

        const results = [];
        const itemRegex = /<article[^>]*>[\s\S]*?<a\s+href="([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/gi;

        let match;
        while ((match = itemRegex.exec(responseText)) !== null) {
            const href = match[1];
            const image = match[2];
            const title = match[3].replace(/<[^>]+>/g, '').trim();
            if (href && title) {
                results.push({ title, image, href });
            }
        }

        // Fallback regex in case structure differs
        if (results.length === 0) {
            const altRegex = /<div[^>]*class="[^"]*TPost[^"]*"[^>]*>[\s\S]*?<a\s+href="([^"]+)"[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/gi;
            while ((match = altRegex.exec(responseText)) !== null) {
                const href = match[1];
                const image = match[2];
                const title = match[3].replace(/<[^>]+>/g, '').trim();
                if (href && title) {
                    results.push({ title, image, href });
                }
            }
        }

        return JSON.stringify(results);
    } catch (error) {
        console.log('searchResults error:', error);
        return JSON.stringify([{ title: 'Error al buscar', image: '', href: '' }]);
    }
}

async function extractDetails(url) {
    try {
        const responseText = await fetch(url);

        // Description
        const descMatch = responseText.match(/<div[^>]*class="[^"]*Description[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
            || responseText.match(/<p[^>]*class="[^"]*sinopsis[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
        const description = descMatch
            ? descMatch[1].replace(/<[^>]+>/g, '').trim()
            : 'Sin descripción disponible';

        // Aliases / alternate name
        const aliasMatch = responseText.match(/Título alternativo[^:]*:\s*<[^>]*>([\s\S]*?)<\/[^>]*>/i)
            || responseText.match(/Otros nombres[^:]*:\s*([\s\S]*?)<br/i);
        const aliases = aliasMatch ? aliasMatch[1].replace(/<[^>]+>/g, '').trim() : '';

        // Airdate
        const airMatch = responseText.match(/Año[^:]*:\s*<[^>]*>(\d{4})<\/[^>]*>/i)
            || responseText.match(/(\d{4})/);
        const airdate = airMatch ? airMatch[1] : 'Desconocido';

        return JSON.stringify([{ description, aliases, airdate }]);
    } catch (error) {
        console.log('extractDetails error:', error);
        return JSON.stringify([{
            description: 'Error al cargar descripción',
            aliases: '',
            airdate: 'Desconocido'
        }]);
    }
}

async function extractEpisodes(url) {
    try {
        const responseText = await fetch(url);
        const episodes = [];

        // anime-jl.net episode links follow: /anime/{id}/{slug}/episodio-{n}
        const epRegex = /href="(https?:\/\/(?:www\.)?anime-jl\.net\/anime\/[^"]+\/episodio-(\d+)[^"]*)"/gi;

        const seen = new Set();
        let match;
        while ((match = epRegex.exec(responseText)) !== null) {
            const href = match[1];
            const number = parseInt(match[2], 10);
            if (!seen.has(number)) {
                seen.add(number);
                episodes.push({ href, number });
            }
        }

        // Sort ascending by episode number
        episodes.sort((a, b) => a.number - b.number);

        return JSON.stringify(episodes);
    } catch (error) {
        console.log('extractEpisodes error:', error);
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
    try {
        const responseText = await fetch(url);

        // Try to find an HLS .m3u8 URL first
        const hlsMatch = responseText.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/i);
        if (hlsMatch) return hlsMatch[0];

        // Try to find an iframe embed source
        const iframeMatch = responseText.match(/<iframe[^>]+src="([^"]+)"/i);
        if (iframeMatch) {
            const iframeUrl = iframeMatch[1];
            const iframeResponse = await fetch(iframeUrl);

            const iframeHls = iframeResponse.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/i);
            if (iframeHls) return iframeHls[0];

            const mp4Match = iframeResponse.match(/https?:\/\/[^\s"']+\.mp4[^\s"']*/i);
            if (mp4Match) return mp4Match[0];
        }

        // Try direct MP4
        const mp4Match = responseText.match(/https?:\/\/[^\s"']+\.mp4[^\s"']*/i);
        if (mp4Match) return mp4Match[0];

        return null;
    } catch (error) {
        console.log('extractStreamUrl error:', error);
        return null;
    }
}
