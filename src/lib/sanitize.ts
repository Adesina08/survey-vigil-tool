const disallowedTags = new Set(["script", "iframe", "object", "embed", "style", "link"]);

const sanitizeNodeAttributes = (element: Element) => {
  const attributes = Array.from(element.attributes);
  attributes.forEach((attribute) => {
    const name = attribute.name.toLowerCase();
    const value = attribute.value;

    if (name.startsWith("on")) {
      element.removeAttribute(attribute.name);
      return;
    }

    if ((name === "href" || name === "src" || name === "srcdoc") && /^javascript:/i.test(value)) {
      element.removeAttribute(attribute.name);
    }
  });
};

export const sanitizeHtml = (html: string) => {
  if (typeof window === "undefined") {
    return html;
  }

  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, "text/html");

  parsed.querySelectorAll("*").forEach((element) => {
    if (disallowedTags.has(element.tagName.toLowerCase())) {
      element.remove();
      return;
    }
    sanitizeNodeAttributes(element);
  });

  return parsed.body.innerHTML;
};
