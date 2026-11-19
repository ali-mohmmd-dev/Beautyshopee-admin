"use client";
import { useId, useRef, useState } from "react";

type ImagePlacement = {
  url: string;
  alt: string;
  caption: string;
  imageText: string;
  decorative: boolean;
};
type Media = ImagePlacement & { id: string; filename: string };

function filename(url: string) {
  try {
    return decodeURIComponent(
      new URL(url).pathname.split("/").pop() || "Selected image",
    );
  } catch {
    return "Selected image";
  }
}

export function ImageSelector({
  value,
  media,
  onChange,
}: {
  value: ImagePlacement;
  media: Media[];
  onChange: (image: ImagePlacement) => void;
}) {
  const [query, setQuery] = useState("");
  const disclosure = useRef<HTMLDetailsElement>(null);
  const searchId = useId();
  const selected = media.find((item) => item.url === value.url);
  const selectedName = selected?.filename || filename(value.url);
  const matches = media.filter((item) =>
    item.filename.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div className="image-selector">
      <span>Choose from media library</span>
      <details ref={disclosure} className="image-picker">
        <summary>
          {value.url && (
            <img src={value.url} alt="" className="image-picker-thumb" />
          )}
          <span className="image-picker-name">
            {value.url ? selectedName : "Select uploaded image"}
          </span>
          <span aria-hidden="true" className="image-picker-chevron">
            ⌄
          </span>
        </summary>
        <div className="image-picker-panel">
          <label htmlFor={searchId}>Search images by filename</label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search filenames…"
          />
          <div className="image-picker-list" aria-label="Uploaded images">
            {matches.map((item) => (
              <button
                type="button"
                className="image-picker-option"
                key={item.id}
                aria-pressed={value.url === item.url}
                onClick={() => {
                  onChange({
                    url: item.url,
                    alt: item.alt,
                    caption: item.caption,
                    imageText: item.imageText,
                    decorative: item.decorative,
                  });
                  setQuery("");
                  if (disclosure.current) {
                    disclosure.current.open = false;
                    disclosure.current.querySelector("summary")?.focus();
                  }
                }}
              >
                <img
                  src={item.url}
                  alt=""
                  loading="lazy"
                  className="image-picker-thumb"
                />
                <span className="image-picker-name">{item.filename}</span>
                {value.url === item.url && (
                  <span className="image-picker-selected">Selected</span>
                )}
              </button>
            ))}
            {!matches.length && (
              <p className="muted" role="status">
                {media.length
                  ? "No images match this filename."
                  : "No uploaded images yet. Upload an image in Media library first."}
              </p>
            )}
          </div>
        </div>
      </details>
      {value.url && (
        <figure className="selected-image">
          <img
            className="image-preview"
            src={value.url}
            alt={value.decorative ? "" : value.alt}
          />
          <figcaption>{selectedName}</figcaption>
        </figure>
      )}
    </div>
  );
}
