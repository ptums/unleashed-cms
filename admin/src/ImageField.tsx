// The image picker. It replaces the default object form for any field with x-ui.widget "image".
// The editor picks a file. The widget uploads it to S3 and saves the key in assetId.
// alt and focalPoint are not shown: the AI service writes alt on publish.

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { FieldProps } from "@rjsf/utils";
import { IMAGE_TYPES, requestUpload, uploadFile, viewUrl } from "./api";

const MAX_BYTES = 10 * 1024 * 1024;

type ImageValue = { assetId?: string; alt?: string; focalPoint?: unknown };

export function ImageField(props: FieldProps<ImageValue>) {
  const { formData, onChange, fieldPathId, schema, errorSchema, disabled, readonly, required } = props;
  const assetId = formData?.assetId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>();
  const [previewFailed, setPreviewFailed] = useState(false);
  const [progress, setProgress] = useState<number>();
  const [error, setError] = useState<string>();

  // A saved image: ask the API for a view link. A new upload already has a local preview.
  useEffect(() => {
    let cancelled = false;
    setPreviewFailed(false);
    if (!assetId) {
      setPreview(undefined);
      return;
    }
    if (preview?.startsWith("blob:")) {
      return;
    }
    viewUrl(assetId)
      .then((url) => {
        if (!cancelled) {
          setPreview(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
    // Only a new assetId needs a new link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

  // Free the local preview when it is replaced or the widget goes away.
  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setError(undefined);
    if (!IMAGE_TYPES.includes(file.type)) {
      setError("Use a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("This image is too large. Use an image of 10 MB or less.");
      return;
    }

    try {
      setProgress(0);
      const { uploadUrl, key } = await requestUpload(file.type);
      await uploadFile(uploadUrl, file, setProgress);
      setPreview(URL.createObjectURL(file));
      setPreviewFailed(false);
      // A new picture gets a new description, so alt and focalPoint are dropped.
      // The AI service writes alt again on the next publish.
      onChange({ assetId: key }, fieldPathId.path);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setProgress(undefined);
    }
  }

  const fieldErrors = [
    ...((errorSchema?.__errors as string[] | undefined) ?? []),
    ...((errorSchema?.assetId?.__errors as string[] | undefined) ?? []),
  ];
  const uploading = progress !== undefined;
  const locked = disabled || readonly || uploading;

  return (
    <div className="mb-4 space-y-2">
      <div className="text-sm font-medium">
        {schema.title ?? "Image"}
        {required ? <span className="text-red-600"> *</span> : null}
      </div>
      {typeof schema.description === "string" ? (
        <p className="text-sm text-neutral-500">{schema.description}</p>
      ) : null}

      <div className="flex items-start gap-4">
        <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
          {assetId && preview && !previewFailed ? (
            <img
              src={preview}
              alt=""
              className="h-full w-full object-cover"
              onError={() => {
                setPreviewFailed(true);
              }}
            />
          ) : (
            <span className="px-2 text-center text-xs text-neutral-400">
              {assetId ? "No preview" : "No image yet"}
            </span>
          )}
        </div>

        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            className="hidden"
            onChange={onPick}
          />
          <button
            type="button"
            disabled={locked}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50"
            onClick={() => {
              inputRef.current?.click();
            }}
          >
            {assetId ? "Replace image" : "Choose image"}
          </button>
          <p className="text-xs text-neutral-500">JPG, PNG or WebP, up to 10 MB.</p>
          {uploading ? (
            <div className="w-48">
              <div className="h-2 overflow-hidden rounded bg-neutral-200">
                <div className="h-full bg-neutral-800 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-neutral-500">Uploading… {progress}%</p>
            </div>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {fieldErrors.map((message) => (
        <p key={message} className="text-sm text-red-600">
          {message}
        </p>
      ))}
    </div>
  );
}
