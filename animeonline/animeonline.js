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
