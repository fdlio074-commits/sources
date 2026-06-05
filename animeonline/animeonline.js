async function searchResults(keyword) {
    const results = [];
    try {
        const response = await fetchv2("https://www.cinecalidad.ec/?s=" + encodeURIComponent(keyword));
        const html = await response.text();
        
        const containerMatch = html.match(/<div id="archive-content"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/);
        if (containerMatch) {
            const container = containerMatch[1];

            const regex = /<article[^>]*>([\s\S]*?)<\/article>/g;
            
            let articleMatch;
            while ((articleMatch = regex.exec(container)) !== null) {
                const articleContent = articleMatch[1];
                
                const imageMatch = articleContent.match(/data-src="([^"]+)"/);
                
                const hrefMatch = articleContent.match(/<a href="([^"]+)"/);
                
                const titleMatch = articleContent.match(/<div class="in_title">([^<]+)<\/div>/);
                
                if (imageMatch && hrefMatch && titleMatch) {
                    results.push({
                        title: titleMatch[1].trim(),
                        image: imageMatch[1].trim(),
                        href: hrefMatch[1].trim()
                    });
                }
            }
        }
        return JSON.stringify(results);
    } catch (err) {
        return JSON.stringify([{
            title: "Error",
            image: "Error",
            href: "Error"
        }]);
    }
}

async function extractDetails(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();
        
        const descMatch = html.match(/<p><p>([^<]+)<\/p>/);
        
        const description = descMatch ? descMatch[1].trim() : "N/A";
        
        return JSON.stringify([{
            description
        }]);
    } catch (err) {
        return JSON.stringify([{
            description: "Error"
        }]);
    }
}

async function extractEpisodes(url) {
    const results = [];
    try {
        const response = await fetchv2(url);
        const html = await response.text();
        
        const seasonRegex = /<div id="jstab"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
        let seasonMatch;
        
        while ((seasonMatch = seasonRegex.exec(html)) !== null) {
            const seasonContent = seasonMatch[1];
            
            const episodeRegex = /<a href="([^"]+)"[^>]*>Episodio \d+<\/a>/g;
            let episodeMatch;
            let episodeCount = 1;
            
            while ((episodeMatch = episodeRegex.exec(seasonContent)) !== null) {
                results.push({
                    href: episodeMatch[1].trim(),
                    number: episodeCount
                });
                episodeCount++;
            }
        }
        
        if (results.length === 0) {
            results.push({
                href: url,
                number: 1
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

async function extractStreamUrl(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const match = html.match(/data-option="(https:\/\/lamovie\.link\/embed-[^"]+)"/);
        if (!match) return "https://error.org/";

        const embedUrl = match[1];
        const embedResponse = await fetchv2(embedUrl);
        const embedHtml = await embedResponse.text();

        const obfuscatedScript = embedHtml.match(/<script[^>]*>\s*(eval\(function\(p,a,c,k,e,d.*?\)[\s\S]*?)<\/script>/);
        if (!obfuscatedScript) return "https://error.org/";

        const unpackedScript = unpack(obfuscatedScript[1]);

        const fileMatch = unpackedScript.match(/file:\s*"([^"]+)"/);
        if (!fileMatch) return "https://error.org/";

        return fileMatch[1];
    } catch (err) {
        return "https://error.org/";
    }
}


/***********************************************************
 * UNPACKER MODULE
 * Credit to GitHub user "mnsrulz" for Unpacker Node library
 * https://github.com/mnsrulz/unpacker
 ***********************************************************/
class Unbaser {
    constructor(base) {
        /* Functor for a given base. Will efficiently convert
          strings to natural numbers. */
        this.ALPHABET = {
            62: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
            95: "' !\"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'",
        };
        this.dictionary = {};
        this.base = base;
        // fill elements 37...61, if necessary
        if (36 < base && base < 62) {
            this.ALPHABET[base] = this.ALPHABET[base] ||
                this.ALPHABET[62].substr(0, base);
        }
        // If base can be handled by int() builtin, let it do it for us
        if (2 <= base && base <= 36) {
            this.unbase = (value) => parseInt(value, base);
        }
        else {
            // Build conversion dictionary cache
            try {
                [...this.ALPHABET[base]].forEach((cipher, index) => {
                    this.dictionary[cipher] = index;
                });
            }
            catch (er) {
                throw Error("Unsupported base encoding.");
            }
            this.unbase = this._dictunbaser;
        }
    }
    _dictunbaser(value) {
        /* Decodes a value to an integer. */
        let ret = 0;
        [...value].reverse().forEach((cipher, index) => {
            ret = ret + ((Math.pow(this.base, index)) * this.dictionary[cipher]);
        });
        return ret;
    }
}

function detect(source) {
    /* Detects whether `source` is P.A.C.K.E.R. coded. */
    return source.replace(" ", "").startsWith("eval(function(p,a,c,k,e,");
}

function unpack(source) {
    /* Unpacks P.A.C.K.E.R. packed js code. */
    let { payload, symtab, radix, count } = _filterargs(source);
    if (count != symtab.length) {
        throw Error("Malformed p.a.c.k.e.r. symtab.");
    }
    let unbase;
    try {
        unbase = new Unbaser(radix);
    }
    catch (e) {
        throw Error("Unknown p.a.c.k.e.r. encoding.");
    }
    function lookup(match) {
        /* Look up symbols in the synthetic symtab. */
        const word = match;
        let word2;
        if (radix == 1) {
            //throw Error("symtab unknown");
            word2 = symtab[parseInt(word)];
        }
        else {
            word2 = symtab[unbase.unbase(word)];
        }
        return word2 || word;
    }
    source = payload.replace(/\b\w+\b/g, lookup);
    return _replacestrings(source);
    function _filterargs(source) {
        /* Juice from a source file the four args needed by decoder. */
        const juicers = [
            /}\('(.*)', *(\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\), *(\d+), *(.*)\)\)/,
            /}\('(.*)', *(\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\)/,
        ];
        for (const juicer of juicers) {
            //const args = re.search(juicer, source, re.DOTALL);
            const args = juicer.exec(source);
            if (args) {
                let a = args;
                if (a[2] == "[]") {
                    //don't know what it is
                    // a = list(a);
                    // a[1] = 62;
                    // a = tuple(a);
                }
                try {
                    return {
                        payload: a[1],
                        symtab: a[4].split("|"),
                        radix: parseInt(a[2]),
                        count: parseInt(a[3]),
                    };
                }
                catch (ValueError) {
                    throw Error("Corrupted p.a.c.k.e.r. data.");
                }
            }
        }
        throw Error("Could not make sense of p.a.c.k.e.r data (unexpected code structure)");
    }
    function _replacestrings(source) {
        /* Strip string lookup table (list) and replace values in source. */
        /* Need to work on this. */
        return source;
    }
}

