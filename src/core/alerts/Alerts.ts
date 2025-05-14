import { Alert, Box, Stack } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { createElement, type ReactNode, useMemo } from "react";
import { appStore } from "../appStore/store";
import type { Alert as AlertType } from "./alertsStore";

export function Alerts(): ReactNode {
  const alertsMap = appStore((store) => store.state.alerts.alerts);
  const alerts = useMemo(() => Array.from(alertsMap.values()), [alertsMap]);
  const { dismissAlert } = appStore.getState().actions.alerts;

  if (alerts.length === 0) {
    return null;
  }

  return createElement(
    Box<"div">,
    {
      style: {
        position: "fixed",
        top: "20px",
        left: "20px",
        zIndex: 1001,
        width: "300px",
      },
    },
    createElement(
      Stack,
      { gap: "md" },
      alerts.map((alert: AlertType) =>
        createElement(
          Alert,
          {
            key: alert.id,
            icon: createElement(IconInfoCircle, { size: "1rem" }),
            title: "Toolbar Error",
            variant: "filled",
            color: "red",
            withCloseButton: true,
            onClose: () => dismissAlert(alert.id),
          },
          alert.message
        )
      )
    )
  );
}
