import { useEffect, createElement, Fragment, type ReactNode } from "react";
import type { Config } from "../configType";
import { Result } from "typescript-result";
import UpdateNotice from "../../apps/update/UpdateNotice";
import { Alerts } from "../alerts/Alerts";
import { appStore } from "../appStore/store";
import { VariableMapper } from "../../apps/variableMapper/VariableMapper";
import { ActionIcon, Box, Group, Tooltip, Transition } from "@mantine/core";
import { getIcon as getVariableMapperIcon } from "../../apps/variableMapper/VariableMapper";

type ToolarProps = {
  config: Config;
};

export function Toolbar({ config }: ToolarProps): ReactNode {
  const configState = appStore((store) => store.state.toolbar.config);
  const isToolbarVisible = appStore(
    (store) => store.state.toolbar.isToolbarVisible,
  );
  const isToolbarDisabled = appStore(
    (store) => store.state.toolbar.isToolbarDisabled,
  );

  useEffect(() => {
    appStore.getState().actions.toolbar.setConfig(config);
  }, []);

  if (!configState) {
    return createElement("div", {}, "Loading...");
  }

  const toolbarContent = createElement(Transition, {
    mounted: isToolbarVisible && !isToolbarDisabled,
    transition: "slide-down",
    duration: 300,
    timingFunction: "ease",
    children: () =>
      createElement(
        Box<"div">,
        {
          style: {
            position: "fixed",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            width: "60%",
            backgroundColor: "#25262b",
            padding: "10px",
            display: "flex",
            justifyContent: "center",
            boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
            borderBottom: "1px solid #373A40",
          },
        },
        createElement(
          Group,
          {
            gap: "lg",
          },
          [
            // Variable Mapper Button
            createElement(Tooltip, {
              label: "Variable Mapper",
              position: "bottom",
              children: createElement(
                ActionIcon<"button">,
                {
                  variant: "filled",
                  color: "blue",
                  size: "lg",
                  onClick: () => {
                    appStore
                      .getState()
                      .actions.variableMapper.setIsVariableMapperModalOpen(
                        true,
                      );
                  },
                },
                getVariableMapperIcon(),
              ),
            }),
          ],
        ),
      ),
  });

  return createElement(Fragment, {}, [
    toolbarContent,
    createElement(UpdateNotice),
    createElement(Alerts),
    createElement(VariableMapper),
  ]);
}
