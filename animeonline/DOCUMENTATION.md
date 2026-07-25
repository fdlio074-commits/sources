# SoloLatino Module Documentation

## Getting Started

Este módulo proporciona funcionalidades para scraping de contenido de anime, series y películas desde **sololatino.net**.

### Características

- ✅ Búsqueda de contenido
- ✅ Extracción de detalles (descripción, año, tipo)
- ✅ Extracción de episodios
- ✅ Obtención de URLs de streaming (HLS)
- ✅ Soporte para series, películas y doramas

### Configuración

```json
{
  "sourceName": "SoloLatino",
  "baseUrl": "https://sololatino.net",
  "language": "Spanish (LAT)",
  "streamType": "HLS",
  "quality": "1080p"
}
```

---

## JSON Schema

El módulo utiliza el siguiente esquema JSON para configuración:

```json
{
  "sourceName": "string",
  "iconUrl": "string (URL)",
  "author": {
    "name": "string",
    "icon": "string (URL)"
  },
  "version": "string (semver)",
  "language": "string",
  "streamType": "enum: HLS, DASH, HTTP",
  "quality": "string",
  "baseUrl": "string (URL)",
  "searchBaseUrl": "string (URL con %s)",
  "scriptUrl": "string (URL)",
  "asyncJS": "boolean",
  "streamAsyncJS": "boolean",
  "softsub": "boolean",
  "type": "string (anime, manga, movies)"
}
```

---

## Module Functions

### searchResults(html)

Extrae resultados de búsqueda de la página HTML.

**Parámetros:**
- `html` (string): HTML de la página de búsqueda

**Retorna:**
- Array de objetos con: `{ title, image, href }`

**Ejemplo:**
```javascript
const results = searchResults(pageHTML);
// Retorna: [
//   { title: "Naruto", image: "https://...", href: "https://sololatino.net/serie/naruto" },
//   { title: "One Piece", image: "https://...", href: "https://sololatino.net/serie/one-piece" }
// ]
```

---

### extractDetails(html)

Extrae información detallada de una serie/película.

**Parámetros:**
- `html` (string): HTML de la página de detalles

**Retorna:**
- Array con objeto: `{ description, aliases, airdate }`

**Información extraída:**
- `description`: Sinopsis de la serie/película
- `aliases`: Tipo de contenido (Anime, Serie, Película, Dorama)
- `airdate`: Año de estreno

**Ejemplo:**
```javascript
const details = extractDetails(pageHTML);
// Retorna: [{
//   description: "Naruto es un joven ninja...",
//   aliases: "Anime",
//   airdate: "2002"
// }]
```

---

### extractEpisodes(html)

Extrae la lista de episodios disponibles.

**Parámetros:**
- `html` (string): HTML de la página de serie

**Retorna:**
- Array de episodios: `{ href, number }`

**Formato de número:**
- Cálculo: `(season - 1) * 1000 + episode`
- Ejemplo: Temporada 1, Episodio 5 = 1005

**Ejemplo:**
```javascript
const episodes = extractEpisodes(pageHTML);
// Retorna: [
//   { href: "https://sololatino.net/serie/naruto/temporada-1/episodio-1", number: "1001" },
//   { href: "https://sololatino.net/serie/naruto/temporada-1/episodio-2", number: "1002" }
// ]
```

---

### extractStreamUrl(html) - Async

Extrae la URL de streaming del episodio.

**Parámetros:**
- `html` (string): HTML de la página del episodio

**Retorna:**
- string: URL del stream (m3u8 o embed), o null si no se encuentra

**Características:**
- Busca CSRF token en meta tags
- Realiza request a API de SoloLatino
- Busca URLs m3u8 (HLS)
- Soporta embeds alternativos
- Manejo de errores silencioso

**Ejemplo:**
```javascript
const streamUrl = await extractStreamUrl(pageHTML);
// Retorna: "https://stream.example.com/video.m3u8"
// o: "https://embed.example.com/player?id=123"
```

---

## Tips and Troubleshooting

### ¿Qué hago si no se encuentran episodios?

1. Verifica que el regex de episodios coincida con el HTML actual
2. Revisa si SoloLatino ha cambiado su estructura HTML
3. Actualiza los patrones regex según sea necesario

### ¿Qué hago si el stream no funciona?

1. Verifica que el CSRF token se extraiga correctamente
2. Comprueba que la URL de la API sea accesible
3. Busca URLs m3u8 válidas en la respuesta
4. Intenta con URLs embed como fallback

### Errores comunes

| Error | Solución |
|-------|----------|
| No se encuentran resultados | Verifica el regex de búsqueda |
| CSRF token undefined | Actualiza el meta tag donde se almacena |
| Stream retorna null | Comprueba disponibilidad del contenido |
| Episodios vacíos | Revisa estructura de URLs de SoloLatino |

### Performance

- Las búsquedas son sincrónicas (rápidas)
- La extracción de streams es asincrónica (puede tardar)
- Implementa caché para URLs frecuentes

---

## Distributing

Para distribuir este módulo:

1. **Asegúrate de tener**:
   - `animeonline.json` con metadata
   - `animeonline.js` con funciones
   - `icon.png` (icono del proveedor)

2. **Versionado**:
   - Sigue semver (MAJOR.MINOR.PATCH)
   - Actualiza versión en `animeonline.json`

3. **Publicación**:
   - Push a rama `main`
   - Tag con versión: `v1.0.0`
   - Crea release en GitHub

4. **Compatibilidad**:
   - Mantén retrocompatibilidad en cambios MINOR
   - Documenta breaking changes en MAJOR

---

## Versión

- **Versión actual**: 1.0.0
- **Última actualización**: 2026-07-25
- **Mantenedor**: Fdlio
