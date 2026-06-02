// ─────────────────────────────────────────────
//  Sora Module — Anime-JL.net
//  Autor: Fdlio | Reparado 2026
// ─────────────────────────────────────────────

async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const response = await fetchv2(
            `https://anime-jl.net/animes?q=${encodedKeyword}`,
            {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'es-ES,es;q=0.9',
                'Referer': 'https://anime-jl.net/',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin'
            }
        );

        const html = await response.text();
        const results = [];
        const seen = new Set();

        // ✅ NUEVO PATRÓN ACTUALIZADO (AHORA SÍ ENCUENTRA TODO)
        const linkRegex = /href="(https:\/\/anime-jl\.net\/anime\/[^"]+)"[\s\S]*?title="([^"]+)"/gi;
        let match;

        while ((match = linkRegex.exec(html)) !== null) {
            const href = match[1].trim();
            if (href.includes('/episodio-') || seen.has(href)) continue;
            seen.add(href);

            const title = match[2].trim()
                .replace(/&#039;/g, "'")
                .replace(/&quot;/g, '"');

            // ✅ Imagen actualizada
            const imgRegex = new RegExp(`src="(https?:\/\/[^"]+\\.(jpg|png|webp)[^"]*)"[^>]*alt="${match[2].replace(/"/g, '\\"')}"`, 'i');
            const imgMatch = html.match(imgRegex);
            const image = imgMatch ? imgMatch[1] : 'https://anime-jl.net/wp-content/uploads/2020/02/cropped-logo-animejl-192x192.png';

            results.push({ title, image, href });
        }

        // Si redirige directo al anime
        if (results.length === 0) {
            const titleMatch = html.match(/<h1 class="[^"]*title[^"]*">([^<]+)<\/h1>/i);
            const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)"/i);
            if (titleMatch && canonicalMatch) {
                results.push({
                    title: titleMatch[1].trim(),
                    image: 'https://anime-jl.net/wp-content/uploads/2020/02/cropped-logo-animejl-192x192.png',
                    href: canonicalMatch[1]
                });
            }
        }

        if (results.length === 0) {
            return JSON.stringify([{ title: 'Sin resultados: ' + keyword, image: '', href: '' }]);
        }

        return JSON.stringify(results);

    } catch (e) {
        return JSON.stringify([{ title: 'Error al buscar', image: '', href: '' }]);
    }
}


async function extractDetails(url) {
    try {
        const response = await fetchv2(url, {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': 'https://anime-jl.net/animes'
        });

        const html = await response.text();

        let description = 'Sin sinopsis disponible.';
        const descRegex = /<div class="[^"]*sinopsis[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
        const descMatch = html.match(descRegex);
        if (descMatch) {
            description = descMatch[1].replace(/<[^>]+>/g, '').trim()
                .replace(/\s+/g, ' ')
                .replace(/&nbsp;/g, ' ');
        }

        // Géneros
        const genres = [];
        const genreRegex = /<a href="[^"]+\/genero\/[^"]+">([^<]+)<\/a>/gi;
        let gMatch;
        while ((gMatch = genreRegex.exec(html)) !== null) genres.push(gMatch[1].trim());
        const aliases = genres.length ? `Géneros: ${genres.join(', ')}` : 'Anime en Español';

        // Año
        const yearMatch = html.match(/<span class="year">(\d{4})<\/span>/i) || html.match(/(\b20\d{2}\b)/);
        const airdate = yearMatch ? `Año: ${yearMatch[1]}` : 'Fecha desconocida';

        return JSON.stringify([{ description, aliases, airdate }]);

    } catch (e) {
        return JSON.stringify([{ description: 'Error al cargar', aliases: '', airdate: '' }]);
    }
}


async function extractEpisodes(url) {
    try {
        const response = await fetchv2(url, {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
            'Referer': url
        });

        const html = await response.text();
        const baseUrl = url.match(/^(https:\/\/anime-jl\.net\/anime\/\d+\/[^\/]+)/)?.[1] || url;
        const episodes = [];
        const seen = new Set();

        // ✅ Patrón de episodios actualizado
        const epRegex = /href="(${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\/episodio-(\d+))"/gi;
        let match;

        while ((match = epRegex.exec(html)) !== null) {
            const epNum = parseInt(match[2], 10);
            const epHref = match[1];
            if (!seen.has(epHref)) {
                seen.add(epHref);
                episodes.push({ href: epHref, number: epNum });
            }
        }

        episodes.sort((a, b) => a.number - b.number);

        if (episodes.length === 0) episodes.push({ href: `${baseUrl}/episodio-1`, number: 1 });

        return JSON.stringify(episodes);

    } catch (e) {
        return JSON.stringify([{ href: url + '/episodio-1', number: 1 }]);
    }
}


async function extractStreamUrl(url) {
    try {
        const response = await fetchv2(url, {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
            'Referer': url
        });

        const html = await response.text();

        // ✅ Busca reproductor actual
        const playerRegex = /<iframe[^>]+src="([^"]+)"[^>]*class="[^"]*reproductor[^"]*"/i;
        const playerMatch = html.match(playerRegex);
        if (!playerMatch) return null;

        // Entra al reproductor
        const res2 = await fetchv2(playerMatch[1], { Referer: url });
        const html2 = await res2.text();

        // HLS / MP4
        const hls = html2.match(/https?:\/\/[^"']+\.m3u8[^"']*/i);
        if (hls) return hls[0];

        const mp4 = html2.match(/https?:\/\/[^"']+\.mp4[^"']*/i);
        if (mp4) return mp4[0];

        return null;

    } catch (e) {
        return null;
    }
}