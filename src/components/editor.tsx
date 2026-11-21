"use client";
import { useState } from "react";
import { ImageSelector } from "./image-selector";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  emptyImage,
  emptyVariant,
  defaultConcernSection,
  type Kind,
} from "@/lib/model";
type Data = Record<string, any>;
type Reference = { id: string; title: string; kind: string; draft: Data };
type Media = {
  id: string;
  url: string;
  filename: string;
  alt: string;
  caption: string;
  imageText: string;
  decorative: boolean;
};
const labels: Record<string, string> = {
  name: "Name",
  heroBanner: "Homepage hero banners",
  desktopImage: "Desktop banner image",
  mobileImage: "Mobile banner image (1:1 square)",
  slug: "URL slug",
  seo: "Search & social",
  brandId: "Brand",
  companyId: "Company",
  categoryIds: "Categories",
  concernIds: "Concerns",
  concernSection: "Shop by concern — homepage",
  parentId: "Parent category",
  productId: "Product",
  shortDescription: "Short description",
  description: "Full description",
  qualityType: "Quality type",
  netQuantity: "Net quantity",
  compareAt: "Compare-at price (₹)",
  price: "Price (₹)",
  stock: "Stock quantity",
  noIndex: "Exclude from search engines",
  imageText: "Full text printed on image",
  socialImage: "Social sharing image URL",
  noIndexing: "No indexing",
  sku: "SKU",
  unit: "Net quantity unit",
  sample: "Sample content",
  path: "Storefront path",
  key: "Section key",
  enabled: "Visible on website",
};
function label(key: string) {
  return (
    labels[key] ??
    key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())
  );
}
const templates: Record<string, unknown> = {
  images: emptyImage,
  footerImages: emptyImage,
  variants: emptyVariant,
  options: { name: "", value: "" },
  specifications: { name: "", value: "" },
  blocks: {
    key: "",
    heading: "",
    text: "",
    image: emptyImage,
    link: { label: "", href: "" },
    enabled: true,
    items: [],
  },
  items: {
    title: "",
    text: "",
    image: emptyImage,
    link: { label: "", href: "" },
  },
  headerLinks: { label: "", href: "" },
  footerLinks: { label: "", href: "" },
  popularLinks: { label: "", href: "" },
  footerBlocks: { heading: "", text: "" },
  labels: { name: "", value: "" },
  bundleItems: { name: "", shade: "", price: 0, image: emptyImage },
  attributes: "",
};
const preferredKeys = [
  "name",
  "slug",
  "brandId",
  "categoryIds",
  "concernIds",
  "concernSection",
  "companyId",
  "parentId",
  "productId",
  "author",
  "rating",
  "date",
  "qualityType",
  "shortDescription",
  "description",
  "text",
  "path",
  "heroBanner",
  "blocks",
  "specifications",
  "bundleItems",
  "badge",
  "featured",
  "sample",
  "attributes",
  "sku",
  "options",
  "netQuantity",
  "unit",
  "price",
  "compareAt",
  "stock",
  "url",
  "alt",
  "decorative",
  "caption",
  "imageText",
  "image",
  "logo",
  "favicon",
  "title",
  "canonical",
  "socialTitle",
  "socialDescription",
  "socialImage",
  "noIndex",
];
function orderedKeys(value: Data) {
  return Object.keys(value).sort((a, b) => {
    const x = preferredKeys.indexOf(a),
      y = preferredKeys.indexOf(b);
    return (x === -1 ? 999 : x) - (y === -1 ? 999 : y);
  });
}
function editorDefaults(kind: Kind, value: Data): Data {
  if (kind === "pages" && value.path === "/")
    return {
      ...value,
      heroBanner: {
        desktopImage: { ...emptyImage, ...value.heroBanner?.desktopImage },
        mobileImage: { ...emptyImage, ...value.heroBanner?.mobileImage },
      },
    };
  if (kind === "products") return { concernIds: [], ...value };
  if (kind === "settings")
    return {
      ...value,
      concernSection: {
        ...structuredClone(defaultConcernSection),
        ...value.concernSection,
      },
    };
  return value;
}
export function Editor({
  kind,
  recordId,
  initialVersion,
  initialData,
  published,
  references,
  media,
  revisions,
}: {
  kind: Kind;
  recordId: string | null;
  initialVersion: number;
  initialData: Data;
  published: boolean;
  references: Reference[];
  media: Media[];
  revisions: {
    version: number;
    action: string;
    data: Data;
    createdAt: string;
  }[];
}) {
  const router = useRouter();
  const [data, setData] = useState<Data>(() =>
    editorDefaults(kind, initialData),
  );
  const [version, setVersion] = useState(initialVersion);
  const [id, setId] = useState(recordId);
  const [live, setLive] = useState(published);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("Content");
  const [dirty, setDirty] = useState(false);
  function update(key: string, value: unknown) {
    setData((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setMessage("");
  }
  async function save(action: "save" | "publish" | "unpublish") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, version, data, action }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setVersion(result.version);
      setId(result.id);
      setLive(Boolean(result.publishedAt));
      setDirty(false);
      setMessage(
        result.warning ||
          (action === "publish"
            ? "Published to the storefront."
            : action === "unpublish"
              ? "Removed from the published storefront."
              : "Draft saved."),
      );
      if (!id) router.replace("/content/" + kind + "/" + result.id);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  const groups = {
    Content: orderedKeys(data).filter(
      (key) => !["seo", "variants", "images"].includes(key),
    ),
    Variants: ["variants"],
    Images: ["images"],
    "Search & social": ["companies", "reviews", "settings"].includes(kind) ? [] : ["seo"],
    History: [],
  };
  return (
    <>
      <Link className="back" href={"/content/" + kind}>
        ← Back to {kind}
      </Link>
      <div className="page-head">
        <div>
          <p className="eyebrow">
            {id ? "EDIT" : "NEW"} · {kind.toUpperCase()}
          </p>
          <h1>{data.name || "Untitled " + kind.slice(0, -1)}</h1>
          <p className="muted">
            {dirty ? "Unsaved edits · " : ""}
            {live ? "Published" : "Draft"} · Revision {version}
          </p>
        </div>
        <div className="actions">
          {id && (
            <a
              className="preview-link"
              href={"/api/preview?id=" + id}
              target="_blank"
              rel="noreferrer"
            >
              Preview ↗
            </a>
          )}
          <button disabled={busy} onClick={() => save("save")}>
            Save draft
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => save("publish")}
          >
            {busy ? "Saving…" : "Publish"}
          </button>
        </div>
      </div>
      {message && (
        <div role="status" className="notice">
          {message}
        </div>
      )}
      <div className="tabs">
        {Object.entries(groups)
          .filter(
            ([name, keys]) =>
              name === "History" || keys.some((key) => key in data),
          )
          .map(([name]) => (
            <button
              className={tab === name ? "active" : ""}
              key={name}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
      </div>
      <div className="editor panel">
        {tab === "History" ? (
          <>
            <h2>Previous revisions</h2>
            <p className="muted">
              Restore a revision into the editor, then save or publish it.
            </p>
            {revisions.map((revision) => (
              <div className="record-row" key={revision.version}>
                <span>
                  Revision {revision.version} · {revision.action} ·{" "}
                  {new Date(revision.createdAt).toLocaleString()}
                </span>
                <button
                  onClick={() => {
                    setData(editorDefaults(kind, revision.data));
                    setDirty(true);
                    setTab("Content");
                  }}
                >
                  Restore to editor
                </button>
              </div>
            ))}
          </>
        ) : (
          groups[tab as keyof typeof groups]
            .filter(
              (key) =>
                key in data && (key !== "heroBanner" || data.path === "/"),
            )
            .map((key) => (
              <Field
                key={key}
                name={key}
                value={data[key]}
                onChange={(value) => update(key, value)}
                references={references.filter((record) => record.id !== id)}
                media={media}
              />
            ))
        )}
        {tab === "Content" && live && (
          <button
            className="danger"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm("Remove this record from the live storefront?")
              )
                save("unpublish");
            }}
          >
            Unpublish
          </button>
        )}
      </div>
    </>
  );
}
function Field({
  name,
  value,
  onChange,
  references,
  media,
}: {
  name: string;
  value: any;
  onChange: (v: any) => void;
  references: Reference[];
  media: Media[];
}) {
  const title = label(name);
  if (name === "concernIds") {
    const chosen: string[] = Array.isArray(value) ? value : [];
    const options = references.filter((record) => record.kind === "concerns");
    return (
      <fieldset>
        <legend>{title}</legend>
        <p className="muted">
          Choose all that apply. In homepage settings, selection order controls
          the slider; leave empty to show all eligible concerns. Empty or hidden
          concerns stay off the homepage.
        </p>
        <div className="checks">
          {options.map((record) => (
            <label key={record.id}>
              <input
                type="checkbox"
                checked={chosen.includes(record.id)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...chosen, record.id]
                      : chosen.filter((id) => id !== record.id),
                  )
                }
              />
              {record.title}
            </label>
          ))}
        </div>
        {!options.length && (
          <p className="muted">Create a concern under Shop by concern first.</p>
        )}
        {chosen.length > 0 && (
          <ol className="concern-order">
            {chosen.map((id, index) => (
              <li key={id}>
                <span>
                  {options.find((record) => record.id === id)?.title ??
                    "Unavailable concern"}
                </span>
                <div>
                  <button
                    type="button"
                    disabled={index === 0}
                    aria-label={"Move concern " + (index + 1) + " up"}
                    onClick={() => {
                      const next = [...chosen];
                      [next[index - 1], next[index]] = [
                        next[index]!,
                        next[index - 1]!,
                      ];
                      onChange(next);
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === chosen.length - 1}
                    aria-label={"Move concern " + (index + 1) + " down"}
                    onClick={() => {
                      const next = [...chosen];
                      [next[index + 1], next[index]] = [
                        next[index]!,
                        next[index + 1]!,
                      ];
                      onChange(next);
                    }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={"Remove concern " + (index + 1)}
                    onClick={() =>
                      onChange(chosen.filter((item) => item !== id))
                    }
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </fieldset>
    );
  }
  if (name === "categoryIds")
    return (
      <fieldset>
        <legend>{title}</legend>
        <div className="checks">
          {references
            .filter((record) => record.kind === "categories")
            .map((record) => (
              <label key={record.id}>
                <input
                  type="checkbox"
                  checked={value.includes(record.id)}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...value, record.id]
                        : value.filter((id: string) => id !== record.id),
                    )
                  }
                />
                {record.title}
              </label>
            ))}
        </div>
      </fieldset>
    );
  const referenceKind = (
    {
      brandId: "brands",
      companyId: "companies",
      parentId: "categories",
      productId: "products",
    } as Record<string, string>
  )[name];
  if (referenceKind)
    return (
      <label>
        {title}
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Choose {title.toLowerCase()}</option>
          {references
            .filter((record) => record.kind === referenceKind)
            .map((record) => (
              <option key={record.id} value={record.id}>
                {record.title}
              </option>
            ))}
        </select>
        {name === "companyId" && (
          <small>Optional. A product can use its brand’s company.</small>
        )}
      </label>
    );
  if (name === "unit")
    return (
      <label>
        {title}
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {["none", "g", "kg", "ml", "l", "pieces"].map((unit) => (
            <option value={unit} key={unit}>
              {unit === "none" ? "Not applicable" : unit}
            </option>
          ))}
        </select>
      </label>
    );
  if (typeof value === "boolean")
    return (
      <label className="check">
        <input
          type="checkbox"
          checked={value}
          onChange={(event) => onChange(event.target.checked)}
        />
        {title}
      </label>
    );
  if (typeof value === "number" || value === null)
    return (
      <label>
        {title}
        <input
          type="number"
          min="0"
          step={["stock", "rating"].includes(name) ? "1" : "0.01"}
          value={value ?? ""}
          onChange={(event) =>
            onChange(
              event.target.value === "" ? null : Number(event.target.value),
            )
          }
        />
      </label>
    );
  if (Array.isArray(value)) {
    return (
      <fieldset>
        <legend>{title}</legend>
        {name === "variants" && (
          <p className="muted">
            Use one variant for a single product. Add options such as shade,
            color, size, or power for each sellable combination. Leave net
            quantity empty for appliances.
          </p>
        )}
        {name === "attributes" && (
          <p className="muted">
            Suggested product options, such as Shade, Color, Size, or Wattage.
          </p>
        )}
        {value.map((item, index) => (
          <details
            className="array-item"
            key={index}
            open={name === "variants"}
          >
            <summary>
              {typeof item === "object"
                ? item.heading ||
                  item.title ||
                  item.sku ||
                  title + " " + (index + 1)
                : String(item || title + " " + (index + 1))}
            </summary>
            <div className="array-head">
              <strong>
                {title} · {index + 1}
              </strong>
              <div>
                <button
                  type="button"
                  disabled={index === 0}
                  aria-label={"Move " + title + " up"}
                  onClick={() => {
                    const next = [...value];
                    [next[index - 1], next[index]] = [
                      next[index],
                      next[index - 1],
                    ];
                    onChange(next);
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === value.length - 1}
                  aria-label={"Move " + title + " down"}
                  onClick={() => {
                    const next = [...value];
                    [next[index + 1], next[index]] = [
                      next[index],
                      next[index + 1],
                    ];
                    onChange(next);
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>
            </div>
            <Field
              name={
                name === "variants"
                  ? "Variant"
                  : name === "images" || name === "footerImages"
                    ? "Image"
                    : name === "attributes"
                      ? "Attribute"
                      : "Item"
              }
              value={item}
              onChange={(newItem) =>
                onChange(value.map((old, i) => (i === index ? newItem : old)))
              }
              references={references}
              media={media}
            />
          </details>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange([...value, structuredClone(templates[name] ?? "")])
          }
        >
          + Add {title.toLowerCase()}
        </button>
      </fieldset>
    );
  }
  if (value && typeof value === "object") {
    const image = "url" in value && "alt" in value;
    return (
      <fieldset className={image ? "wide" : undefined}>
        <legend>{title}</legend>
        {name === "heroBanner" && (
          <p className="muted">
            Choose the wide desktop artwork and a separate square (1:1) mobile
            image. Both use the image library below. Save draft to preview;
            publish to update the website.
          </p>
        )}
        {image && (
          <ImageSelector value={value} media={media} onChange={onChange} />
        )}
        <div className="fields">
          {orderedKeys(value).map((key) => (
            <Field
              key={key}
              name={key}
              value={value[key]}
              onChange={(next) => onChange({ ...value, [key]: next })}
              references={references}
              media={media}
            />
          ))}
        </div>
      </fieldset>
    );
  }
  if (
    [
      "description",
      "shortDescription",
      "text",
      "imageText",
      "caption",
      "address",
      "announcement",
      "newsletterText",
      "value",
    ].includes(name)
  )
    return (
      <label className="wide">
        {title}
        <textarea
          rows={name === "description" ? 8 : 4}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
        />
        {name === "description" && (
          <small>
            Use paragraphs separated by blank lines. Prefix lines with “- ” for
            a list or “## ” for a subheading.
          </small>
        )}
      </label>
    );
  return (
    <label>
      {title}
      <input
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={!["slug", "sku", "url", "href"].includes(name)}
      />
    </label>
  );
}
