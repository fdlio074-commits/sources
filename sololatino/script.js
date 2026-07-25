/** SoloLatino Sora Module
 * 
 * Provides access to search, details, episodes, and video streaming links
 * from SoloLatino (https://sololatino.net/).
 */

/** Helper function to decode Base64 strings.
 * Falls back to native methods or a manual implementation.
 */
function base64Decode(str) {
    try {
        if (typeof atob === 'function') return atob(str);
        if (typeof Buffer === 'function') return Buffer.from(str, 'base64').toString('utf-8');
    } catch (e) {}
    
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var output = '';
    var char;
    str = String(str).replace(/=+$/, '');
    if (str.length % 4 === 1) {
        return '';
    }
    for (var bc = 0, bs, buffer, idx = 0; char = str.charAt(idx++); ~char && (bs = bc % 4 ? buffer * 64 + bs : bs, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
        char = chars.indexOf(char);
    }
    return output;
}

/** Fetch wrapper that uses Sora's custom fetchv2 and falls back to standard fetch.
 */
async function soraFetch(url, options = {}) {
    const headers = options.headers ?? {};
    const method = options.method ?? 'GET';
    const body = options.body ?? null;
    
    // Inject default browser User-Agent to prevent Cloudflare/403 blocks
    if (!headers['User-Agent'] && !headers['user-agent']) {
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';
    }
    
    try {
        const res = await fetchv2(url, headers, method, body);
        let textRes = res;
        if (res) {
            if (typeof res.text === 'function') {
                textRes = await res.text();
            } else if (typeof res === 'object' && res._data !== undefined) {
                textRes = res._data;
            } else if (typeof res === 'object' && res.body !== undefined) {
                textRes = res.body;
            }
        }
        return textRes;
    } catch(e) {
        try {
            const res = await fetch(url, {
                method: method,
                headers: headers,
                body: body
            });
            let textRes = res;
            if (res) {
                if (typeof res.text === 'function') {
                    textRes = await res.text();
                } else if (typeof res === 'object' && res._data !== undefined) {
                    textRes = res._data;
                } else if (typeof res === 'object' && res.body !== undefined) {
                    textRes = res.body;
                }
            }
            return textRes;
        } catch(error) {
            return null;
        }
    }
}

/** searchResults
 * Searches for anime based on a keyword.
 * @param {string} keyword - The search keyword.
 * @returns {Promise<string>} - A JSON string of search results.
 */
async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const responseText = await soraFetch('https://sololatino.net/buscar?q=' + encodedKeyword);
        if (!responseText) return JSON.stringify([]);

        const results = [];
        const seen = new Set();

        // Patron 1: Buscar en divs con clase anime-item o similar
        const regex1 = /<div[^>]*class="[^"]*(?:anime-item|result-item|anime-card|card)[^"]*"[^>]*>[\s\S]*?<a\s+href="([^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?(?:<h[1-6][^>]*>)?([^<]+)(?:<\/h[1-6]>)?/gi;
        let match;
        while ((match = regex1.exec(responseText)) !== null) {
            const href = match[1].trim();
            const image = match[2].trim();
            const title = match[3].trim();
            
            if (href && title && !seen.has(href)) {
                seen.add(href);
                results.push({ title, image, href });
            }
        }

        // Patron 2: Si no encuentra, buscar enlaces directos con imagenes
        if (results.length === 0) {
            const regex2 = /<a[^>]*href="(https:\/\/sololatino\.net\/[^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*alt="([^"]+)"/gi;
            while ((match = regex2.exec(responseText)) !== null) {
                const href = match[1].trim();
                const image = match[2].trim();
                const title = match[3].trim();
                
                if (href && title && !seen.has(href)) {
                    seen.add(href);
                    results.push({ title, image, href });
                }
            }
        }

        return JSON.stringify(results);
    } catch (error) {
        return JSON.stringify([]);
    }
}

/** extractDetails
 * Extracts details of an anime from its main page URL.
 * @param {string} url - The URL of the anime page.
 * @returns {Promise<string>} - A JSON string of the anime details.
 */
async function extractDetails(url) {
    try {
        const responseText = await soraFetch(url);
        if (!responseText) return JSON.stringify({ description: 'No description available', aliases: 'Estado: Unknown', airdate: 'Aired: Unknown' });

        let description = 'No description available';
        let airdate = 'Unknown';
        let status = 'Unknown';

        // Buscar descripción en meta tags
        const descMeta = responseText.match(/<meta\s+name="description"\s+content="([^"]+)"/);
        if (descMeta) {
            description = descMeta[1].replace(/\.\.\.$/, '').trim();
        }

        // Buscar en párrafos con clase
        if (description === 'No description available') {
            const descRegex = /<p[^>]*class="[^"]*(?:sinopsis|descripcion|description)[^"]*"[^>]*>([\s\S]*?)<\/p>/i;
            const descMatch = responseText.match(descRegex);
            if (descMatch) {
                description = descMatch[1].replace(/<[^>]*>/g, '').trim();
            }
        }

        // Buscar año/fecha de emisión
        const yearMatch = responseText.match(/<(?:p|span)[^>]*>(?:Emitido|Año|Fecha):\s*(\d{4})/i);
        if (yearMatch) {
            airdate = yearMatch[1];
        }

        // Buscar estado
        const statusMatch = responseText.match(/<(?:p|span|li)[^>]*>(?:Estado|Status):\s*([^<]+)</);
        if (statusMatch) {
            status = statusMatch[1].trim();
        }

        return JSON.stringify({
            description: description,
            aliases: 'Estado: ' + status,
            airdate: 'Aired: ' + airdate
        });
    } catch (error) {
        return JSON.stringify({
            description: 'Error loading description',
            aliases: 'Estado: Unknown',
            airdate: 'Aired: Unknown'
        });
    }
}

/** extractEpisodes
 * Extracts episodes list of an anime from its main page URL.
 * @param {string} url - The URL of the anime page.
 * @returns {Promise<string>} - A JSON string of the episodes list.
 */
async function extractEpisodes(url) {
    try {
        const html = await soraFetch(url);
        if (!html) {
            return JSON.stringify([]);
        }

        const episodes = [];
        const seen = new Set();

        // Patron 1: Buscar enlaces de episodios directo
        const epRegex = /<a[^>]*href="(https:\/\/sololatino\.net\/[^"]*(?:cap|ep|episode|capitulo)[^"]*)"/gi;
        let match;

        while ((match = epRegex.exec(html)) !== null) {
            const href = match[1].trim();
            
            // Extraer número de episodio de la URL
            const numMatch = href.match(/(?:cap|ep|episode|capitulo)[-\s]*(\d+)/i);
            const epNum = numMatch ? parseInt(numMatch[1]) : episodes.length + 1;
            
            if (!seen.has(href)) {
                seen.add(href);
                episodes.push({
                    href: href,
                    number: epNum
                });
            }
        }

        // Patron 2: Buscar en lista de episodios con números
        if (episodes.length === 0) {
            const listRegex = /<(?:li|div)[^>]*class="[^"]*episode[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([^<]*(?:\d+)[^<]*)<\/a>/gi;
            while ((match = listRegex.exec(html)) !== null) {
                const href = match[1].trim();
                const text = match[2].trim();
                const numMatch = text.match(/(\d+)/);
                const epNum = numMatch ? parseInt(numMatch[1]) : episodes.length + 1;
                
                if (!seen.has(href)) {
                    seen.add(href);
                    episodes.push({
                        href: href,
                        number: epNum
                    });
                }
            }
        }

        // Ordenar episodios por número
        episodes.sort((a, b) => a.number - b.number);

        return JSON.stringify(episodes);
    } catch (error) {
        return JSON.stringify([]);
    }
}

/** extractStreamUrl
 * Extracts stream URL from episode page.
 * @param {string} url - The URL of the episode page.
 * @returns {Promise<string>} - A JSON string with stream options.
 */
async function extractStreamUrl(url) {
    try {
        const html = await soraFetch(url);
        if (!html) return JSON.stringify({ streams: [] });

        const streams = [];
        const promises = [];

        // Patron 1: Buscar iframes
        const iframeRegex = /<iframe[^>]*src="([^"]+)"[^>]*><\/iframe>/gi;
        let match;

        while ((match = iframeRegex.exec(html)) !== null) {
            const iframeSrc = match[1].trim();
            const serverName = extractServerName(iframeSrc);
            
            promises.push((async () => {
                try {
                    const resolvedUrl = await resolveStream(iframeSrc, serverName);
                    if (resolvedUrl) {
                        streams.push({
                            title: serverName,
                            streamUrl: resolvedUrl,
                            headers: { 'Referer': url }
                        });
                    }
                } catch (e) {}
            })());
        }

        // Patron 2: Buscar scripts con variables de video
        const scriptRegex = /var\s+video\s*=\s*['"]([^'"]+)['"]|src\s*=\s*['"]([^'"]+\.m3u8[^'"]*)['"]|url\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]|video\[0\]\s*=\s*['"]<iframe[^>]*src=\"([^\"]+)\"/gi;
        
        while ((match = scriptRegex.exec(html)) !== null) {
            const streamUrl = match[1] || match[2] || match[3] || match[4];
            if (streamUrl && !streamUrl.includes('<')) {
                streams.push({
                    title: 'Default Stream',
                    streamUrl: streamUrl,
                    headers: { 'Referer': url }
                });
                break;
            }
        }

        // Esperar a que se resuelvan todos los iframes
        await Promise.all(promises);

        return JSON.stringify({ streams: streams });
    } catch (error) {
        return JSON.stringify({ streams: [] });
    }
}

/** Helper: Extract server name from URL */
function extractServerName(url) {
    if (url.includes('streamwish')) return 'Streamwish';
    if (url.includes('vidhide')) return 'Vidhide';
    if (url.includes('mp4upload')) return 'Mp4upload';
    if (url.includes('doodstream')) return 'Doodstream';
    if (url.includes('streamtape')) return 'Streamtape';
    if (url.includes('voe')) return 'VOE';
    if (url.includes('okru')) return 'Okru';
    if (url.includes('fem')) return 'Fem';
    return 'Stream Server';
}

/** Helper: Resolve stream from different servers */
async function resolveStream(url, serverName) {
    try {
        const html = await soraFetch(url);
        if (!html) return null;

        // M3U8 directo
        const m3u8Match = html.match(/['"]([^'"]*\.m3u8[^'"]*)['"]/);
        if (m3u8Match) return m3u8Match[1];

        // URL en src de video
        const srcMatch = html.match(/<source[^>]*src=['"]([^'"]+)['"]/);
        if (srcMatch) return srcMatch[1];

        // URL en atributo src directo
        const srcAttrMatch = html.match(/src\s*:\s*['"]([^'"]+)['"]/);
        if (srcAttrMatch) return srcAttrMatch[1];

        return null;
    } catch (e) {
        return null;
    }
}
