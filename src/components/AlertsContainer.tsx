import React, { useEffect } from "react";
import { Alert, Box, Stack } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useAppStore } from "../modalStore";

export function AlertsContainer() {
  const { alerts, dismissAlert } = useAppStore();

  // Set up automatic dismissal after 10 seconds
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    alerts.forEach((alert) => {
      const timer = setTimeout(() => {
        dismissAlert(alert.id);
      }, 7000); // 10 seconds

      timers.push(timer);
    });

    // Clean up timers on unmount or when alerts change
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [alerts, dismissAlert]);

  if (alerts.length === 0) {
    return null;
  }

  return (
    <Box
      style={{
        position: "fixed",
        top: "20px",
        left: "20px",
        zIndex: 1001,
        width: "300px",
      }}
    >
      <Stack gap="md">
        {alerts.map((alert) => (
          <Alert
            key={alert.id}
            icon={<IconInfoCircle size="1rem" />}
            title="Toolbar Error"
            variant="filled"
            color="red"
            withCloseButton
            onClose={() => dismissAlert(alert.id)}
            styles={{
              root: {
                animation: "fadeIn 0.3s ease-in-out",
              },
            }}
          >
            {alert.message}
          </Alert>
        ))}
      </Stack>
    </Box>
  );
}

