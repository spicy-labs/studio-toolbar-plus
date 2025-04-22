import React, { useState, useRef, useEffect } from "react";
import { TextInput, NumberInput, ActionIcon } from "@mantine/core";
import { IconPencil } from "@tabler/icons-react";
import type { EditableCellProps } from "./types";

export function EditableCell({
  rowKey,
  field,
  value,
  onEditStart,
  isEditing,
  editValue,
  onEditChange,
  onEditSave,
  onEditCancel
}: EditableCellProps) {
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cellKey = `${rowKey}:${field}`;

  // Focus the input when editing starts
  useEffect(() => {
    if (isEditing) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isEditing]);

  useEffect(() => {
    console.log(rowKey);
  }, []);

  // Handle key presses in the input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onEditSave();
    if (e.key === 'Escape') onEditCancel();
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ position: 'relative' }}
    >
      {isEditing ? (
        field === 'imageName' ? (
          <TextInput
            ref={inputRef}
            value={editValue as string}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={onEditSave}
            size="xs"
            style={{ width: '100%' }}
          />
        ) : (
          <NumberInput
            ref={inputRef}
            value={Number(editValue)}
            onChange={(val) => onEditChange(val || 0)}
            onKeyDown={handleKeyDown}
            onBlur={onEditSave}
            size="xs"
            style={{ width: '100%' }}
          />
        )
      ) : (
        <>
          {value}
          {isHovered && (
            <ActionIcon
              size="xs"
              variant="subtle"
              color="blue"
              style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)' }}
              onClick={() => onEditStart(cellKey, value)}
            >
              <IconPencil size={14} />
            </ActionIcon>
          )}
        </>
      )}
    </div>
  );
}
