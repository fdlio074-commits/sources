// ─────────────────────────────────────────────
//  Sora Module — Anime-JL.net
//  Autor: Fdlio
//  Idioma: Español Latino / Sub Español
//  Modo: asyncJS
// ─────────────────────────────────────────────

async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);

        const response = await fetchv2(
            `https://anime-jl.net/animes?q=${encodedKeyword}`,
            {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'es-ES,es;q=0.9',
                'Referer': 'https://anime-jl.net/'
            }
        );

        const html = await response.text();
        const results = [];
        const seen = new Set();

        // Buscar todos los enlaces /anime/{id}/{slug} en la página
        const linkRegex = /href="(https:\/\/anime-jl\.net\/anime\/(\d+)\/([^"\/]+))"/gi;
        let match;

        while ((match = linkRegex.exec(html)) !== null) {
            const href = match[1].trim();
            if (seen.has(href)) continue;
            if (href.includes('/episodio-')) continue;
            seen.add(href);

            // Slug a título legible
            const slug = match[3];
            const title = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

            // Buscar imagen cercana al enlace
            const surroundingHtml = html.substring(Math.max(0, match.index - 500), match.index + 500);
            const imgMatch = surroundingHtml.match(/src="(https?:\/\/[^"]+(?:\.jpg|\.png|\.webp)[^"]*)"/i);
            const image = imgMatch ? imgMatch[1] : '';

            results.push({ title, image, href });
        }

        // Si solo encontró 1 resultado (redirigió al anime directamente), igual lo devolvemos
        if (results.length === 0) {
            // Intentar extraer datos de la página actual (puede ser el anime directo)
            const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
            const imgMatch = html.match(/<img[^>]+src="(https?:\/\/[^"]+(?:\.jpg|\.png|\.webp)[^"]*)"/i);
            const canonicalMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);

            if (titleMatch && canonicalMatch) {
                results.push({
                    title: titleMatch[1].trim(),
                    image: imgMatch ? imgMatch[1] : '',
                    href: canonicalMatch[1]
                });
            }
        }

        if (results.length === 0) {
            return JSON.stringify([{ title: 'Sin resultados para: ' + keyword, image: '', href: '' }]);
        }

        return JSON.stringify(results);

    } catch (error) {
        console.log('searchResults error:', error);
        return JSON.stringify([{ title: 'Error al buscar', image: '', href: '' }]);
    }
}


async function extractDetails(url) {
    try {
        const response = await fetchv2(url, {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9',
            'Referer': 'https://anime-jl.net/'
        });

        const html = await response.text();

        // Descripción
        let description = 'Sin descripción disponible.';
        const descPatterns = [
            /<div[^>]*class="[^"]*sinopsis[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
            /<div[^>]*class="[^"]*descripcion[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
            /<div[^>]*itemprop="description"[^>]*>([\s\S]*?)<\/div>/i,
            /<p[^>]*class="[^"]*resumen[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
            /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        ];
        for (const pattern of descPatterns) {
            const m = html.match(pattern);
            if (m) {
                const clean = m[1].replace(/<[^>]+>/g, '').trim();
                if (clean.length > 20) { description = clean; break; }
            }
        }

        // Géneros
        let aliases = '';
        const genreMatches = [...html.matchAll(/<a[^>]*rel="tag"[^>]*>([^<]+)<\/a>/gi)];
        if (genreMatches.length > 0) {
            aliases = 'Géneros: ' + genreMatches.map(m => m[1].trim()).join(', ');
        }

        // Año
        let airdate = '';
        const yearMatch = html.match(/(\b20\d{2}\b)/);
        if (yearMatch) airdate = 'Año: ' + yearMatch[1];

        return JSON.stringify([{
            description,
            aliases: aliases || 'Anime en Español',
            airdate: airdate || 'Fecha desconocida'
        }]);

    } catch (error) {
        console.log('extractDetails error:', error);
        return JSON.stringify([{ description: 'Error al cargar descripción', aliases: '', airdate: '' }]);
    }
}


async function extractEpisodes(url) {
    try {
        const response = await fetchv2(url, {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9',
            'Referer': 'https://anime-jl.net/'
        });

        const html = await response.text();

        const baseMatch = url.match(/^(https:\/\/anime-jl\.net\/anime\/\d+\/[^\/]+)/);
        const baseUrl = baseMatch ? baseMatch[1] : url;

        const episodes = [];
        const seen = new Set();

        const escapedBase = baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const epRegex = new RegExp(escapedBase + '\\/episodio-(\\d+)', 'gi');
        let match;

        while ((match = epRegex.exec(html)) !== null) {
            const epNum = parseInt(match[1], 10);
            const epUrl = `${baseUrl}/episodio-${epNum}`;
            if (!seen.has(epUrl)) {
                seen.add(epUrl);
                episodes.push({ href: epUrl, number: epNum });
            }
        }

        episodes.sort((a, b) => a.number - b.number);

        if (episodes.length === 0) {
            return JSON.stringify([{ href: `${baseUrl}/episodio-1`, number: 1 }]);
        }

        return JSON.stringify(episodes);

    } catch (error) {
        console.log('extractEpisodes error:', error);
        return JSON.stringify([{ href: url + '/episodio-1', number: 1 }]);
    }
}


async function extractStreamUrl(url) {
    try {
        const response = await fetchv2(url, {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9',
            'Referer': 'https://anime-jl.net/'
        });

        const html = await response.text();

        // 1. HLS directo
        const hlsMatch = html.match(/https?:\/\/[^\s"'<>]+\.m3u8(?:[^\s"'<>]*)?/i);
        if (hlsMatch) return hlsMatch[0];

        // 2. MP4 directo
        const mp4Match = html.match(/https?:\/\/[^\s"'<>]+\.mp4(?:[^\s"'<>]*)?/i);
        if (mp4Match) return mp4Match[0];

        // 3. Iframes
        const iframeMatches = [...html.matchAll(/<iframe[^>]+src="(https?:\/\/[^"]+)"[^>]*>/gi)];
        for (const iframeMatch of iframeMatches) {
            const iframeUrl = iframeMatch[1];
            if (iframeUrl.includes('google') || iframeUrl.includes('doubleclick')) continue;

            try {
                const iframeResp = await fetchv2(iframeUrl, {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                    'Referer': url
                });
                const iframeHtml = await iframeResp.text();

                const innerHls = iframeHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8(?:[^\s"'<>]*)?/i);
                if (innerHls) return innerHls[0];

                const innerMp4 = iframeHtml.match(/https?:\/\/[^\s"'<>]+\.mp4(?:[^\s"'<>]*)?/i);
                if (innerMp4) return innerMp4[0];

            } catch (e) { continue; }

            return iframeUrl;
        }

        return null;

    } catch (error) {
        console.log('extractStreamUrl error:', error);
        return null;
    }
}