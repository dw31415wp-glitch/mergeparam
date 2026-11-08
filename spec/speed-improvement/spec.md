# Review workflow speed improvements

## Purpose

Make it quicker to review a known set of English Wikipedia articles with mergeparam while retaining the editor's review and publication on Wikipedia.

## Improvements

- Run mergeparam locally and open a named article from the start page or with `/fix?title=...`.
- Upload a `simple-cases.json` file containing a `pages` array with `page_name` values. Articles are visited in file order using Next article or Skip; the list remains in the current browser tab. Each article is fetched at its current revision.
- Open Wikipedia's Show changes screen directly from the merge review page, using the editor's proposed value and the reviewed base revision. Wikipedia remains responsible for conflict handling and final publication.
- Leave the watchlist checkbox unchecked by default; editors can opt in for an individual edit or change the default in settings.
- Provide a shortcut for Next article, including navigation through an uploaded list.
- Offer a Mac/Windows hotkey toggle and a `hotkeys=mac` or `hotkeys=windows` URL parameter. The selection persists in the current browser tab. Mac shortcuts use Ctrl+Option and Windows shortcuts use Alt. R opens the Wikipedia diff and N moves to the next article.

## Autoload next article

- The On/Off button is in **Keyboard workflow**. Autoload is off by default. Only `autoload=1` enables it. Turning it off sets `autoload=0`. The button updates the URL without reloading the page, and Next article and Skip carry the setting forward, including in uploaded lists.
- When Autoload is on, Mergeparam opens the Wikipedia diff immediately once the review tab is visible. After handing off the diff, switching away loads the next article in the background. Its diff waits until you return to the Mergeparam tab. If the browser blocks the automatic opening, use **Review & publish on Wikipedia** to open the diff manually.
- If **Move on to the next article automatically after I publish** is also enabled in Settings, Mergeparam waits until it detects a published revision that fixes the infobox before advancing.
- Turn Autoload off before switching tabs if you want more time to investigate the proposal or edit it on Wikipedia.

## Use institution (degree)

- The default merge keeps the institution and education as separate list entries. When both parameters contain a single entry and neither looks like a comma-separated list, **Use institution (degree)** offers another format. The button appears for merges that add an institution, after the duplicate check.
- Select the button to replace the proposed `|education=` value with the original `|alma_mater=` value followed by the original `|education=` value in parentheses. For example, `Indian Institute of Hardware Technology, Guwahati` and `Political Science` become `Indian Institute of Hardware Technology, Guwahati (Political Science)`. The button preserves the source wikitext, including links.
- Use this format when the education describes a degree or field of study at that institution. Check the pairing against the article context. The value stays editable, and **Reset to suggestion** restores the original proposal. The final diff removes `|alma_mater=` and uses the reviewed value for `|education=`.

## Review boundary

The tool prepares changes and opens Wikipedia's diff. It does not publish edits; the editor reviews and publishes each change on Wikipedia.
