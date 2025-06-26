import React, { useState, useCallback } from "react";
import { Table, Checkbox } from "@mantine/core";
import { EditableCell } from "./EditableCell";
import type { FrameSnapshotRowProps, EditState } from "./types";

export function FrameSnapshotRow({
  snapshot,
  layoutId,
  onEditCell,
  onCheckChange,
  isChecked,
}: FrameSnapshotRowProps) {
  const [editState, setEditState] = useState<EditState>({
    key: null,
    value: "",
  });

  // Handlers for editing
  const handleEditStart = useCallback((key: string, value: string | number) => {
    setEditState({ key, value });
  }, []);

  const handleEditChange = useCallback((value: string | number) => {
    setEditState((prev) => ({ ...prev, value }));
  }, []);

  const handleEditSave = useCallback(() => {
    if (editState.key && onEditCell) {
      // Pass the edit to the parent component
      onEditCell(layoutId, editState.key, editState.value);
    }
    setEditState({ key: null, value: "" });
  }, [editState, onEditCell]);

  const handleEditCancel = useCallback(() => {
    setEditState({ key: null, value: "" });
  }, []);

  // Define the style for checked rows
  const rowStyle = isChecked ? { backgroundColor: "#e6f7ff" } : {};

  return (
    <Table.Tr style={rowStyle}>
      {["imageName", "x", "y", "width", "height"].map((field) => (
        <Table.Td key={field}>
          <EditableCell
            rowKey={snapshot.uniqueId}
            field={field}
            value={snapshot[field as keyof typeof snapshot] as string | number}
            onEditStart={handleEditStart}
            isEditing={editState.key === `${snapshot.uniqueId}:${field}`}
            editValue={editState.value}
            onEditChange={handleEditChange}
            onEditSave={handleEditSave}
            onEditCancel={handleEditCancel}
          />
        </Table.Td>
      ))}
      <Table.Td>
        <Checkbox
          checked={isChecked}
          onChange={(event) =>
            onCheckChange(snapshot.uniqueId, event.currentTarget.checked)
          }
        />
      </Table.Td>
    </Table.Tr>
  );
}
