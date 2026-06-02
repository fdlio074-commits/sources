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
            results.push({ title, image, href });
        }
        return JSON.stringify(results);
    } catch (e) {
        console.log("searchResults error: " + e);
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
        return JSON.stringify([{ description, aliases: aliases.join(", "), airdate }]);
    } catch (e) {
        console.log("extractDetails error: " + e);
        return JSON.stringify([{ description: "Error al cargar.", aliases: "", airdate: "Desconocido" }]);
    }
}

async function extractEpisodes(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();
        if (!html || html.length < 1000) {
            const response2 = await fetchv2(url, {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "es-ES,es;q=0.9",
                "Referer": "https://www.anime-jl.net/"
            });
            return extractEpisodesFromHtml(await response2.text(), url);
        }
        return extractEpisodesFromHtml(html, url);
    } catch (e) {
        console.log("extractEpisodes error: " + e);
        return JSON.stringify([]);
    }
}

function extractEpisodesFromHtml(html, url) {
    const urlMatch = url.match(/\/anime\/(\d+)\/([^\/]+)/);
    let animeId = urlMatch ? urlMatch[1] : null;
    let animeSlug = urlMatch ? urlMatch[2] : null;
    const animeInfoMatch = html.match(/var anime_info\s*=\s*\["(\d+)","[^"]*","([^"]+)"/);
    if (animeInfoMatch) { animeId = animeInfoMatch[1]; animeSlug = animeInfoMatch[2]; }
    if (!animeId || !animeSlug) return JSON.stringify([]);
    const epRegex = /\[(\d+),"(episodio-\d+)"/g;
    const episodes = [];
    const seen = new Set();
    let epMatch;
    while ((epMatch = epRegex.exec(html)) !== null) {
        const epNum = parseInt(epMatch[1]);
        if (seen.has(epNum)) continue;
        seen.add(epNum);
        episodes.push({
            href: "https://www.anime-jl.net/anime/" + animeId + "/" + animeSlug + "/" + epMatch[2],
            number: epNum
        });
    }
    episodes.sort((a, b) => a.number - b.number);
    return JSON.stringify(episodes);
}

// ─── Helper genérico: busca stream en HTML ────────────────────────────────────
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

// ─── MONOSCHINOS / MINOCHINOS ─────────────────────────────────────────────────
// El stream está en el código JS ofuscado de la página embed.
// Patrón clave del HTML desofuscado:
//   file_code = "XXXX"
//   file_id   = "NNNNNN"   ← este es el "hash"
//   file_real = "YYYY"
// URL final: /dl?op=view&file_code=XXXX&hash=NNNNNN-TIMESTAMP-MD5&embed=1
// Pero el hash completo se puede obtener del request a mosevura.com
// que aparece en el JS como: logs.mosevura.com/dl?...&file_id=NNNNNN&file_real=YYYY
// La URL directa del stream está dentro del JS como hls2/hls3/hls4 en qualityLabels
async function extractFromMinochinos(embedUrl) {
    try {
        // Extraer el file_code de la URL embed
        const fileCodeMatch = embedUrl.match(/\/embed\/([a-zA-Z0-9]+)/);
        if (!fileCodeMatch) return null;
        const fileCode = fileCodeMatch[1];

        const resp = await fetchv2(embedUrl, {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.anime-jl.net/",
            "Origin": "https://www.anime-jl.net"
        });
        const html = await resp.text();

        // 1. Buscar m3u8 directo (a veces está sin ofuscar)
        const directM3u8 = html.match(/https?:\/\/[^\s"'\\>]+\.m3u8(?:\?[^\s"'\\>]*)?/i);
        if (directM3u8) return directM3u8[0];

        // 2. Buscar file_id y file_real dentro del JS ofuscado
        //    Aparecen como strings en el array de palabras clave del eval()
        const fileIdMatch = html.match(/['"]?(?:file_id|41655943|hash)['"]?\s*[=:,]\s*['"]?(\d{6,12})['"]?/i);
        const fileRealMatch = html.match(/file_real['":\s]+['"]([a-zA-Z0-9_]+)['"]/i);

        if (fileIdMatch && fileRealMatch) {
            const fileId = fileIdMatch[1];
            const fileReal = fileRealMatch[1];
            // Construir URL de stream directamente
            const dlUrl = "https://minochinos.com/dl?op=view&file_code=" + fileCode +
                          "&hash=" + fileId + "&file_real=" + fileReal + "&embed=1";
            console.log("minochinos dlUrl: " + dlUrl);

            const dlResp = await fetchv2(dlUrl, {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                "Referer": embedUrl
            });
            const dlHtml = await dlResp.text();
            const stream = findStreamInHtml(dlHtml);
            if (stream) return stream;
        }

        // 3. Buscar la URL del CDN directamente en el JS ofuscado
        //    El array de palabras clave contiene 'dramiyos' o el dominio CDN y 'm3u8'
        const cdnMatch = html.match(/['"]([a-zA-Z0-9_\-]+)['"]\s*,\s*['"]m3u8['"]/i);
        if (cdnMatch) {
            // Reconstruir posible URL
            const possibleUrl = "https://cdn.dramiyos.com/" + fileCode + "/" + cdnMatch[1] + ".m3u8";
            console.log("minochinos CDN guess: " + possibleUrl);
            return possibleUrl;
        }

        // 4. Buscar cualquier dominio CDN conocido + m3u8 en el array de palabras
        const cdnDomains = ['dramiyos', 'earnvids', 'mosevura'];
        for (const cdn of cdnDomains) {
            const cdnIdx = html.indexOf(cdn);
            if (cdnIdx !== -1) {
                // Buscar m3u8 cerca de ese dominio
                const nearby = html.substring(Math.max(0, cdnIdx - 200), cdnIdx + 500);
                const nearbyM3u8 = nearby.match(/https?:\/\/[^\s"'\\>]+\.m3u8(?:\?[^\s"'\\>]*)?/i);
                if (nearbyM3u8) return nearbyM3u8[0];
            }
        }

        return null;
    } catch (e) {
        console.log("extractFromMinochinos error: " + e);
        return null;
    }
}

// ─── VOE.SX ───────────────────────────────────────────────────────────────────
async function extractFromVoe(embedUrl) {
    try {
        const normalizedUrl = embedUrl.includes("/e/") ? embedUrl :
            embedUrl.replace("voe.sx/", "voe.sx/e/");
        const resp = await fetchv2(normalizedUrl, {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.anime-jl.net/"
        });
        const html = await resp.text();
        // VOE guarda HLS en variable wurl, hls_2, hls3
        const wurl = html.match(/(?:wurl|hls_2|hls3|hls)\s*[=:]\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i);
        if (wurl) return wurl[1];
        // Puede estar en atob()
        const atobMatch = html.match(/atob\(['"]([A-Za-z0-9+/=]{20,})['"]\)/);
        if (atobMatch) {
            try {
                const decoded = atob(atobMatch[1]);
                const m3u8 = decoded.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/i);
                if (m3u8) return m3u8[0];
            } catch(e) {}
        }
        return findStreamInHtml(html);
    } catch (e) {
        console.log("extractFromVoe error: " + e);
        return null;
    }
}

// ─── GUPLOAD ──────────────────────────────────────────────────────────────────
async function extractFromGupload(embedUrl) {
    try {
        const resp = await fetchv2(embedUrl, {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.anime-jl.net/"
        });
        return findStreamInHtml(await resp.text());
    } catch (e) {
        console.log("extractFromGupload error: " + e);
        return null;
    }
}

// ─── SAVEFILES / BYSEZOXEXE (mismo patrón) ───────────────────────────────────
async function extractFromGeneric(embedUrl, referer) {
    try {
        const resp = await fetchv2(embedUrl, {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": referer || "https://www.anime-jl.net/",
            "Origin": "https://www.anime-jl.net"
        });
        const html = await resp.text();
        const stream = findStreamInHtml(html);
        if (stream) return stream;
        // Seguir iframe interno si hay
        const inner = html.match(/<iframe[^>]+src=['"]([^'"]+)['"]/i);
        if (inner) {
            let src = inner[1];
            if (src.startsWith("//")) src = "https:" + src;
            if (src.startsWith("http")) {
                const r2 = await fetchv2(src, {
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
                    "Referer": embedUrl
                });
                return findStreamInHtml(await r2.text());
            }
        }
        return null;
    } catch (e) {
        console.log("extractFromGeneric error (" + embedUrl + "): " + e);
        return null;
    }
}

// ─── FUNCIÓN PRINCIPAL ────────────────────────────────────────────────────────
async function extractStreamUrl(url) {
    try {
        const response = await fetchv2(url, {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.anime-jl.net/",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        });
        const html = await response.text();

        // 1. Stream directo en el HTML del episodio
        const direct = findStreamInHtml(html);
        if (direct) return direct;

        // 2. Recolectar iframes y data-src
        const iframes = [];
        const iframeRegex = /<iframe[^>]+src=['"]([^'"]+)['"]/gi;
        let m;
        while ((m = iframeRegex.exec(html)) !== null) {
            let src = m[1];
            if (src.startsWith("//")) src = "https:" + src;
            if (src.startsWith("http")) iframes.push(src);
        }
        const dataRegex = /data-(?:src|video|url|player)=['"]([^'"]{10,})['"]/gi;
        while ((m = dataRegex.exec(html)) !== null) {
            let src = m[1];
            if (src.startsWith("//")) src = "https:" + src;
            if (src.startsWith("http")) iframes.push(src);
        }

        console.log("iframes encontrados: " + iframes.length + " -> " + iframes.join(" | "));

        // 3. Procesar cada iframe con su extractor
        for (const iframeUrl of iframes) {
            let stream = null;

            if (iframeUrl.includes("minochinos") || iframeUrl.includes("monoschinos")) {
                console.log("→ minochinos/monoschinos: " + iframeUrl);
                stream = await extractFromMinochinos(iframeUrl);
            } else if (iframeUrl.includes("voe.sx") || iframeUrl.includes("voe.")) {
                console.log("→ voe: " + iframeUrl);
                stream = await extractFromVoe(iframeUrl);
            } else if (iframeUrl.includes("gupload")) {
                console.log("→ gupload: " + iframeUrl);
                stream = await extractFromGupload(iframeUrl);
            } else if (iframeUrl.includes("savefiles") || iframeUrl.includes("bysezoxexe")) {
                console.log("→ savefiles/bysezoxexe: " + iframeUrl);
                stream = await extractFromGeneric(iframeUrl, url);
            } else {
                console.log("→ genérico: " + iframeUrl);
                stream = await extractFromGeneric(iframeUrl, url);
            }

            if (stream) {
                console.log("✓ stream encontrado: " + stream);
                return stream;
            }
        }

        console.log("✗ no se encontró stream en: " + url);
        return null;
    } catch (e) {
        console.log("extractStreamUrl error: " + e);
        return null;
    }
}
