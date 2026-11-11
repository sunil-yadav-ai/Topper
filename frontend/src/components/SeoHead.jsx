import { useEffect } from "react";

function setMeta(attribute, key, content) {
  let element = [...document.head.querySelectorAll("meta")]
    .find((candidate) => candidate.getAttribute(attribute) === key);
  if (!content) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.setAttribute("content", content);
}

function normalizeCanonical(path, pathname) {
  if (path === false) return "";
  const target = path ?? pathname;
  const normalizedPath = target.length > 1 ? target.replace(/\/+$/, "") : target;
  return new URL(normalizedPath, window.location.origin).href;
}

export default function SeoHead({
  title,
  description,
  robots = "noindex,follow",
  canonicalPath,
  pathname = window.location.pathname,
  type = "website",
  keywords = [],
  structuredData,
}) {
  useEffect(() => {
    const canonical = normalizeCanonical(canonicalPath, pathname);
    document.title = title;
    setMeta("name", "description", description);
    setMeta("name", "robots", robots);
    setMeta("name", "keywords", keywords.length ? keywords.join(", ") : "");
    setMeta("property", "og:type", type);
    setMeta("property", "og:site_name", "Topper");
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", canonical);
    setMeta("name", "twitter:card", "summary");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);

    let canonicalElement = document.head.querySelector('link[rel="canonical"]');
    if (!canonicalElement) {
      canonicalElement = document.createElement("link");
      canonicalElement.rel = "canonical";
      document.head.append(canonicalElement);
    }
    canonicalElement.href = canonical;
    if (!canonical) canonicalElement.remove();

    let jsonLd = document.head.querySelector("#topper-seo-jsonld");
    if (structuredData) {
      if (!jsonLd) {
        jsonLd = document.createElement("script");
        jsonLd.id = "topper-seo-jsonld";
        jsonLd.type = "application/ld+json";
        document.head.append(jsonLd);
      }
      jsonLd.textContent = JSON.stringify(structuredData).replace(/</g, "\\u003c");
    } else {
      jsonLd?.remove();
    }
  }, [
    canonicalPath,
    description,
    keywords,
    pathname,
    robots,
    structuredData,
    title,
    type,
  ]);

  return null;
}

export function organizationSchema() {
  const url = `${window.location.origin}/`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${url}#organization`,
      name: "Topper",
      url,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${url}#website`,
      name: "Topper",
      url,
      publisher: { "@id": `${url}#organization` },
    },
  ];
}

export function breadcrumbSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.path ? { item: new URL(item.path, window.location.origin).href } : {}),
    })),
  };
}
