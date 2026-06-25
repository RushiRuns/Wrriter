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

// Intercept click actions on wiki link spans
document.addEventListener("click", function(e) {
    if (e.target && e.target.classList.contains("wiki-link")) {
        const title = e.target.getAttribute("data-title");
        if (window.EditorBridge) {
            window.EditorBridge.onLinkClicked(title);
        }
    }
});

// --- Kotlin Exposed APIs ---

/**
 * Loads markdown body and configures editor styles.
 */
function loadNoteContent(markdownContent, optionsJson) {
    try {
        const options = JSON.parse(optionsJson);
        
        // Apply textures
        document.body.className = ""; // Reset
        if (options.texture && options.texture !== "none") {
            document.body.classList.add("texture-" + options.texture);
        }

        // Apply typography
        if (options.font && options.font !== "default") {
            document.body.style.fontFamily = options.font;
        }

        // Apply spellcheck toggle
        editor.setAttribute("spellcheck", options.spellcheck ? "true" : "false");

        // Parse and render content
        editor.innerHTML = markdownToHtml(markdownContent);
    } catch (e) {
        editor.innerHTML = "<p>Error loading content: " + e.message + "</p>";
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

// --- Markdown Parsers (Local logic) ---

function markdownToHtml(md) {
    if (!md) return "<p><br></p>";
    const lines = md.split("\n");
    let html = "";
    let inList = false;

    for (let line of lines) {
        const trimmed = line.trim();

        // Unordered lists converter
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

        // Headers converter
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
    
    if (inList) {
        html += "</ul>";
    }
    return html;
}

function parseInlineMarkdown(text) {
    // Escape HTML tags to prevent injections
    text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Wiki links: [[Note Title]] -> <span class="wiki-link" data-title="Title">Title</span>
    const wikiRegex = /\[\[([^\]]+)\]\]/g;
    text = text.replace(wikiRegex, (match, p1) => {
        const cleanTitle = p1.trim();
        return `<span class="wiki-link" data-title="${cleanTitle}">${cleanTitle}</span>`;
    });

    // Images: ![alt](src) -> <img src="src" alt="alt" />
    const imgRegex = /!\[([^\]]*)\]\(([^\)]+)\)/g;
    text = text.replace(imgRegex, (match, alt, src) => {
        return `<img src="${src}" alt="${alt}" style="max-width:100%; border-radius:8px;" />`;
    });

    return text;
}

function htmlToMarkdown() {
    const nodes = editor.childNodes;
    let markdown = "";
    let inList = false;

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
                    markdown += "* " + getCleanText(li) + "\n";
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

function getCleanText(element) {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = element.innerHTML;

    // Convert wiki link spans back to [[Title]]
    const wikiLinks = tempDiv.getElementsByClassName("wiki-link");
    while (wikiLinks.length > 0) {
        const link = wikiLinks[0];
        const title = link.getAttribute("data-title");
        const replacement = document.createTextNode(`[[${title}]]`);
        link.parentNode.replaceChild(replacement, link);
    }

    // Convert images back to markdown ![]()
    const imgs = tempDiv.getElementsByTagName("img");
    while (imgs.length > 0) {
        const img = imgs[0];
        const src = img.getAttribute("src");
        const alt = img.getAttribute("alt") || "";
        const replacement = document.createTextNode(`![${alt}](${src})`);
        img.parentNode.replaceChild(replacement, img);
    }

    return tempDiv.textContent || tempDiv.innerText || "";
}
