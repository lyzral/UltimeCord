/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { settings } from "../settings";

function isTokiPona(text: string) {
    const dictionary = /\b(?:leko|weka|pan|lete|linja|lipu|suli|nimi|akesi|misikeke|selo|ike|sijelo|sona|lili|pimeja|ante|jo|loje|telo|walo|kijetesantakalu|kasi|waso|wile|utala|lukin|sina|lape|ma|pilin|jasima|la|olin|pipi|meso|lawa|pi|pakala|oko|tan|ken|jaki|unpa|esun|seme|sitelen|len|kule|soko|open|ala|tenpo|lon|sinpin|pini|kokosila|mama|musi|monsi|mewika|taso|ona|mun|kiwen|tomo|mute|mi|nena|palisa|meli|laso|wawa|ale|kipisi|kulupu|ilo|lupa|nanpa|en|mu|jelo|kili|tonsi|moku|ni|kama|pu|poki|monsuta|sin|lasina|poka|soweli|sewi|elena|epiku|moli|pona|lanpan|alasa|anu|kute|uta|luka|suno|sama|awen|namako|suwi|noka|seli|mije|sike|jan|pali|tawa|inli|nasa|mani|wan|insa|nijon|nasin|kalama|ijo|toki|anpa|kala|kepeken|ko|kon|pana|tu|supa|kin|usawi|yupekosi)\b/gm;

    return (text.match(dictionary) || []).length >= text.split(/\s+/).length * 0.5;
}

function isSitelen(text: string) {
    const dictionary = /(?:\u{F1900}|\u{F1901}|\u{F1902}|\u{F1903}|\u{F1904}|\u{F1905}|\u{F1906}|\u{F1907}|\u{F1908}|\u{F1909}|\u{F190A}|\u{F190B}|\u{F190C}|\u{F190D}|\u{F190E}|\u{F190F}|\u{F1910}|\u{F1911}|\u{F1912}|\u{F1913}|\u{F1914}|\u{F1915}|\u{F1916}|\u{F1917}|\u{F1918}|\u{F1919}|\u{F191A}|\u{F191B}|\u{F191C}|\u{F191D}|\u{F191E}|\u{F191F}|\u{F1920}|\u{F1921}|\u{F1922}|\u{F1923}|\u{F1924}|\u{F1925}|\u{F1926}|\u{F1927}|\u{F1928}|\u{F1929}|\u{F192A}|\u{F192B}|\u{F192C}|\u{F192D}|\u{F192E}|\u{F192F}|\u{F1930}|\u{F1931}|\u{F1932}|\u{F1933}|\u{F1934}|\u{F1935}|\u{F1936}|\u{F1937}|\u{F1938}|\u{F1939}|\u{F193A}|\u{F193B}|\u{F193C}|\u{F193D}|\u{F193E}|\u{F193F}|\u{F1940}|\u{F1941}|\u{F1942}|\u{F1943}|\u{F1944}|\u{F1945}|\u{F1946}|\u{F1947}|\u{F1948}|\u{F1949}|\u{F194A}|\u{F194B}|\u{F194C}|\u{F194D}|\u{F194E}|\u{F194F}|\u{F1950}|\u{F1951}|\u{F1952}|\u{F1953}|\u{F1954}|\u{F1955}|\u{F1956}|\u{F1957}|\u{F1958}|\u{F1959}|\u{F195A}|\u{F195B}|\u{F195C}|\u{F195D}|\u{F195E}|\u{F195F}|\u{F1960}|\u{F1961}|\u{F1962}|\u{F1963}|\u{F1964}|\u{F1965}|\u{F1966}|\u{F1967}|\u{F1968}|\u{F1969}|\u{F196A}|\u{F196B}|\u{F196C}|\u{F196D}|\u{F196E}|\u{F196F}|\u{F1970}|\u{F1971}|\u{F1972}|\u{F1973}|\u{F1974}|\u{F1975}|\u{F1976}|\u{F1977}|\u{F19A0}|\u{F19A1}|\u{F19A2}|\u{F19A3}|\u{F1978}|\u{F1979}|\u{F197A}|\u{F197B}|\u{F197C}|\u{F197D}|\u{F197E}|\u{F197F}|\u{F1980}|\u{F1981}|\u{F1982}|\u{F1983}|\u{F1984}|\u{F1985}|\u{F1986}|\u{F1987}|\u{F1988}|\u{F1990}|\u{F1991}|\u{F1992}|\u{F1993}|\u{F1994}|\u{F1995}|\u{F1996}|\u{F1997}|\u{F1998}|\u{F1999}|\u{F199A}|\u{F199B}|\u{F199C}|\u{F199D})/gmu;

    return dictionary.test(text);
}

function isShavian(text: string) {
    const shavianRegex = /[\u{10450}-\u{1047F}]+/u;

    return shavianRegex.test(text);
}

async function translateShavian(message: string) {
    const dictionary = await (await fetch("https://raw.githubusercontent.com/ForkPrince/TranslatePlus/322199d5fdb1a9506591c9f4a2826338b5d67e38/shavian.json")).json();

    const punctuationMap = {
        '"': "\"",
        "«": "\"",
        "»": "\"",
        ",": ",",
        "!": "!",
        "?": "?",
        ".": ".",
        "(": "(",
        ")": ")",
        "/": "/",
        ";": ";",
        ":": ":"
    };

    let translated = "";
    const words = message.split(/\s+/);

    for (let word of words) {
        let punctuationBefore = "", punctuationAfter = "";

        if (word[0] in punctuationMap) {
            punctuationBefore = punctuationMap[word[0]];
            word = word.slice(1);
        }

        if (word[word.length - 1] in punctuationMap) {
            punctuationAfter = punctuationMap[word[word.length - 1]];
            word = word.slice(0, -1);
        }

        translated += punctuationBefore;

        if (word in dictionary) translated += dictionary[word];
        else translated += word;

        translated += punctuationAfter + " ";
    }

    return translated.trim();
}

async function translateSitelen(message: string) {
    message = Array.from(message).join(" ");

    const dictionary = await (await fetch("https://raw.githubusercontent.com/ForkPrince/TranslatePlus/5ca152b134ea11433971f21b2ef8d556d4306717/sitelen-pona.json")).json();

    const sorted = Object.keys(dictionary).sort((a, b) => b.length - a.length);

    const pattern = new RegExp(`(${sorted.join("|")})`, "g");

    const translate = message.replace(pattern, match => dictionary[match]);

    return translate;
}

async function google(target: string, text: string) {
    if (!text) return { src: "", text: "" };
    try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?${new URLSearchParams({ client: "gtx", sl: "auto", tl: target, dt: "t", dj: "1", source: "input", q: text })}`);
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        const translate = await res.json();

        return {
            src: translate.src,
            text: translate.sentences?.map(s => s.trans).filter(Boolean).join("\n")
        };
    } catch (error) {
        console.error("[TranslatePlus] Google Translate request failed:", error);
        return { src: "en", text: "Translation failed due to an error." };
    }
}

export async function translate(text: string): Promise<any> {
    const { target, toki, sitelen, shavian } = settings.store;

    const output = { src: "", text: "" };

    if ((isTokiPona(text) || isSitelen(text)) && (toki || sitelen)) {
        if (isSitelen(text) && sitelen) text = await translateSitelen(text);

        console.log(text);

        const translate = await (await fetch("https://aiapi.serversmp.xyz/toki", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: text,
                src: "tl",
                target: "en"
            })
        })).json();

        console.log(translate);

        output.src = "tp";
        output.text = target === "en" ? translate.translation[0] : (await google(target, translate.translation[0])).text;
    } else if (isShavian(text) && shavian) {
        const translate = await translateShavian(text);

        output.src = "sh";
        output.text = target === "en" ? translate : (await google(target, translate)).text;
    } else {
        const translate = await google(target, text);

        output.src = translate.src;
        output.text = translate.text;
    }

    return output;
}
