
/**
 * DOM Scanner to extract relevant page context for the AI.
 * Captures visible text, form fields, and metadata.
 */

export const getPageContext = () => {
    // 1. Basic Metadata
    const title = document.title;
    const url = window.location.href;

    // 2. Visible Text (Simplified)
    // Clone body to avoid modifying live page
    const clone = document.body.cloneNode(true) as HTMLElement;

    // Remove scripts and styles
    const scripts = clone.getElementsByTagName('script');
    while (scripts[0]) scripts[0].parentNode?.removeChild(scripts[0]);

    const styles = clone.getElementsByTagName('style');
    while (styles[0]) styles[0].parentNode?.removeChild(styles[0]);

    const content = clone.innerText || "";

    // 3. Form Fields (Critical for Co-Pilot filling)
    const inputs = Array.from(document.querySelectorAll('input, textarea, select')).map((el, index) => {
        const element = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        const rect = element.getBoundingClientRect();

        // Skip hidden fields
        if (rect.width === 0 || rect.height === 0 || element.type === 'hidden') return null;

        return {
            id: element.id || `input_${index}`,
            name: element.name,
            type: element.type,
            placeholder: 'placeholder' in element ? element.placeholder : '',
            label: getLabelForElement(element),
            value: element.value,
            selector: getCssSelector(element)
        };
    }).filter(Boolean);

    return {
        title,
        url,
        content: content.substring(0, 50000), // Cap at 50k chars for safety
        forms: inputs
    };
};

// Helper: Get Label text for an input
function getLabelForElement(element: HTMLElement): string {
    let label = '';

    // 1. Check for label tag with 'for' attribute
    if (element.id) {
        const labelEl = document.querySelector(`label[for="${element.id}"]`);
        if (labelEl) return (labelEl as HTMLElement).innerText;
    }

    // 2. Check for parent label
    let parent = element.parentElement;
    while (parent) {
        if (parent.tagName === 'LABEL') {
            return (parent as HTMLElement).innerText;
        }
        parent = parent.parentElement;
        if (!parent || parent === document.body) break;
    }

    // 3. Check for aria-label
    if (element.getAttribute('aria-label')) {
        return element.getAttribute('aria-label') || '';
    }

    return '';
}

// Helper: Generate unique CSS selector
function getCssSelector(el: HTMLElement): string {
    if (el.id) return `#${el.id}`;
    if (el.className && typeof el.className === 'string' && el.className.trim() !== '') {
        return '.' + el.className.trim().split(/\s+/).join('.');
    }
    // Fallback path
    let path = [];
    while (el.nodeType === Node.ELEMENT_NODE) {
        let selector = el.nodeName.toLowerCase();
        if (el.parentElement) {
            let siblings = el.parentElement.children;
            if (siblings.length > 1) {
                let index = Array.prototype.indexOf.call(siblings, el) + 1;
                selector += `:nth-child(${index})`;
            }
        }
        path.unshift(selector);
        el = el.parentElement as HTMLElement;
        if (!el || el.tagName === 'BODY') break;
    }
    return path.join(' > ');
}
