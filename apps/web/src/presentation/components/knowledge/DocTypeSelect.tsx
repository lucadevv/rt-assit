"use client";

/**
 * DocTypeSelect — labelled select used inside each upload tab.
 *
 * Lives next to the uploader because the available doc types are part
 * of the F3 KB UX contract; reusing this control elsewhere is fine.
 */

import type { JSX } from "react";
import { Select } from "@/design-system/primitives";
import {
  ALL_DOC_TYPES,
  DOC_TYPE_LABELS,
  type DocType,
} from "@/domain/entities/document";

interface DocTypeSelectProps {
  value: DocType;
  onChange: (next: DocType) => void;
  id?: string;
  disabled?: boolean;
}

export function DocTypeSelect({
  value,
  onChange,
  id,
  disabled,
}: DocTypeSelectProps): JSX.Element {
  return (
    <Select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as DocType)}
      aria-label="Tipo de documento"
      style={{ padding: "10px 14px", fontSize: 14 }}
    >
      {ALL_DOC_TYPES.map((t) => (
        <option key={t} value={t}>
          {DOC_TYPE_LABELS[t]}
        </option>
      ))}
    </Select>
  );
}
