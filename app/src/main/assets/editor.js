const editor = document.getElementById("editor");

// Keyboard listeners for shortcuts and typing indicators
editor.addEventListener("keyup", function(e) {
    if (window.EditorBridge) {
        window.EditorBridge.onKeyPress();
    }

    if (e.key === " ") {
        handleHeadingAndListShortcuts();
    } else if (e.key === "]") {
        handleWikiLinkShortcuts();
    }
});

// Intercept click actions on links
document.addEventListener("click", function(e) {
    const target = e.target;
    if (!target) return;

    if (target.classList.contains("wiki-link")) {
        const title = target.getAttribute("data-title");
        if (window.EditorBridge) {
            window.EditorBridge.onLinkClicked(title);
        }
    } else {
        const anchor = target.closest("a.external-link");
        if (anchor) {
            e.preventDefault();
            const href = anchor.getAttribute("href");
            if (href && window.EditorBridge && window.EditorBridge.onExternalLinkClicked) {
                window.EditorBridge.onExternalLinkClicked(href);
            }
        }
    }
});

// --- Kotlin Exposed APIs ---

/**
 * Loads markdown body and configures editor styles.
 */
/**
 * Injects texture styles directly into the document to bypass CSS caching.
 * Uses a dedicated <style id="texture-style"> element for easy replacement.
 */
function applyTexture(texture) {
    let styleEl = document.getElementById("texture-style");
    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "texture-style";
        document.head.appendChild(styleEl);
    }

    const textures = {
        paper: `body {
            background-color: #000000;
            background-image: radial-gradient(rgba(148,163,184,0.35) 1.5px, transparent 0);
            background-size: 20px 20px;
            background-attachment: local;
        }`,
        ruled: `body {
            background-color: #000000;
            background-image: linear-gradient(
                transparent calc(32px - 1px),
                rgba(94,116,138,0.6) calc(32px - 1px),
                rgba(94,116,138,0.6) 32px,
                transparent 32px
            );
            background-size: 100% 32px;
            background-attachment: local;
            line-height: 32px;
        }`,
        grid: `body {
            background-color: #000000;
            background-image:
                linear-gradient(rgba(94,116,138,0.35) 1px, transparent 1px),
                linear-gradient(90deg, rgba(94,116,138,0.35) 1px, transparent 1px);
            background-size: 32px 32px;
            background-attachment: local;
        }`
    };

    if (texture && texture !== "none" && textures[texture]) {
        styleEl.textContent = textures[texture];
    } else {
        styleEl.textContent = "body { background-color: #000000; background-image: none; }";
    }
}

function loadNoteContent(markdownContent, optionsJson) {
    try {
        const options = JSON.parse(optionsJson);
        
        // Apply textures via inline style injection (bypasses CSS cache)
        applyTexture(options.texture);

        // Apply typography
        if (options.font && options.font !== "default") {
            document.body.style.fontFamily = options.font;
        }

        // Apply spellcheck toggle
        editor.setAttribute("spellcheck", options.spellcheck ? "true" : "false");

        // Parse and render content
        editor.innerHTML = markdownToHtml(markdownContent);
        setupCheckboxListeners();
    } catch (e) {
        editor.innerHTML = "<p>Error loading content: " + e.message + "</p>";
    }
}

/**
 * Updates dynamic styling options (theme, texture, font, spellcheck) without reloading content.
 */
function updateEditorOptions(optionsJson) {
    try {
        const options = JSON.parse(optionsJson);
        
        // Apply textures via inline style injection (bypasses CSS cache)
        applyTexture(options.texture);

        // Apply typography
        if (options.font && options.font !== "default") {
            document.body.style.fontFamily = options.font;
        } else {
            document.body.style.fontFamily = "";
        }

        // Apply spellcheck toggle
        editor.setAttribute("spellcheck", options.spellcheck ? "true" : "false");
    } catch (e) {
        console.error("Error updating options: " + e.message);
    }
}

/**
 * Compiles content and posts it back to Kotlin.
 */
function requestSave() {
    const md = htmlToMarkdown();
    if (window.EditorBridge) {
        window.EditorBridge.onSaveContent(md);
    }
}

function insertAttachment(src, alt) {
    editor.focus();
    let selection = window.getSelection();
    
    let fullSrc = src;
    if (src.startsWith("Attachments/")) {
        const fileName = src.substring("Attachments/".length);
        fullSrc = "https://appassets.androidplatform.net/attachments/" + fileName;
    }

    let element;
    if (src.endsWith(".png") || src.endsWith(".jpg")) {
        element = document.createElement("img");
        element.src = fullSrc;
        element.alt = alt;
        element.style.maxWidth = "100%";
        element.style.borderRadius = "8px";
        element.style.display = "block";
        element.style.margin = "12px auto";
    } else if (src.endsWith(".m4a")) {
        element = document.createElement("audio");
        element.src = fullSrc;
        element.controls = true;
        element.style.display = "block";
        element.style.margin = "12px 0";
    }

    if (!element) return;

    if (selection.rangeCount > 0) {
        try {
            let range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(element);
            
            // Insert a newline after the element to make it easy to continue typing
            const br = document.createElement("br");
            range.insertNode(br);
            
            range.setStartAfter(br);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        } catch (e) {
            // Fallback to append if range insertion fails
            editor.appendChild(element);
            editor.appendChild(document.createElement("br"));
        }
    } else {
        editor.appendChild(element);
        editor.appendChild(document.createElement("br"));
    }
}

// --- Shortcuts Handlers ---

function handleHeadingAndListShortcuts() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    
    if (node.nodeType !== Node.TEXT_NODE) return;
    
    const text = node.nodeValue;
    const offset = range.startOffset;
    const textBeforeCursor = text.substring(0, offset);
    
    const block = getParentBlock(node);
    if (!block) return;
    
    if (textBeforeCursor === "# ") {
        changeBlockTag(block, "h1");
    } else if (textBeforeCursor === "## ") {
        changeBlockTag(block, "h2");
    } else if (textBeforeCursor === "### ") {
        changeBlockTag(block, "h3");
    } else if (textBeforeCursor === "* " || textBeforeCursor === "- ") {
        convertToListItem(block);
    } else if (textBeforeCursor === "[] " || textBeforeCursor === "- [ ] " || textBeforeCursor === "* [ ] ") {
        convertToChecklistItem(block);
    }
}

function handleWikiLinkShortcuts() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;

    const text = node.nodeValue;
    const offset = range.startOffset;
    const textBeforeCursor = text.substring(0, offset);

    if (textBeforeCursor.endsWith("]]")) {
        const openIdx = textBeforeCursor.lastIndexOf("[[");
        if (openIdx !== -1 && openIdx < offset - 2) {
            const title = textBeforeCursor.substring(openIdx + 2, offset - 2).trim();
            if (title.length > 0) {
                const span = document.createElement("span");
                span.className = "wiki-link";
                span.setAttribute("data-title", title);
                span.textContent = title;

                const parent = node.parentNode;
                const partBefore = text.substring(0, openIdx);
                const partAfter = text.substring(offset);

                const beforeNode = document.createTextNode(partBefore);
                const afterNode = document.createTextNode(partAfter);

                parent.insertBefore(beforeNode, node);
                parent.insertBefore(span, node);
                parent.insertBefore(afterNode, node);
                parent.removeChild(node);

                const newRange = document.createRange();
                newRange.setStart(afterNode, 0);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        }
    }
}

function getParentBlock(node) {
    let current = node;
    while (current && current.parentNode) {
        let parent = current.parentNode;
        if (parent.id === "editor") {
            return current;
        }
        current = parent;
    }
    return null;
}

// --- Rich Formatting Toolbar Exposed Functions ---

function formatText(command) {
    document.execCommand(command, false, null);
    editor.focus();
}

function insertChecklist() {
    editor.focus();
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    const block = getParentBlock(node);
    if (block) {
        convertToChecklistItem(block);
    }
}

function convertToChecklistItem(block) {
    const text = block.textContent || block.innerText;
    const cleanText = text.replace(/^([-*]\s+\[[ xX]\]|[-*]|#+)\s+/, "");

    const ul = document.createElement("ul");
    ul.className = "checklist";
    const li = document.createElement("li");
    li.className = "task-list-item";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.addEventListener("change", function() {
        if (window.EditorBridge) {
            window.EditorBridge.onKeyPress();
        }
    });

    li.appendChild(checkbox);
    const textNode = document.createTextNode(cleanText || " ");
    li.appendChild(textNode);
    ul.appendChild(li);

    block.parentNode.replaceChild(ul, block);

    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(textNode);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
}

function setupCheckboxListeners() {
    const checkboxes = editor.querySelectorAll('li.task-list-item input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.addEventListener("change", function() {
            if (window.EditorBridge) {
                window.EditorBridge.onKeyPress();
            }
        });
    });
}

function insertHeading() {
    editor.focus();
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    const block = getParentBlock(node);
    if (!block) return;
    
    const tag = block.tagName ? block.tagName.toLowerCase() : "";
    if (tag === "h1") {
        changeBlockTag(block, "h2");
    } else if (tag === "h2") {
        changeBlockTag(block, "h3");
    } else if (tag === "h3") {
        changeBlockTag(block, "p");
    } else {
        changeBlockTag(block, "h1");
    }
}

function insertWikiLink() {
    editor.focus();
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    
    const span = document.createElement("span");
    span.className = "wiki-link";
    span.setAttribute("data-title", "New Note");
    span.textContent = "New Note";
    
    range.deleteContents();
    range.insertNode(span);
    
    const space = document.createTextNode(" ");
    range.insertNode(space);
    
    range.setStartAfter(space);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
}

function insertTag() {
    editor.focus();
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const textNode = document.createTextNode("#");
    range.deleteContents();
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
}

// --- Markdown Parsers (Local logic) ---

function markdownToHtml(md) {
    if (!md) return "<p><br></p>";
    const lines = md.split("\n");
    let html = "";
    let inList = false;
    let inChecklist = false;

    for (let line of lines) {
        const trimmed = line.trim();

        // 1. Checklist items
        const checklistRegex = /^[-*]\s+\[([ xX])\]\s+(.+)$/;
        const checklistMatch = trimmed.match(checklistRegex);
        if (checklistMatch) {
            if (inList) {
                html += "</ul>";
                inList = false;
            }
            const isChecked = checklistMatch[1].toLowerCase() === "x";
            let itemText = checklistMatch[2];
            itemText = parseInlineMarkdown(itemText);
            if (!inChecklist) {
                html += '<ul class="checklist">';
                inChecklist = true;
            }
            const checkedAttr = isChecked ? "checked" : "";
            html += `<li class="task-list-item"><input type="checkbox" ${checkedAttr}> ${itemText}</li>`;
            continue;
        } else {
            if (inChecklist) {
                html += "</ul>";
                inChecklist = false;
            }
        }

        // 2. Unordered lists
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
            let itemText = trimmed.substring(2);
            itemText = parseInlineMarkdown(itemText);
            if (!inList) {
                html += "<ul>";
                inList = true;
            }
            html += "<li>" + itemText + "</li>";
            continue;
        } else {
            if (inList) {
                html += "</ul>";
                inList = false;
            }
        }

        // 3. Headers
        if (trimmed.startsWith("# ")) {
            html += "<h1>" + parseInlineMarkdown(trimmed.substring(2)) + "</h1>";
        } else if (trimmed.startsWith("## ")) {
            html += "<h2>" + parseInlineMarkdown(trimmed.substring(3)) + "</h2>";
        } else if (trimmed.startsWith("### ")) {
            html += "<h3>" + parseInlineMarkdown(trimmed.substring(4)) + "</h3>";
        } else if (trimmed.length > 0) {
            html += "<p>" + parseInlineMarkdown(trimmed) + "</p>";
        } else {
            html += "<p><br></p>";
        }
    }
    
    if (inList) html += "</ul>";
    if (inChecklist) html += "</ul>";
    return html;
}

function parseInlineMarkdown(text) {
    // Escape HTML tags to prevent injections
    text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Bold: **text** -> <strong>text</strong>
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    // Italic: *text* -> <em>text</em>
    text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");

    // Strikethrough: ~~text~~ -> <s>text</s>
    text = text.replace(/~~([^~]+)~~/g, "<s>$1</s>");

    // Wiki links: [[Note Title]] -> <span class="wiki-link" data-title="Title">Title</span>
    const wikiRegex = /\[\[([^\]]+)\]\]/g;
    text = text.replace(wikiRegex, (match, p1) => {
        const cleanTitle = p1.trim();
        return `<span class="wiki-link" data-title="${cleanTitle}">${cleanTitle}</span>`;
    });

    // Audio: ![Voice Note](src) or [Voice Note](src) -> <audio src="src" controls></audio>
    const audioRegex = /!?\[([^\]]*)\]\((.+?\.(?:m4a|mp3|wav|ogg))\)/gi;
    text = text.replace(audioRegex, (match, alt, src) => {
        let fullSrc = src;
        if (src.startsWith("Attachments/")) {
            const fileName = src.substring("Attachments/".length);
            fullSrc = "https://appassets.androidplatform.net/attachments/" + fileName;
        }
        return `<audio src="${fullSrc}" controls></audio>`;
    });

    // Images: ![alt](src) -> <img src="src" alt="alt" />
    const imgRegex = /!\[([^\]]*)\]\(([^\)]+)\)/g;
    text = text.replace(imgRegex, (match, alt, src) => {
        let fullSrc = src;
        if (src.startsWith("Attachments/")) {
            const fileName = src.substring("Attachments/".length);
            fullSrc = "https://appassets.androidplatform.net/attachments/" + fileName;
        }
        return `<img src="${fullSrc}" alt="${alt}" style="max-width:100%; border-radius:8px;" />`;
    });

    // Markdown links: [Google](https://google.com) -> <a href="url" class="external-link">Google</a>
    const mdLinkRegex = /\[([^\]]+)\]\(((?:https?:\/\/|www\.|mailto:|tel:)[^\s\)]+)\)/g;
    text = text.replace(mdLinkRegex, (match, linkText, url) => {
        let href = url.startsWith("www.") ? "https://" + url : url;
        return `<a href="${href}" class="external-link">${linkText}</a>`;
    });

    // Bare URLs (auto-linking): https://google.com -> <a href="url" class="external-link bare-url" target="_blank">url</a>
    const bareUrlRegex = /(<[^>]+>)|((?:https?:\/\/|www\.)[^\s<>\(\)]*[^.,?!;:\s<>\(\)])/g;
    text = text.replace(bareUrlRegex, (match, g1, g2) => {
        if (g1) return g1;
        let url = g2;
        let href = url.startsWith("www.") ? "https://" + url : url;
        return `<a href="${href}" class="external-link bare-url" target="_blank">${url}</a>`;
    });

    return text;
}

function htmlToMarkdown() {
    const nodes = editor.childNodes;
    let markdown = "";

    for (let node of nodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName.toLowerCase();
            
            if (tag === "h1") {
                markdown += "# " + getCleanText(node) + "\n";
            } else if (tag === "h2") {
                markdown += "## " + getCleanText(node) + "\n";
            } else if (tag === "h3") {
                markdown += "### " + getCleanText(node) + "\n";
            } else if (tag === "ul") {
                const lis = node.getElementsByTagName("li");
                for (let li of lis) {
                    if (li.classList.contains("task-list-item")) {
                        const checkbox = li.querySelector('input[type="checkbox"]');
                        const isChecked = checkbox && checkbox.checked;
                        markdown += (isChecked ? "- [x] " : "- [ ] ") + getCleanText(li) + "\n";
                    } else {
                        markdown += "* " + getCleanText(li) + "\n";
                    }
                }
            } else if (tag === "p") {
                const innerText = getCleanText(node);
                if (innerText.trim() === "") {
                    markdown += "\n";
                } else {
                    markdown += innerText + "\n";
                }
            } else {
                const text = getCleanText(node);
                if (text.trim() !== "") {
                    markdown += text + "\n";
                }
            }
        } else if (node.nodeType === Node.TEXT_NODE) {
            const text = node.nodeValue.trim();
            if (text !== "") {
                markdown += text + "\n";
            }
        }
    }
    return markdown.trim();
}

function parseHtmlToMarkdown(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        return node.nodeValue;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        let innerContent = "";
        for (let child of node.childNodes) {
            innerContent += parseHtmlToMarkdown(child);
        }
        
        if (tagName === "strong" || tagName === "b") {
            return `**${innerContent}**`;
        } else if (tagName === "em" || tagName === "i") {
            return `*${innerContent}*`;
        } else if (tagName === "s" || tagName === "strike" || tagName === "del") {
            return `~~${innerContent}~~`;
        } else if (tagName === "span" && node.classList.contains("wiki-link")) {
            const title = node.getAttribute("data-title");
            return `[[${title}]]`;
        } else if (tagName === "a") {
            const href = node.getAttribute("href") || "";
            if (node.classList.contains("bare-url")) {
                return innerContent;
            } else {
                return `[${innerContent}](${href})`;
            }
        } else if (tagName === "img") {
            const src = node.getAttribute("src");
            const relativeSrc = src.replace("https://appassets.androidplatform.net/attachments/", "Attachments/");
            const alt = node.getAttribute("alt") || "";
            return `![${alt}](${relativeSrc})`;
        } else if (tagName === "audio") {
            const src = node.getAttribute("src");
            const relativeSrc = src.replace("https://appassets.androidplatform.net/attachments/", "Attachments/");
            return `[Voice Note](${relativeSrc})`;
        } else if (tagName === "input" && node.getAttribute("type") === "checkbox") {
            return ""; // Checkbox status handled at block level
        } else if (tagName === "br") {
            return "";
        }
        return innerContent;
    }
    return "";
}

function getCleanText(element) {
    let md = "";
    for (let child of element.childNodes) {
        md += parseHtmlToMarkdown(child);
    }
    return md;
}

function changeBlockTag(block, newTag) {
    const text = block.textContent || block.innerText;
    const cleanText = text.replace(/^#+\s+/, "");
    
    const newElement = document.createElement(newTag);
    newElement.textContent = cleanText;
    
    block.parentNode.replaceChild(newElement, block);
    
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(newElement);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
}

function convertToListItem(block) {
    const text = block.textContent || block.innerText;
    const cleanText = text.replace(/^[*|-]\s+/, "");

    const ul = document.createElement("ul");
    const li = document.createElement("li");
    li.textContent = cleanText;
    ul.appendChild(li);

    block.parentNode.replaceChild(ul, block);

    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(li);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
}
