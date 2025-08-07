import React, { useState, useRef, useEffect } from "react";
import { TextInput, ActionIcon, Title } from "@mantine/core";
import { IconPencil } from "@tabler/icons-react";

interface EditableTitleProps {
  value: string;
  onSave: (newValue: string) => void;
  placeholder?: string;
  order?: 1 | 2 | 3 | 4 | 5 | 6;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

export function EditableTitle({
  value,
  onSave,
  placeholder = "Enter name...",
  order = 3,
  size = "md",
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update edit value when prop value changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  // Focus the input when editing starts
  useEffect(() => {
    if (isEditing) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 10);
    }
  }, [isEditing]);

  // Handle key presses in the input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    }
    if (e.key === "Escape") {
      handleCancel();
    }
  };

  // Handle save operation
  const handleSave = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue !== value) {
      onSave(trimmedValue);
    }
    setIsEditing(false);
  };

  // Handle cancel operation
  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  // Handle edit start
  const handleEditStart = () => {
    setIsEditing(true);
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ position: "relative", display: "inline-block" }}
    >
      {isEditing ? (
        <TextInput
          ref={inputRef}
          value={editValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder={placeholder}
          size={size}
          style={{ minWidth: "200px" }}
        />
      ) : (
        <>
          <Title
            order={order}
            style={{ cursor: "pointer", display: "inline" }}
            onClick={handleEditStart}
          >
            {value || placeholder}
          </Title>
          {isHovered && (
            <ActionIcon
              size="sm"
              variant="subtle"
              color="blue"
              style={{
                position: "absolute",
                right: "-30px",
                top: "50%",
                transform: "translateY(-50%)",
              }}
              onClick={handleEditStart}
            >
              <IconPencil size={16} />
            </ActionIcon>
          )}
        </>
      )}
    </div>
  );
}
