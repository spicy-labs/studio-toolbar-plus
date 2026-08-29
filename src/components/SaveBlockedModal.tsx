import { useEffect, useState } from "react";
import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import type { PendingSave } from "../utils/studioVersionInterceptor";

type Props = {
  // The held save, straight from the interceptor's `studioToolbarPlus:saveBlocked`
  // event. Non-null means a real request is sitting unsent with its fetch promise
  // pending, so the modal is open exactly when there is something to settle.
  pending: PendingSave | null;
  onForce: (id: string) => Promise<void> | void;
  onCancel: (id: string) => void;
};

export function SaveBlockedModal({ pending, onForce, onCancel }: Props) {
  const [forcing, setForcing] = useState(false);
  // Set when the user dismisses while a force is already in flight. The request
  // is gone and cannot be recalled, so this hides the modal WITHOUT touching the
  // held save — the Toolbar still owns it and still reports the outcome.
  const [steppedAside, setSteppedAside] = useState(false);

  // A new held save reuses this component, so never inherit the previous one's
  // dismissal.
  useEffect(() => {
    setSteppedAside(false);
  }, [pending?.id]);

  const handleCancel = () => {
    if (!pending) return;
    if (forcing) {
      // Once forced, the request is on the wire: there is nothing left to cancel
      // and the interceptor's timeout backstop was cleared when it settled. If
      // the network then hangs, refusing to close would trap the user behind a
      // blocking overlay with no exit. Step aside instead — the result alert
      // still tells them how it went.
      setSteppedAside(true);
      return;
    }
    onCancel(pending.id);
  };

  const handleForce = async () => {
    if (!pending || forcing) return;
    setForcing(true);
    try {
      await onForce(pending.id);
    } finally {
      setForcing(false);
    }
  };

  // The noun the platform uses for the thing being saved, so the copy never says
  // "document" where the user is looking at a component.
  const noun = pending?.kind === "component" ? "component" : "template";
  const overrideVersion = pending?.overrideVersion ?? "";
  const defaultVersion = pending?.defaultVersion ?? null;
  const isCreate = pending?.isCreate ?? false;

  return (
    <Modal
      opened={pending !== null && !steppedAside}
      // Escape and click-outside both cancel, and that is deliberate. A held save
      // is a fetch promise the editor is still waiting on, so every exit from this
      // modal must settle it. Making the modal undismissable would not make the
      // user think harder — it would only add ways to leave the save hanging
      // forever, which wedges the workspace far more badly than a cancelled save.
      closeOnEscape
      closeOnClickOutside
      onClose={handleCancel}
      title="Save blocked — version override active"
      centered
      size="md"
    >
      <Stack>
        {defaultVersion === null ? (
          <>
            <Text>
              This tab is running Studio{" "}
              <Text span fw={700}>
                {overrideVersion}
              </Text>
              , but this environment's default version could not be determined.
            </Text>
            <Text>
              The save was blocked because we could not confirm it is safe. If
              this environment's default is older than {overrideVersion}, saving
              writes the {noun} in a newer document format that the default can
              never open again.
            </Text>
          </>
        ) : isCreate ? (
          <>
            <Text>
              This tab is running Studio{" "}
              <Text span fw={700}>
                {overrideVersion}
              </Text>
              , but this environment's default is{" "}
              <Text span fw={700}>
                {defaultVersion}
              </Text>
              .
            </Text>
            <Text>
              The new {noun} will be <Text span fw={700}>created</Text> in a
              format {defaultVersion} cannot open. It will look broken to
              everyone else — including server-side output — from the moment it
              exists, and there is no way to convert it back.
            </Text>
          </>
        ) : (
          <>
            <Text>
              This tab is running Studio{" "}
              <Text span fw={700}>
                {overrideVersion}
              </Text>
              , but this environment's default is{" "}
              <Text span fw={700}>
                {defaultVersion}
              </Text>
              . Saving now writes the {noun} in a newer document format.
            </Text>
            <Text>
              If you save, this {noun} may no longer open on {defaultVersion}.
              Anyone without the override — including server-side output — would
              get an "incompatible document" error, and there is no way to
              convert it back.
            </Text>
          </>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={handleCancel} disabled={forcing}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={handleForce}
            loading={forcing}
            disabled={forcing}
          >
            Force save anyway
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
