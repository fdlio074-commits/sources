// ============================================================
//  Módulo Sora — AnimeJL (anime-jl.net)
//  Autor: fdlio074
//  Repo: https://github.com/fdlio074-commits/sources
//  Modo: asyncJS = true | Idioma: Español Latino
//  Reproductores: monoschinos, gupload, voe, savefiles, bysezoxexe
// ============================================================

async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const url = "https://www.anime-jl.net/animes?q=" + encodedKeyword;

        const response = await fetchv2(url, {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.anime-jl.net/"
        });
        const html = await response.text();

        const results = [];
        const articleRegex = /<article[^>]*class='Anime[^']*'[^>]*>([\s\S]*?)<\/article>/g;
        let articleMatch;

        while ((articleMatch = articleRegex.exec(html)) !== null) {
            const block = articleMatch[1];
            const hrefMatch = block.match(/href='(https:\/\/www\.anime-jl\.net\/anime\/[^']+)'/);
            if (!hrefMatch) continue;
            const href = hrefMatch[1];
            const titleMatch = block.match(/<h3[^>]*class='Title'[^>]*>([^<]+)<\/h3>/);
            if (!titleMatch) continue;
            const title = titleMatch[1].trim();
            const imgMatch = block.match(/<img[^>]+src='([^']+)'/);
            let image = imgMatch ? imgMatch[1] : "";
            if (image.startsWith("/")) image = "https://www.anime-jl.net" + image;
            results.push({ title: title, image: image, href: href });
        }

        return JSON.stringify(results);
    } catch (error) {
        console.log("searchResults error: " + error);
        return JSON.stringify([]);
    }
}

async function extractDetails(url) {
    try {
        const response = await fetchv2(url, {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.anime-jl.net/"
        });
        const html = await response.text();

        let description = "Sin descripción disponible.";
        const descMatch = html.match(/<div[^>]*class="Description"[^>]*>([\s\S]*?)<\/div>/i);
        if (descMatch) description = descMatch[1].replace(/<[^>]+>/g, "").trim();

        const aliases = [];
        const aliasRegex = /<span[^>]*class='TxtAlt'[^>]*>([^<]+)<\/span>/g;
        let aliasMatch;
        while ((aliasMatch = aliasRegex.exec(html)) !== null) {
            const val = aliasMatch[1].trim();
            if (val) aliases.push(val);
        }

        let airdate = "Desconocido";
        const yearMatch = html.match(/published_time.*?(\d{4})/);
        if (yearMatch) airdate = yearMatch[1];

        return JSON.stringify([{
            description: description,
            aliases: aliases.join(", "),
            airdate: airdate
        }]);
    } catch (error) {
        console.log("extractDetails error: " + error);
        return JSON.stringify([{ description: "Error al cargar.", aliases: "", airdate: "Desconocido" }]);
    }
}

async function extractEpisodes(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();
        const htmlLen = html ? html.length : 0;

        if (htmlLen < 1000) {
            console.log("extractEpisodes: HTML bloqueado, largo=" + htmlLen);
            const response2 = await fetchv2(url, {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "es-ES,es;q=0.9",
                "Referer": "https://www.anime-jl.net/"
            });
            const html2 = await response2.text();
            return extractEpisodesFromHtml(html2, url);
        }

        return extractEpisodesFromHtml(html, url);
    } catch (error) {
        console.log("extractEpisodes error: " + error);
        return JSON.stringify([]);
    }
}

function extractEpisodesFromHtml(html, url) {
    const urlMatch = url.match(/\/anime\/(\d+)\/([^\/]+)/);
    let animeId = urlMatch ? urlMatch[1] : null;
    let animeSlug = urlMatch ? urlMatch[2] : null;

    const animeInfoMatch = html.match(/var anime_info\s*=\s*\["(\d+)","[^"]*","([^"]+)"/);
    if (animeInfoMatch) {
        animeId = animeInfoMatch[1];
        animeSlug = animeInfoMatch[2];
    }

    if (!animeId || !animeSlug) {
        console.log("extractEpisodes: no se pudo obtener animeId/animeSlug");
        return JSON.stringify([]);
    }

    const epRegex = /\[(\d+),"(episodio-\d+)"/g;
    const episodes = [];
    const seen = new Set();
    let epMatch;

    while ((epMatch = epRegex.exec(html)) !== null) {
        const epNum = parseInt(epMatch[1]);
        const epSlug = epMatch[2];
        if (seen.has(epNum)) continue;
        seen.add(epNum);
        episodes.push({
            href: "https://www.anime-jl.net/anime/" + animeId + "/" + animeSlug + "/" + epSlug,
            number: epNum
        });
    }

    episodes.sort((a, b) => a.number - b.number);
    return JSON.stringify(episodes);
}

// ─── Helpers de extracción por reproductor ───────────────────────────────────

// Patrón genérico reutilizable: busca m3u8, json file/src, jwplayer, mp4
function findStreamInHtml(html) {
    const m3u8 = html.match(/https?:\/\/[^\s"'\\>]+\.m3u8(?:\?[^\s"'\\>]*)?/i);
    if (m3u8) return m3u8[0];

    const fileJson = html.match(/['"](?:file|src|url|hls)['"]\s*:\s*['"](https?:\/\/[^'"]+\.(?:m3u8|mp4)[^'"]*)['"]/i);
    if (fileJson) return fileJson[1];

    const jwMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*file\s*:\s*['"]([^'"]+)['"]/i);
    if (jwMatch) return jwMatch[1];

    const mp4 = html.match(/https?:\/\/[^\s"'\\>]+\.mp4(?:\?[^\s"'\\>]*)?/i);
    if (mp4) return mp4[0];

    return null;
}

// MONOSCHINOS — embed: https://monoschinos2.com/reproductor?url=...
// o iframe directo con m3u8 en el HTML
async function extractFromMonoschinos(embedUrl) {
    try {
        const resp = await fetchv2(embedUrl, {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.anime-jl.net/",
            "Origin": "https://www.anime-jl.net"
        });
        const html = await resp.text();
        const stream = findStreamInHtml(html);
        if (stream) return stream;

        // Monoschinos a veces anida otro iframe interno
        const innerIframe = html.match(/<iframe[^>]+src=['"]([^'"]+)['"]/i);
        if (innerIframe) {
            let src = innerIframe[1];
            if (src.startsWith("//")) src = "https:" + src;
            if (src.startsWith("http")) {
                const resp2 = await fetchv2(src, {
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
                    "Referer": embedUrl
                });
                return findStreamInHtml(await resp2.text());
            }
        }
        return null;
    } catch (e) {
        console.log("extractFromMonoschinos error: " + e);
        return null;
    }
}

// GUPLOAD — embed: https://gupload.xyz/embed-XXXXX.html
// El m3u8 suele estar en el JS de la página directamente
async function extractFromGupload(embedUrl) {
    try {
        const resp = await fetchv2(embedUrl, {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.anime-jl.net/",
            "Origin": "https://www.anime-jl.net"
        });
        const html = await resp.text();
        return findStreamInHtml(html);
    } catch (e) {
        console.log("extractFromGupload error: " + e);
        return null;
    }
}

// VOE — embed: https://voe.sx/e/XXXXXXX
// Guarda la URL en una variable JS: var wurl = "https://...m3u8"
// o en sources: [{file: "..."}]
async function extractFromVoe(embedUrl) {
    try {
        // Asegurarse de usar la URL de embed
        const normalizedUrl = embedUrl.replace("voe.sx/", "voe.sx/e/").replace("/e/e/", "/e/");

        const resp = await fetchv2(normalizedUrl, {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.anime-jl.net/",
            "Origin": "https://www.anime-jl.net"
        });
        const html = await resp.text();

        // VOE guarda el HLS en variable "wurl" o "hls_2"
        const wurl = html.match(/(?:wurl|hls_2|hls)\s*[=:]\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i);
        if (wurl) return wurl[1];

        // También puede estar en atob() encoded — intentar decodear base64
        const atobMatch = html.match(/atob\(['"]([A-Za-z0-9+/=]+)['"]\)/);
        if (atobMatch) {
            try {
                const decoded = atob(atobMatch[1]);
                const m3u8InDecoded = decoded.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/i);
                if (m3u8InDecoded) return m3u8InDecoded[0];
            } catch(e) {}
        }

        return findStreamInHtml(html);
    } catch (e) {
        console.log("extractFromVoe error: " + e);
        return null;
    }
}

// SAVEFILES — embed: https://savefiles.xyz/XXXXXX o similar
// Funciona como hosting de archivos con m3u8 o mp4 directo
async function extractFromSavefiles(embedUrl) {
    try {
        const resp = await fetchv2(embedUrl, {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.anime-jl.net/",
            "Origin": "https://www.anime-jl.net"
        });
        const html = await resp.text();
        return findStreamInHtml(html);
    } catch (e) {
        console.log("extractFromSavefiles error: " + e);
        return null;
    }
}

// BYSEZOXEXE — embed propio de anime-jl, suele tener m3u8 en el source JS
async function extractFromBysezoxexe(embedUrl) {
    try {
        const resp = await fetchv2(embedUrl, {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.anime-jl.net/",
            "Origin": "https://www.anime-jl.net"
        });
        const html = await resp.text();

        const stream = findStreamInHtml(html);
        if (stream) return stream;

        // bysezoxexe puede tener un iframe interno también
        const innerIframe = html.match(/<iframe[^>]+src=['"]([^'"]+)['"]/i);
        if (innerIframe) {
            let src = innerIframe[1];
            if (src.startsWith("//")) src = "https:" + src;
            if (src.startsWith("http")) {
                const resp2 = await fetchv2(src, {
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
                    "Referer": embedUrl
                });
                return findStreamInHtml(await resp2.text());
            }
        }
        return null;
    } catch (e) {
        console.log("extractFromBysezoxexe error: " + e);
        return null;
    }
}

// ─── Función principal ────────────────────────────────────────────────────────

async function extractStreamUrl(url) {
    try {
        const response = await fetchv2(url, {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.anime-jl.net/",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        });
        const html = await response.text();

        // 1. m3u8 directo en el HTML del episodio
        const directStream = findStreamInHtml(html);
        if (directStream) return directStream;

        // 2. Recolectar todos los iframes y data-src
        const iframes = [];

        const iframeRegex = /<iframe[^>]+src=['"]([^'"]+)['"]/gi;
        let m;
        while ((m = iframeRegex.exec(html)) !== null) {
            let src = m[1];
            if (src.startsWith("//")) src = "https:" + src;
            if (src.startsWith("http")) iframes.push(src);
        }

        // data-src, data-video, data-url en botones/divs de servidor
        const dataRegex = /data-(?:src|video|url|player)=['"]([^'"]+)['"]/gi;
        while ((m = dataRegex.exec(html)) !== null) {
            let src = m[1];
            if (src.startsWith("//")) src = "https:" + src;
            if (src.startsWith("http") && src.length > 15) iframes.push(src);
        }

        // 3. Iterar iframes con extractor específico por reproductor
        for (const iframeUrl of iframes) {
            let streamUrl = null;

            if (iframeUrl.includes("monoschinos")) {
                console.log("Usando monoschinos: " + iframeUrl);
                streamUrl = await extractFromMonoschinos(iframeUrl);

            } else if (iframeUrl.includes("gupload")) {
                console.log("Usando gupload: " + iframeUrl);
                streamUrl = await extractFromGupload(iframeUrl);

            } else if (iframeUrl.includes("voe.sx") || iframeUrl.includes("voe.")) {
                console.log("Usando voe: " + iframeUrl);
                streamUrl = await extractFromVoe(iframeUrl);

            } else if (iframeUrl.includes("savefiles")) {
                console.log("Usando savefiles: " + iframeUrl);
                streamUrl = await extractFromSavefiles(iframeUrl);

            } else if (iframeUrl.includes("bysezoxexe")) {
                console.log("Usando bysezoxexe: " + iframeUrl);
                streamUrl = await extractFromBysezoxexe(iframeUrl);

            } else {
                // Reproductor desconocido — intentar genérico
                console.log("Reproductor genérico: " + iframeUrl);
                try {
                    const r = await fetchv2(iframeUrl, {
                        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
                        "Referer": "https://www.anime-jl.net/",
                        "Origin": "https://www.anime-jl.net"
                    });
                    streamUrl = findStreamInHtml(await r.text());
                } catch (e) {
                    console.log("Genérico error: " + e);
                }
            }

            if (streamUrl) return streamUrl;
        }

        console.log("extractStreamUrl: no se encontró stream en " + url);
        return null;

    } catch (error) {
        console.log("extractStreamUrl error: " + error);
        return null;
    }
}
