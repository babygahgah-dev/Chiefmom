# 病房普通話 Ward Putonghua

A web app for Cantonese-speaking nurses, doctors and other clinical staff in Hong Kong who need to talk with Putonghua-speaking patients.

It holds 1,028 items, each shown as the Cantonese you would say on the ward (with Jyutping) and the Putonghua equivalent (with tone-coloured Pinyin), and each recorded in both languages:

| Group | Items | Topics |
| --- | --- | --- |
| Medical terms | 577 | Body, symptoms, conditions, medication, equipment, people and places, admin and time |
| Procedures | 258 | Checks and tests, nursing procedures, treatment and surgery, daily care, positions and movements |
| Phrases | 193 | What you say to the patient, what the patient says to you |

## Two ways to practise

**Listen & pick.** Choose a group and a topic. A term is played in Putonghua and you pick its meaning from four choices. The wrong choices are the terms in that topic that sound most like it, so every question is a listening test. Tap an answer to select it, change your mind freely, then press Check. Afterwards you see both languages and can tap any choice to hear it. Items you miss come back first in the next round.

The **Sound-alikes** group goes further: it finds every pair of terms in the list that differ by a single sound (for example 抽血 and 出血) and asks which one you heard. It also tests tones, and it tracks which kinds of sound you confuse.

**Conversations.** Twenty short bedside exchanges (triage, chest pain, taking blood, discharge and so on). You hear the patient with the words hidden, then choose your reply.

## Run it

- **Online:** GitHub Pages serves this folder as it is.
- **Locally:** the app fetches each topic's audio when it is needed, which browsers block for files opened straight from disk. Either serve the folder (`python3 -m http.server`) or use the single-file build, which has everything inside one HTML file.

Progress is stored in the browser on that device only.

## Files

- `terms.js`: the list. `k` topic, `c` Cantonese, `j` Jyutping, `m` Putonghua (Traditional), `s` Simplified, `p` Pinyin, `e` English.
- `audio/p-<topic>.json`, `audio/y-<topic>.json`: recordings (MP3, base64) for Putonghua and Cantonese, in the same order as that topic's items in `terms.js`.
- `app.js`, `app.css`, `index.html`: the app. `sw.js`, `manifest.webmanifest`, `icon.svg`: install and offline support.

## About the recordings and the wording

The recordings are synthetic, made offline with open neural voices. Every Putonghua clip was read back by a speech recogniser and re-recorded with another voice if it was not understood. The Cantonese clips are generated directly from the Jyutping.

The romanisation was machine-generated and then corrected by hand. Please have a native Putonghua speaker review the list and listen through the audio before relying on it for teaching.

This is a language-learning aid. It does not replace a professional interpreter for consent or complex clinical conversations.
