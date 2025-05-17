import { createElement, type ReactNode } from "react";
import {
  ActionIcon,
  Box,
  Center,
  Group,
  Tooltip,
  Transition,
} from "@mantine/core";
import { appStore } from "../appStore/store";
import { getIcon as getVariableMapperIcon } from "../../apps/variableMapper/VariableMapper";

type ToolbarDisplayProps = {
  isToolbarVisible: boolean;
  isToolbarDisabled: boolean;
};
export function createToolbarDisplay({
  isToolbarVisible,
  isToolbarDisabled,
}: ToolbarDisplayProps): ReactNode[] {
  const toolbarContent = createElement(Transition, {
    mounted: isToolbarVisible && !isToolbarDisabled,
    transition: "slide-down",
    duration: 300,
    timingFunction: "ease",
    children: (styles) =>
      createElement(
        Center<"div">,
        {},
        createElement(
          Box<"div">,
          {
            style: {
              position: "absolute",
              top: 0,
              zIndex: 99,
              width: "60%",
              height: "60px",
              backgroundColor: "#25262b",
              padding: "10px",
              display: "flex",
              justifyContent: "center",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
              borderBottom: `1px solid ${"#373A40"}`,
              ...styles,
            },
          },
          createElement(
            Group,
            {
              gap: "lg",
            },
            [
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
                          true
                        );
                    },
                  },
                  getVariableMapperIcon()
                ),
              }),
            ]
          )
        )
      ),
  });

  const invisibleDiv = createElement("div", {
    style: {
      position: "fixed",
      top: "70px",
      left: 0,
      width: "100%",
      height: "50vh",
      zIndex: 999,
      cursor: "default",
      pointerEvents: "all",
    },
    onMouseEnter: () => {
      appStore.getState().actions.toolbar.setToolbarVisible(false);
    },
  });

  if (isToolbarVisible && !isToolbarDisabled) {
    return [toolbarContent, invisibleDiv];
  }

  return [toolbarContent];
}
