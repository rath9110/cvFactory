"use client";

import { useState } from "react";

/**
 * A note the user attaches to one piece of generated output.
 *
 * Collapsed to a single link until it is needed, so the editing surface stays
 * quiet, and expanded automatically when a note already exists. The text is
 * feedback about the generation, not part of the document.
 */
export default function NoteField({
  value,
  onChange,
  placeholder = "What's off about this? e.g. \"too formal\", \"drop the second sentence\"",
  label = "Add a note",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(value.trim().length > 0);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-stone-500 underline-offset-4 hover:text-stone-800 hover:underline"
      >
        + {label}
      </button>
    );
  }

  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
          Your note
        </span>
        <button
          type="button"
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
          className="text-xs text-stone-500 underline-offset-2 hover:underline"
        >
          Remove
        </button>
      </div>
      <textarea
        // eslint-disable-next-line jsx-a11y/no-autofocus -- opened by an explicit click
        autoFocus={value.length === 0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full resize-y rounded border border-stone-300 bg-white p-2 text-xs focus:border-stone-500 focus:outline-none"
      />
      <p className="mt-1 text-[11px] leading-snug text-stone-500">
        Saved with the application and read back by the learning page.
      </p>
    </div>
  );
}
