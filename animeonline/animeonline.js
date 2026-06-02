async function execute() {
    let url = Sora.url || "";

    // 1. Si la URL contiene '/episodio-', ejecuta la lógica de episodios
    if (url.includes('/episodio-')) {
        return await executeEpisode();
    }
    
    // 2. Si la URL contiene '/anime/', ejecuta la lógica de detalles
    if (url.includes('/anime/')) {
        return await executeDetail();
    }
    
    // 3. Por defecto, si está en la URL de búsqueda, ejecuta la búsqueda
    return await executeSearch();
}

// ==========================================
// SECCIÓN: BÚSQUEDA
// ==========================================
async function executeSearch() {
    let html = Sora.html; 
    let results = [];
    let elements = html.querySelectorAll('.anime-block, .card, .col-md-3, .col-6'); 

    elements.forEach(el => {
        let titleEl = el.querySelector('h3, .title, a, .card-title');
        let imgEl = el.querySelector('img');
        let linkEl = el.querySelector('a');

        if (titleEl && linkEl) {
            let animeUrl = linkEl.getAttribute('href');
            if (animeUrl.startsWith('/')) {
                animeUrl = 'https://anime-jl.net' + animeUrl;
            }

            results.push({
                title: titleEl.textContent.trim(),
                image: imgEl ? imgEl.getAttribute('src') : '',
                url: animeUrl
            });
        }
    });

    return JSON.stringify(results);
}

// ==========================================
// SECCIÓN: DETALLE
// ==========================================
async function executeDetail() {
    let html = Sora.html;
    
    let title = html.querySelector('h1, .anime-title, .title').textContent.trim();
    let description = html.querySelector('.synopsis, .description, p').textContent.trim();
    let image = html.querySelector('.poster img, .anime-image, img').getAttribute('src');
    
    let episodes = [];
    let epElements = html.querySelectorAll('a[href*="/episodio-"]');
    
    epElements.forEach((ep, index) => {
        let epUrl = ep.getAttribute('href');
        if (epUrl.startsWith('/')) {
            epUrl = 'https://anime-jl.net' + epUrl;
        }

        episodes.push({
            name: ep.textContent.trim() || `Episodio ${index + 1}`,
            url: epUrl
        });
    });

    return JSON.stringify({
        title: title,
        description: description,
        image: image,
        episodes: episodes.reverse() 
    });
}

// ==========================================
// SECCIÓN: EPISODIO
// ==========================================
async function executeEpisode() {
    let html = Sora.html;
    let videoSources = [];
    let iframes = html.querySelectorAll('iframe, .video-player iframe');
    
    iframes.forEach(iframe => {
        let src = iframe.getAttribute('src') || iframe.getAttribute('data-src');
        if (src) {
            if (src.startsWith('//')) src = 'https:' + src;
            
            videoSources.push({
                name: obtenerNombreServidor(src),
                url: src,
                isEmbed: true
            });
        }
    });

    return JSON.stringify(videoSources);
}

function obtenerNombreServidor(url) {
    if (url.includes('mega.nz')) return 'Mega';
    if (url.includes('ok.ru')) return 'Okru';
    if (url.includes('fembed') || url.includes('feurl')) return 'Fembed';
    if (url.includes('streamtape')) return 'Streamtape';
    return 'Reproductor Externo';
}
