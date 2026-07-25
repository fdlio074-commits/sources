/** SoloLatino Sora Module - v1.0.0 */

function base64Decode(str) {
    try {
        if (typeof atob === 'function') return atob(str);
        if (typeof Buffer === 'function') return Buffer.from(str, 'base64').toString('utf-8');
    } catch (e) {}
    
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var output = '';
    var char;
    str = String(str).replace(/=+$/, '');
    if (str.length % 4 === 1) return '';
    
    for (var bc = 0, bs, buffer, idx = 0; char = str.charAt(idx++); ~char && (bs = bc % 4 ? buffer * 64 + bs : bs, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
        char = chars.indexOf(char);
    }
    return output;
}

async function soraFetch(url, options) {
    options = options || {};
    var headers = options.headers || {};
    var method = options.method || 'GET';
    var body = options.body || null;
    
    if (!headers['User-Agent'] && !headers['user-agent']) {
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    }
    
    try {
        var res = await fetchv2(url, headers, method, body);
        var textRes = res;
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
            var res = await fetch(url, {
                method: method,
                headers: headers,
                body: body
            });
            var textRes = res;
            if (res && typeof res.text === 'function') {
                textRes = await res.text();
            }
            return textRes;
        } catch(error) {
            return null;
        }
    }
}

async function searchResults(keyword) {
    try {
        var url = 'https://sololatino.net/buscar?q=' + encodeURIComponent(keyword);
        var html = await soraFetch(url);
        if (!html) return JSON.stringify([]);
        
        var results = [];
        var seen = {};
        
        var regex = /<div[^>]*class="[^"]*anime[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*alt="([^"]+)"/gi;
        var match;
        
        while ((match = regex.exec(html)) !== null) {
            var href = match[1].trim();
            var image = match[2].trim();
            var title = match[3].trim();
            
            if (href && title && !seen[href]) {
                seen[href] = true;
                results.push({
                    title: title,
                    image: image,
                    href: href
                });
            }
        }
        
        return JSON.stringify(results);
    } catch (error) {
        return JSON.stringify([]);
    }
}

async function extractDetails(url) {
    try {
        var html = await soraFetch(url);
        if (!html) return JSON.stringify({ description: 'No disponible', aliases: 'Estado: Desconocido', airdate: 'Año: Desconocido' });
        
        var description = 'No disponible';
        var airdate = 'Desconocido';
        var status = 'Desconocido';
        
        var descMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
        if (descMatch) {
            description = descMatch[1].replace(/<[^>]*>/g, '').trim();
        }
        
        var yearMatch = html.match(/(\d{4})/);
        if (yearMatch) {
            airdate = yearMatch[1];
        }
        
        var statusMatch = html.match(/Estado[^:]*:[^<]*([^<]+)/);
        if (statusMatch) {
            status = statusMatch[1].trim();
        }
        
        return JSON.stringify({
            description: description,
            aliases: 'Estado: ' + status,
            airdate: 'Año: ' + airdate
        });
    } catch (error) {
        return JSON.stringify({
            description: 'Error al cargar',
            aliases: 'Estado: Desconocido',
            airdate: 'Año: Desconocido'
        });
    }
}

async function extractEpisodes(url) {
    try {
        var html = await soraFetch(url);
        if (!html) return JSON.stringify([]);
        
        var episodes = [];
        var seen = {};
        
        var regex = /<a[^>]*href="([^"]*\/(cap|ep|episode|capitulo)[^"]*)"/gi;
        var match;
        var counter = 1;
        
        while ((match = regex.exec(html)) !== null) {
            var href = match[1].trim();
            
            var numMatch = href.match(/(\d+)/);
            var epNum = numMatch ? parseInt(numMatch[1]) : counter;
            
            if (!seen[href]) {
                seen[href] = true;
                episodes.push({
                    href: href,
                    number: String(epNum)
                });
                counter++;
            }
        }
        
        return JSON.stringify(episodes);
    } catch (error) {
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
    try {
        var html = await soraFetch(url);
        if (!html) return JSON.stringify({ streams: [] });
        
        var streams = [];
        
        var iframeRegex = /<iframe[^>]*src="([^"]+)"[^>]*><\/iframe>/gi;
        var match;
        
        while ((match = iframeRegex.exec(html)) !== null) {
            var iframeUrl = match[1].trim();
            var serverName = 'Stream';
            
            if (iframeUrl.indexOf('streamwish') > -1) serverName = 'Streamwish';
            else if (iframeUrl.indexOf('vidhide') > -1) serverName = 'Vidhide';
            else if (iframeUrl.indexOf('doodstream') > -1) serverName = 'Doodstream';
            else if (iframeUrl.indexOf('mp4upload') > -1) serverName = 'Mp4upload';
            else if (iframeUrl.indexOf('streamtape') > -1) serverName = 'Streamtape';
            
            streams.push({
                title: serverName,
                streamUrl: iframeUrl,
                headers: { 'Referer': url }
            });
        }
        
        var m3u8Match = html.match(/(['\"])(https?:\/\/[^'\"]*\.m3u8[^'\"]*)/i);
        if (m3u8Match && streams.length === 0) {
            streams.push({
                title: 'HLS Stream',
                streamUrl: m3u8Match[2],
                headers: { 'Referer': url }
            });
        }
        
        return JSON.stringify({ streams: streams });
    } catch (error) {
        return JSON.stringify({ streams: [] });
    }
}
