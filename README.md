Paste DOIs into Roam Research and receive a nicely formatted link instead of Roam's default simple text output. OR, check a page for all DOIs not already formatted as markdown and replace them with formatted links.

Currently, Roam Research pastes DOIs as simple text:

`10.1088/1741-4326/ab8e8b`
or `doi.org/10.1016/j.neuron.2021.09.035`
unless they are already preceded by `https://`

With this extension, you can copy a DOI into your clipboard, focus a block in your graph and then trigger the Command Palette option 'Paste DOI from clipboard'.
There are three options for how you can format the output, configurable in Roam Depot settings for this extension.
1. Unaltered - what you have in your clipboard is shown as the alias for the link `[clipboard text](link)`
2. Normalised - the alias will be formatted in the format `[10.1088/1741-4326/ab8e8b](https://doi.org/10.1088/1741-4326/ab8e8b)`
3. Item Name - the extension will contact CrossRef and try to resolve a name for the item the DOI points to. The alias will then be the name `[Testing a global standard for quantifying species recovery and assessing conservation impact](https://doi.org/10.1111/cobi.13756)`

The other Command Palette command is to 'Check page for DOIs'.
This will parse the entire page of text, or that date's page if you're on the daily note page. Where it finds DOIs that aren't already in markdown alias format `[]()` the extension will convert that string to a markdown link using your preferred display format from the settings.
