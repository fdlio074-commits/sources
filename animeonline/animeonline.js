// Módulo Sora: Anime-JL
// Estructura confirmada:
// Anime: /anime/ID/nombre-del-anime
// Episodio: /anime/ID/nombre-del-anime/episodio-N

const AnimeJL = {
    // --------------------------
    // Obtener listado de animes / página principal
    // --------------------------
    async obtenerListado() {
        const $ = await Sora.fetch(`${this.urlBase}/animes`);
        const animes = [];

        $(".anime-card, .item-anime, .card-anime").each((_, el) => {
            const titulo = $(el).find("h2, h3, .titulo, .nombre").text().trim();
            const enlace = $(el).find("a").attr("href");
            const portada = $(el).find("img").attr("src");
            const tipo = $(el).find(".etiqueta, .tipo").text().trim() || "Anime";

            if (enlace) {
                animes.push({
                    titulo,
                    enlace: new URL(enlace, this.urlBase).href,
                    portada: new URL(portada || "", this.urlBase).href,
                    tipo
                });
            }
        });
        return animes;
    },

    // --------------------------
    // Búsqueda: usa la ruta que definimos en el JSON
    // --------------------------
    async buscarAnime(texto) {
        const $ = await Sora.fetch(`${this.urlBase}${this.searchBaseUrl}${encodeURIComponent(texto)}`);
        const resultados = [];

        $(".result-item, .anime-item, .busqueda-item").each((_, el) => {
            const titulo = $(el).find("h2, h3, .titulo").text().trim();
            const enlace = $(el).find("a").attr("href");
            const portada = $(el).find("img").attr("src");

            if (enlace) {
                resultados.push({
                    titulo,
                    enlace: new URL(enlace, this.urlBase).href,
                    portada: new URL(portada || "", this.urlBase).href
                });
            }
        });
        return resultados;
    },

    // --------------------------
    // Obtener episodios de un anime
    // Ejemplo URL: https://anime-jl.net/anime/2339/rent-a-girlfriend-season-5-latino-v2
    // --------------------------
    async obtenerEpisodios(urlAnime) {
        const $ = await Sora.fetch(urlAnime);
        const episodios = [];

        // Detecta todos los enlaces que terminan en /episodio-N
        $("a[href*='/episodio-']").each((_, el) => {
            const enlace = $(el).attr("href");
            const texto = $(el).text().trim();
            // Extrae solo el número del episodio
            const numero = texto.replace(/\D/g, "") || (episodios.length + 1);

            if (enlace) {
                episodios.push({
                    titulo: `Episodio ${numero}`,
                    numero: parseInt(numero),
                    enlace: new URL(enlace, this.urlBase).href
                });
            }
        });

        // Ordena los episodios del 1 en adelante
        return episodios.sort((a, b) => a.numero - b.numero);
    },

    // --------------------------
    // Obtener enlaces de reproducción y descarga
    // Ejemplo URL: https://anime-jl.net/anime/2339/rent-a-girlfriend-season-5-latino-v2/episodio-2
    // --------------------------
    async obtenerEnlaces(urlEpisodio) {
        const $ = await Sora.fetch(urlEpisodio);
        const enlaces = {
            reproduccion: [],
            descarga: []
        };

        // Servidores de reproducción (iframes o datos en atributos)
        $(".servidor, .opcion-servidor, .tab-pane").each((_, el) => {
            const nombreServidor = $(el).find("button, .nombre-servidor").text().trim() || $(el).attr("id") || "Servidor";
            const urlVideo = $(el).attr("data-url") || $(el).find("iframe").attr("src");
            
            if (urlVideo) {
                enlaces.reproduccion.push({
                    servidor: nombreServidor,
                    url: new URL(urlVideo, this.urlBase).href
                });
            }
        });

        // Enlaces de descarga (específicamente Mega, como indica la web)
        $("a[href*='mega.nz']").each((_, el) => {
            const texto = $(el).text().trim();
            enlaces.descarga.push({
                servidor: "Mega",
                calidad: texto.includes("HD") ? "HD" : "SD",
                url: $(el).attr("href")
            });
        });

        return enlaces;
    }
};

// Registrar módulo
Sora.registrarModulo(AnimeJL);