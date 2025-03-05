import { doi } from 'doi-utils';
import iziToast from "izitoast";

export default {
    onload: ({ extensionAPI }) => {
        const config = {
            tabTitle: "DOI Handling",
            settings: [
                {
                    id: "doi-format",
                    name: "Output format",
                    description: "Retrieve the item\'s name and use for the link",
                    action: {
                        type: "select",
                        items: ["Unaltered", "Normalised", "Item Name",]
                    }
                },
            ]
        };
        extensionAPI.settings.panel.create(config);

        extensionAPI.ui.commandPalette.addCommand({
            label: "Paste DOI from clipboard",
            callback: () => pasteDOI()
        });
        extensionAPI.ui.commandPalette.addCommand({
            label: "Check page for DOIs",
            callback: () => checkDOI()
        });

        async function pasteDOI() {
            const clipText = await navigator.clipboard.readText();
            var startBlock = await window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
            var string;

            if (!startBlock) {
                prompt("Please focus a block before pasting into your graph", 3000);
                return;
            } else {
                if (!doi.validate(clipText)) {
                    alert('Please make sure that the clipboard contains a DOI');
                    return '';
                } else {
                    let q = `[:find (pull ?page [:node/title :block/string :block/uid ]) :where [?page :block/uid "${startBlock}"]  ]`;
                    var info = await window.roamAlphaAPI.q(q);
                    if (extensionAPI.settings.get("doi-format") == "Item Name") { // retrieve name from crossref
                        await window.roamAlphaAPI.updateBlock(
                            { block: { uid: info[0][0].uid, string: "Retrieving item name...", open: true } });
                        let doiUrl = "https://api.crossref.org/works/" + doi.normalize(clipText);
                        await fetch(doiUrl)
                            .then(response => {
                                if (response.status === 404) {
                                    throw new Error("DOI not found (404)");
                                }
                                return response.json();
                            })
                            .then(data => {
                                if (data.status === "ok") {
                                    string = `[${data.message.title[0]}](${doi.buildUrl(clipText)})`;
                                } else {
                                    throw new Error("Invalid response from CrossRef");
                                }
                            })
                            .catch(err => {
                                console.error(err);
                                prompt("Failed to retrieve item name from CrossRef. Outputting normalized DOI instead.", 3000);
                                string = `[${doi.normalize(clipText)}](${doi.buildUrl(clipText)})`;
                            });
                    } else if (extensionAPI.settings.get("doi-format") == "Normalised") { // normalise to 10.x/whatever format
                        string = "[" + doi.normalize(clipText) + "](" + doi.buildUrl(clipText) + ")";
                    } else { // just paste in the clip
                        string = "[" + clipText + "](" + doi.buildUrl(clipText) + ")";
                    }

                    await window.roamAlphaAPI.updateBlock(
                        { block: { uid: info[0][0].uid, string: string, open: true } });
                    await sleep(50);
                    document.querySelector("body")?.click();
                }
            }
        }

        async function checkDOI() {
            var thisPage = await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
            if (thisPage == undefined || thisPage == null) {
                var uri = window.location.href;
                const regex = /^https:\/\/roamresearch\.com\/.+\/(app|offline)\/\w+$/; //today's DNP
                if (uri.match(regex)) { // this is Daily Notes for today
                    let date = new Date();
                    thisPage = await window.roamAlphaAPI.util.dateToPageUid(date);
                }
            }
            let tree = await window.roamAlphaAPI.pull(
                `[ :block/string :block/uid {:block/children ...} ]`, [`:block/uid`, thisPage]);

            await parseTree(tree);
            async function parseTree(blocks) {
                if (blocks.hasOwnProperty([":block/children"])) {
                    for (var i = 0; i < blocks[":block/children"].length; i++) {
                        let text = blocks[":block/children"][i][":block/string"];

                        async function formatDOIs(text) {
                            const doiRegex = /\b(https?:\/\/doi\.org\/|http:\/\/dx\.doi\.org\/|doi\.org\/)?(10\.[0-9]{4,9}\/[\-._;<>\/\w%]+(?:\([\w\s]+\))?)\b/g;
                            const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/doi\.org\/(10\.[0-9]{4,9}\/[\-._;()<>\w]+(?:\/[\S]*)?))\)/g;

                            let excludedDOIs = new Set();
                            text.replace(markdownLinkRegex, (match, alias, url, currentDoi) => {
                                excludedDOIs.add(url);
                                return match;
                            });

                            async function formatCurrentDoi(originalDoi) {
                                let cleanDoi = originalDoi.replace(/^https?:\/\/doi\.org\//, '').replace(/^doi\.org\//, '');

                                let formattedDoi;
                                if (extensionAPI.settings.get("doi-format") === "Item Name") {
                                    let doiUrl = "https://api.crossref.org/works/" + doi.normalize(cleanDoi);
                                    try {
                                        let response = await fetch(doiUrl);
                                        
                                        if (response.status === 404) {
                                            throw new Error("DOI not found (404)");
                                        }
                                    
                                        let data = await response.json();
                                    
                                        if (data.status === "ok") {
                                            formattedDoi = `[${data.message.title[0]}](${doi.buildUrl(originalDoi)})`;
                                        } else {
                                            throw new Error("Invalid response from CrossRef");
                                        }
                                    } catch (err) {
                                        console.error(err);
                                        formattedDoi = `[${doi.normalize(cleanDoi)}](${doi.buildUrl(originalDoi)})`;
                                    }                                    
                                } else if (extensionAPI.settings.get("doi-format") === "Normalised") {
                                    formattedDoi = `[${doi.normalize(cleanDoi)}](${doi.buildUrl(originalDoi)})`;
                                } else {
                                    formattedDoi = `[${originalDoi}](${doi.buildUrl(originalDoi)})`;
                                }

                                return formattedDoi;
                            }

                            async function processText(text) {
                                let matches = [...text.matchAll(doiRegex)];
                                let formattedDOIs = new Map();

                                for (let match of matches) {
                                    let fullDoi = match[0].trim();
                                    let cleanDoi = match[2];

                                    if (!excludedDOIs.has(fullDoi) && !formattedDOIs.has(fullDoi) && !text.includes(`[${fullDoi}](`)) {
                                        let formattedDoi = await formatCurrentDoi(fullDoi);
                                        formattedDOIs.set(fullDoi, formattedDoi);
                                    }
                                }

                                formattedDOIs.forEach((formattedDoi, fullDoi) => {
                                    let safeRegex = new RegExp(`\\b${fullDoi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "g");
                                    text = text.replace(safeRegex, formattedDoi);
                                });

                                return text;
                            }
                            return processText(text);
                        }

                        let newString = await formatDOIs(text);
                        await window.roamAlphaAPI.updateBlock({
                            block: { "uid": blocks[":block/children"][i][":block/uid"], "string": newString }
                        });

                        if (blocks[":block/children"][i].hasOwnProperty([":block/children"])) {
                            await parseTree(blocks[":block/children"][i])
                        }
                    }
                }
                prompt("All matching DOIs on page found and formatted as instructed", 3000);
            }
        }
    },
    onunload: () => {
        // nothing left here!
    }
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function prompt(string, duration) {
    iziToast.show({
        theme: 'dark',
        message: string,
        class: 'doi-info',
        position: 'center',
        close: false,
        timeout: duration,
        closeOnClick: true,
        closeOnEscape: true,
        displayMode: 2
    });
}