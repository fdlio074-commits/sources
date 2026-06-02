async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const response = await fetch(`https://anime-jl.net/animes?q=${encodedKeyword}`);
        const $ = load(response);

        const results = [];
        $('article.anime, div.anime-card, .ListAnimes article').each((el) => {
            const title = $('h3, .Title', el).text().trim();
            const image = $('img', el).attr('src') || $('img', el).attr('data-src') || '';
            const href = $('a', el).attr('href') || '';
            if (title && href) {
                results.push({
                    title: title,
                    image: image,
                    href: href.startsWith('http') ? href : `https://anime-jl.net${href}`
                });
            }
        });

        return JSON.stringify(results);
    } catch (error) {
        console.log('Search error:', error);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

async function extractDetails(url) {
    try {
        const response = await fetch(url);
        const $ = load(response);

        const description = $('div.Description p, .sinopsis, .anime-description').first().text().trim()
            || 'No description available';
        const aliases = $('span.Aliases, .otros-nombres').text().trim() || '';
        const airdate = $('span.Date, .fecha-emision, .year').text().trim() || '';

        return JSON.stringify([{
            description: description,
            aliases: aliases,
            airdate: airdate
        }]);
    } catch (error) {
        console.log('Details error:', error);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: '',
            airdate: ''
        }]);
    }
}

async function extractEpisodes(url) {
    try {
        const response = await fetch(url);
        const $ = load(response);

        const episodes = [];
        $('ul.ListCaps li, .episodes-list li, .capitulos li').each((el) => {
            const epHref = $('a', el).attr('href') || '';
            const epNum = $('p.Num, .num-epi, span', el).text().trim() || '1';
            if (epHref) {
                episodes.push({
                    href: epHref.startsWith('http') ? epHref : `https://anime-jl.net${epHref}`,
                    number: epNum
                });
            }
        });

        return JSON.stringify(episodes);
    } catch (error) {
        console.log('Episodes error:', error);
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
    try {
        const response = await fetch(url);
        const $ = load(response);

        // Buscar iframe o fuente de video embebida
        const iframe = $('iframe#PlayerFrame, iframe.player-embed, iframe').first().attr('src') || '';
        if (iframe) {
            return iframe.startsWith('http') ? iframe : `https://anime-jl.net${iframe}`;
        }

        // Buscar source directo
        const source = $('source[src]').first().attr('src') || '';
        if (source) return source;

        return null;
    } catch (error) {
        console.log('Stream error:', error);
        return null;
    }
}
