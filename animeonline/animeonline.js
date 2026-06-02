async function searchResults(keyword) {
    const results = [];
    try {
        // TioAnime tiene una API interna de búsqueda
        const response = await fetchv2("https://tioanime.com/directorio?q=" + encodeURIComponent(keyword));
        const html = await response.text();

        // Formato: [img Title](https://tioanime.com/anime/slug)
        // En HTML: <a href="/anime/slug"><img src="..."><p>Title</p></a>
        const regex = /href="(\/anime\/[^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<p[^>]*>([^<]+)<\/p>/g;
        let match;
        while ((match = regex.exec(html)) !== null) {
            const title = match[3].trim();
            if (title.toLowerCase().includes(keyword.toLowerCase())) {
                results.push({
                    title: title,
                    image: "https://tioanime.com" + match[2].trim(),
                    href: "https://tioanime.com" + match[1].trim()
                });
            }
        }

        // Fallback: regex más amplio
        if (results.length === 0) {
            const regex2 = /href="(\/anime\/[^"]+)"[\s\S]*?src="([^"]+)"[\s\S]*?alt="([^"]+)"/g;
            while ((match = regex2.exec(html)) !== null) {
                const title = match[3].trim();
                if (title.toLowerCase().includes(keyword.toLowerCase())) {
                    results.push({
                        title: title,
                        image: match[2].startsWith("http") ? match[2].trim() : "https://tioanime.com" + match[2].trim(),
                        href: "https://tioanime.com" + match[1].trim()
                    });
                }
            }
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

        const descMatch = html.match(/sinopsis[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)
            || html.match(/<p>(Naruto|[\s\S]{20,500}?)<\/p>/);
        const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, "").trim() : "N/A";

        const airdateMatch = html.match(/(\d{4})/);
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
