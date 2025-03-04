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
                            .then(response => response.json())
                            .then(response => {
                                if (response.status == "ok") {
                                    string = "[" + response.message.title[0] + "](" + doi.buildUrl(clipText) + ")";
                                }
                            })
                            .catch(err => {
                                console.error(err);
                                prompt("Failed to retrieve item name from crossref. Output normalised item instead", 3000);
                                string = "[" + doi.normalize(clipText) + "](" + doi.buildUrl(clipText) + ")";
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