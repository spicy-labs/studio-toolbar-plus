import React, { useEffect, useRef } from "react";
import { Alert, Box, Stack } from "@mantine/core";
import { IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";
import { appStore, type Alert as StoreAlert } from "../modalStore";

const alertPresentation: Record<
  StoreAlert["severity"],
  {
    color: string;
    variant: "filled" | "light";
    title: string;
    icon: typeof IconInfoCircle;
    // `light` renders a translucent tint, which is unreadable over the Studio
    // canvas — give those an opaque surface with a colored accent instead.
    surface?: string;
  }
> = {
  error: {
    color: "red",
    variant: "filled",
    title: "Toolbar Error",
    icon: IconAlertTriangle,
  },
  warning: {
    color: "yellow",
    variant: "light",
    title: "Warning",
    icon: IconAlertTriangle,
    surface: "#2c2a20",
  },
  info: {
    color: "blue",
    variant: "light",
    title: "Notice",
    icon: IconInfoCircle,
    surface: "#20252c",
  },
};

export function AlertsContainer() {
  const alerts = appStore((store) => store.alerts);
  const dismissAlert = appStore((store) => store.dismissAlert);
  const timers = useRef(
    new Map<string, ReturnType<typeof setTimeout>>()
  );

  useEffect(() => {
    const alertIds = new Set(alerts.map((alert) => alert.id));

    timers.current.forEach((timer, id) => {
      const alert = alerts.find((alert) => alert.id === id);
      if (!alertIds.has(id) || alert?.persistent) {
        clearTimeout(timer);
        timers.current.delete(id);
      }
    });

    alerts.forEach((alert) => {
      if (alert.persistent || timers.current.has(alert.id)) {
        return;
      }

      const timer = setTimeout(() => {
        timers.current.delete(alert.id);
        dismissAlert(alert.id);
      }, 7000);

      timers.current.set(alert.id, timer);
    });
  }, [alerts, dismissAlert]);

  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    };
  }, []);

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
        {[...alerts]
          .sort(
            (first, second) =>
              Number(Boolean(second.persistent)) -
              Number(Boolean(first.persistent))
          )
          .map((alert) => {
            const presentation = alertPresentation[alert.severity];
            const Icon = presentation.icon;

            return (
              <Alert
                key={alert.id}
                icon={<Icon size="1rem" />}
                title={alert.title ?? presentation.title}
                variant={presentation.variant}
                color={presentation.color}
                withCloseButton
                onClose={() => dismissAlert(alert.id)}
                styles={{
                  root: {
                    animation: "fadeIn 0.3s ease-in-out",
                    ...(presentation.surface
                      ? {
                          backgroundColor: presentation.surface,
                          border: `1px solid var(--mantine-color-${presentation.color}-8)`,
                          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.45)",
                        }
                      : {}),
                  },
                  ...(presentation.surface
                    ? {
                        message: { color: "var(--mantine-color-gray-2)" },
                      }
                    : {}),
                }}
              >
                {alert.message}
              </Alert>
            );
          })}
      </Stack>
    </Box>
  );
}
