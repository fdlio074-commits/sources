async function searchResults(keyword) {
    try {
        const response = await fetchv2("https://kawaiines.onrender.com/api/anime");
        const data = await response.json();

        const results = data
            .filter(anime => anime.title.toLowerCase().includes(keyword.toLowerCase()))
            .map(anime => ({
                title: anime.title,
                image: anime.image,
                href: anime.animeUrl
            }));

        return JSON.stringify(results);
    } catch (err) {
        console.error(err);
        return JSON.stringify([{
            title: "Error",
            image: "Error",
            href: "Error"
        }]);
    }
}

async function extractDetails(id) {
    try {
        const response = await fetchv2(`https://kawaiines.onrender.com/api/anime/url/${id}`);
        const json = await response.json();

        return JSON.stringify([{
            description: json.description || "N/A",
            aliases: "N/A",
            airdate: json.date || "N/A"
        }]);
    } catch (err) {
        return JSON.stringify([{
            description: "Error",
            aliases: "Error",
            airdate: "Error"
        }]);
    }
}

async function extractEpisodes(id) {
    const results = [];
    try {
        const response = await fetchv2(`https://kawaiines.onrender.com/api/anime/url/${id}`);
        const json = await response.json();

        for (const [number, url] of Object.entries(json.videoIds)) {
            if (url.includes("drive.google.com")) continue;

            let href = url;
            if (url.includes("strmup.cc/")) {
                href = url.split("/").pop();
            }

            results.push({
                href: href,
                number: parseInt(number, 10)
            });
        }

        return JSON.stringify(results);
    } catch (err) {
        return JSON.stringify([{
            href: "Error",
            number: "Error"
        }]);
    }
}

async function extractStreamUrl(id) {
    try {
        const response = await fetchv2(`https://strmup.cc/ajax/stream?filecode=${id}`);
        const json = await response.json();

        return json.streaming_url || "https://error.org/";
    } catch (err) {
        return "https://error.org/";
    }
}
