async function searchResults(keyword) {
    const results = [];
    try {
        const response = await fetchv2("https://anime-jl.net/animes?q=" + encodeURIComponent(keyword));
        const html = await response.text();

        const regex = /<article[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<a[^>]+href="(\/anime\/[^"]+)"[^>]*>\s*([^<]+)<\/a>/g;

        let match;
        while ((match = regex.exec(html)) !== null) {
            results.push({
                title: match[3].trim(),
                image: match[1].trim(),
                href: "https://anime-jl.net" + match[2].trim()
            });
        }

        return JSON.stringify(results);
    } catch (err) {
        console.error("Search error:", err);
        return JSON.stringify([{ title: "Error", image: "", href: "" }]);
    }
}

async function extractDetails(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const descMatch = html.match(/<div[^>]*class="[^"]*sinopsis[^"]*"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/i)
            || html.match(/<p[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
        const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : "Sin descripción";

        const yearMatch = html.match(/(\d{4})/);
        const airdate = yearMatch ? yearMatch[1] : "N/A";

        return JSON.stringify([{
            description,
            aliases: "N/A",
            airdate
        }]);
    } catch (err) {
        return JSON.stringify([{ description: "Error", aliases: "N/A", airdate: "N/A" }]);
    }
}

async function extractEpisodes(url) {
    const results = [];
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const regex = /<a[^>]+href="(\/anime\/[^"]*\/episodio-(\d+)[^"]*)"[^>]*>/g;

        let match;
        while ((match = regex.exec(html)) !== null) {
            results.push({
                href: "https://anime-jl.net" + match[1].trim(),
                number: parseInt(match[2], 10)
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

        const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/i);
        if (iframeMatch) {
            return iframeMatch[1];
        }

        const m3u8Match = html.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i);
        if (m3u8Match) return m3u8Match[0];

        return null;
    } catch (err) {
        return null;
    }
}
