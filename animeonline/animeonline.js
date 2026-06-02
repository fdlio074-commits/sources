// ─────────────────────────────────────────────
//  Sora Module — Anime-JL.net
//  Idioma: Español Latino / Sub Español
//  Modo: asyncJS
// ─────────────────────────────────────────────

async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const response = await fetchv2(
            `https://anime-jl.net/?s=${encodedKeyword}`,
            {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://anime-jl.net/'
            }
        );

        const html = await response.text();
        const results = [];

        // Patrón de URL: /anime/{id}/{slug}
        const itemRegex = /<a\s+href="(https:\/\/anime-jl\.net\/anime\/\d+\/[^"]+?)"[^>]*>\s*<img[^>]+src="([^"]+)"[^>]*>/gi;
        const titleRegex = /<h2[^>]*>\s*<a[^>]+href="https:\/\/anime-jl\.net\/anime\/\d+\/[^"]*"[^>]*>([^<]+)<\/a>/gi;

        // Extraer bloques de anime de la página de resultados
        const blockRegex = /class="[^"]*post[^"]*"[\s\S]*?href="(https:\/\/anime-jl\.net\/anime\/\d+\/[^"]+)"[\s\S]*?src="([^"]+)"[\s\S]*?<h\d[^>]*>\s*(?:<a[^>]*>)?([^<\n]+)/gi;
        let match;
        const seen = new Set();

        while ((match = blockRegex.exec(html)) !== null) {
            const href = match[1].trim();
            if (seen.has(href)) continue;
            // Saltar URLs que sean de episodios
            if (href.includes('/episodio-')) continue;
            seen.add(href);
            results.push({
                title: match[3].replace(/<[^>]+>/g, '').trim(),
                image: match[2].trim(),
                href: href
            });
        }

        // Fallback más simple si el anterior no encuentra nada
        if (results.length === 0) {
            const simpleRegex = /<a\s[^>]*href="(https:\/\/anime-jl\.net\/anime\/\d+\/(?!.*episodio)[^"]+)"[^>]*title="([^"]+)"[^>]*>/gi;
            while ((match = simpleRegex.exec(html)) !== null) {
                const href = match[1].trim();
                if (seen.has(href)) continue;
                seen.add(href);
                results.push({
                    title: match[2].trim(),
                    image: '',
                    href: href
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
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': 'https://anime-jl.net/'
        });

        const html = await response.text();

        // Descripción / sinopsis — varios patrones posibles
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

        // Año de emisión
        let airdate = '';
        const yearMatch = html.match(/(\b20\d{2}\b)/);
        if (yearMatch) {
            airdate = 'Año: ' + yearMatch[1];
        }

        return JSON.stringify([{
            description: description,
            aliases: aliases || 'Anime en Español',
            airdate: airdate || 'Fecha desconocida'
        }]);

    } catch (error) {
        console.log('extractDetails error:', error);
        return JSON.stringify([{
            description: 'Error al cargar descripción',
            aliases: '',
            airdate: ''
        }]);
    }
}


async function extractEpisodes(url) {
    try {
        const response = await fetchv2(url, {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': 'https://anime-jl.net/'
        });

        const html = await response.text();

        // URL base del anime: https://anime-jl.net/anime/{id}/{slug}
        // Episodios: https://anime-jl.net/anime/{id}/{slug}/episodio-{n}
        const baseMatch = url.match(/^(https:\/\/anime-jl\.net\/anime\/\d+\/[^\/]+)/);
        const baseUrl = baseMatch ? baseMatch[1] : url;

        const episodes = [];
        const seen = new Set();

        // Buscar todos los enlaces de episodios en la página
        const epRegex = new RegExp(
            baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
            '\\/episodio-(\\d+)',
            'gi'
        );
        let match;

        while ((match = epRegex.exec(html)) !== null) {
            const epNum = parseInt(match[1], 10);
            const epUrl = `${baseUrl}/episodio-${epNum}`;
            if (!seen.has(epUrl)) {
                seen.add(epUrl);
                episodes.push({ href: epUrl, number: epNum });
            }
        }

        // Ordenar de menor a mayor
        episodes.sort((a, b) => a.number - b.number);

        if (episodes.length === 0) {
            // Fallback: al menos el episodio 1
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
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': 'https://anime-jl.net/'
        });

        const html = await response.text();

        // 1. HLS directo (.m3u8)
        const hlsMatch = html.match(/https?:\/\/[^\s"'<>]+\.m3u8(?:[^\s"'<>]*)?/i);
        if (hlsMatch) return hlsMatch[0];

        // 2. MP4 directo
        const mp4Match = html.match(/https?:\/\/[^\s"'<>]+\.mp4(?:[^\s"'<>]*)?/i);
        if (mp4Match) return mp4Match[0];

        // 3. Buscar iframe de reproductores embebidos
        const iframeMatches = [...html.matchAll(/<iframe[^>]+src="(https?:\/\/[^"]+)"[^>]*>/gi)];
        for (const iframeMatch of iframeMatches) {
            const iframeUrl = iframeMatch[1];

            // Saltar iframes de ads/google
            if (iframeUrl.includes('google') || iframeUrl.includes('doubleclick')) continue;

            try {
                const iframeResp = await fetchv2(iframeUrl, {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Referer': url
                });
                const iframeHtml = await iframeResp.text();

                const innerHls = iframeHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8(?:[^\s"'<>]*)?/i);
                if (innerHls) return innerHls[0];

                const innerMp4 = iframeHtml.match(/https?:\/\/[^\s"'<>]+\.mp4(?:[^\s"'<>]*)?/i);
                if (innerMp4) return innerMp4[0];

            } catch (e) {
                continue;
            }

            // Retornar la URL del iframe como último recurso
            return iframeUrl;
        }

        return null;

    } catch (error) {
        console.log('extractStreamUrl error:', error);
        return null;
    }
}