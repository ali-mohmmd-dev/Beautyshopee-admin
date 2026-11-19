"use client";
import { useState } from "react";
type Media = {
  id: string;
  url: string;
  filename: string;
  alt: string;
  caption: string;
  imageText: string;
  decorative: boolean;
};
export function MediaLibrary({ initialMedia }: { initialMedia: Media[] }) {
  const [media, setMedia] = useState(initialMedia),
    [selected, setSelected] = useState<Media | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage("Uploading…");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/media", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setMedia((current) => [result, ...current]);
      setSelected(result);
      setMessage("Image uploaded. Add its image text below.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }
  async function save() {
    if (!selected) return;
    setBusy(true);
    try {
      const response = await fetch("/api/media", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setMedia((current) =>
        current.map((item) => (item.id === selected.id ? result : item)),
      );
      setMessage(
        "Image details saved. New placements will use these defaults.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">YOUR VISUAL LIBRARY</p>
          <h1>Images that tell your story.</h1>
          <p className="muted">
            Upload to R2, then add descriptive text for each image.
          </p>
        </div>
        <label className="primary upload">
          {busy ? "Working…" : "+ Upload image"}
          <input
            disabled={busy}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={upload}
          />
        </label>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <div className="media-layout">
        <div className="media-grid">
          {media.map((item) => (
            <button
              className="media-tile"
              key={item.id}
              onClick={() => setSelected(item)}
            >
              <img src={item.url} alt={item.alt} />
              <strong>{item.filename}</strong>
              <small>{item.alt ? "Alt text added" : "Alt text needed"}</small>
            </button>
          ))}
          {!media.length && (
            <p className="empty">
              Your image library starts with the first upload.
            </p>
          )}
        </div>
        {selected && (
          <div className="panel media-details">
            <h2>Image details</h2>
            <label>
              Public image URL
              <input readOnly value={selected.url} />
            </label>
            {(["alt", "caption", "imageText"] as const).map((key) => (
              <label key={key}>
                {key === "alt"
                  ? "Alt text"
                  : key === "imageText"
                    ? "Full text printed on image"
                    : "Caption"}
                <textarea
                  rows={3}
                  value={selected[key]}
                  onChange={(event) =>
                    setSelected({ ...selected, [key]: event.target.value })
                  }
                />
              </label>
            ))}
            <label className="check">
              <input
                type="checkbox"
                checked={selected.decorative}
                onChange={(event) =>
                  setSelected({ ...selected, decorative: event.target.checked })
                }
              />
              Decorative image
            </label>
            <button disabled={busy} className="primary" onClick={save}>
              Save image details
            </button>
          </div>
        )}
      </div>
    </>
  );
}
