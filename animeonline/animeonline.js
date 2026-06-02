async function searchResults(keyword) {
    const results = [];
    try {
        const response = await fetchv2("https://tioanime.com/buscar?q=" + encodeURIComponent(keyword));
        const html = await response.text();

        const regex = /<a[^>]+href="(https?:\/\/tioanime\.com\/anime\/[^"]+)"[^>]*>[\s\S]*?<img[^>]+(?:src|data-src)="([^"]+)"[\s\S]*?<\/a>/g;
        let match;
        while ((match = regex.exec(html)) !== null) {
            const href = match[1].trim();
            const image = match[2].trim();
            const titleMatch = match[0].match(/(?:alt|title)="([^"]+)"/i);
            const title = titleMatch ? titleMatch[1].trim() : href.split("/anime/")[1]?.replace(/-/g, " ") || "Unknown";
            results.push({ title, image, href });
        }

        return JSON.stringify(results);
    } catch (err) {
        console.error("Search error:", err);
        return JSON.stringify([]);
    }
}

async function extractDetails(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const descMatch = html.match(/<p[^>]*class="[^"]*sinopsis[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
            || html.match(/<div[^>]*class="[^"]*sinopsis[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, "").trim() : "N/A";

        const airdateMatch = html.match(/(?:Año|Estreno)[^\d]*(\d{4})/i);
        const airdate = airdateMatch ? airdateMatch[1] : "N/A";

        return JSON.stringify([{ description, aliases: "N/A", airdate }]);
    } catch (err) {
        return JSON.stringify([{ description: "Error", aliases: "Error", airdate: "Error" }]);
    }
}

async function extractEpisodes(url) {
    const results = [];
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const slug = url.split("/anime/")[1]?.replace(/\/$/, "") || "";

        const epDataMatch = html.match(/var\s+episodes\s*=\s*(\[[\s\S]*?\]);/);
        if (epDataMatch) {
            const epData = JSON.parse(epDataMatch[1]);
            epData.forEach((ep) => {
                const num = Array.isArray(ep) ? ep[0] : ep;
                results.push({
                    href: "https://tioanime.com/ver/" + slug + "-" + num,
                    number: parseInt(num, 10)
                });
            });
        }

        return JSON.stringify(results);
    } catch (err) {
        return JSON.stringify([{ href: "Error", number: 0 }]);
    }
}

async function extractStreamUrl(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const videosMatch = html.match(/var\s+videos\s*=\s*(\[[\s\S]*?\]);/);
        if (videosMatch) {
            const videos = JSON.parse(videosMatch[1]);
            for (const item of videos) {
                const embedUrl = item[1] || "";
                if (!embedUrl) continue;

                if (embedUrl.includes(".m3u8")) return embedUrl;

                const embedResp = await fetchv2(embedUrl);
                const embedHtml = await embedResp.text();

                const m3u8 = (embedHtml.match(/file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)/i) || [])[1]
                    || (embedHtml.match(/"file"\s*:\s*"([^"]+\.m3u8[^"]*)"/i) || [])[1]
                    || (embedHtml.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i) || [])[1];

                if (m3u8) return m3u8.trim();
            }
        }

        const m3u8Direct = (html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i) || [])[1];
        if (m3u8Direct) return m3u8Direct;

        return "https://files.catbox.moe/avolvc.mp4";
    } catch (err) {
        return "https://files.catbox.moe/avolvc.mp4";
    }
}
