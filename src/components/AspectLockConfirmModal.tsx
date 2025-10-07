import { useState } from "react";
import { Modal, Text, Group, Button } from "@mantine/core";
import { saveLayoutSizingToAction } from "../studio/studioAdapter";
import { appStore } from "../modalStore";

interface AspectLockConfirmModalProps {
  opened: boolean;
  onClose: () => void;
}

export function AspectLockConfirmModal({
  opened,
  onClose,
}: AspectLockConfirmModalProps) {
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const raiseError = appStore((store) => store.raiseError);

  const handleConfirm = async (value: boolean) => {
    onClose(); // Close confirmation modal
    (await saveLayoutSizingToAction(value)).fold(
      (_) => {
        setSuccessMessage(
          value
            ? "Success in turning Aspect Ratio On"
            : "Success in turning Aspect Ratio Off",
        );
        setIsSuccessModalOpen(true); // Open success modal on success
      },
      (err) =>
        raiseError(err ?? Error(`Error setting aspect lock to ${value}`)),
    );
  };

  const handleSuccessClose = () => {
    setIsSuccessModalOpen(false);
    setSuccessMessage(""); // Reset message on close
  };

  return (
    <>
      {/* Aspect Lock Confirmation Modal */}
      <Modal
        opened={opened}
        onClose={onClose}
        title="Confirm Aspect Lock Change"
        centered
        size="sm"
      >
        <Text>Turn Aspect Lock On?</Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => handleConfirm(false)}>
            No
          </Button>
          <Button color="blue" onClick={() => handleConfirm(true)}>
            Yes
          </Button>
        </Group>
      </Modal>

      {/* Aspect Lock Success Modal */}
      <Modal
        opened={isSuccessModalOpen}
        onClose={handleSuccessClose}
        title="Aspect Lock Status"
        centered
        size="sm"
      >
        <Text>{successMessage}</Text>
        <Group justify="flex-end" mt="md">
          <Button onClick={handleSuccessClose}>Close</Button>
        </Group>
      </Modal>
    </>
  );
}
