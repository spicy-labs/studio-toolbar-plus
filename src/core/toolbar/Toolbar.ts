import { useEffect, createElement, Fragment, type ReactNode } from "react";
import type { Config } from "../configType";
import UpdateNotice from "../../apps/update/UpdateNotice";
import { Alerts } from "../alerts/Alerts";
import { appStore } from "../appStore/store";
import { VariableMapper } from "../../apps/variableMapper/VariableMapper";
import { createToolbarDisplay } from "./createToolbarDisplay";
import { throttle } from "../utils/throttle";

type ToolbarProps = {
  config: Config;
};

export function Toolbar({ config }: ToolbarProps): ReactNode {
  const configState = appStore((store) => store.state.toolbar.config);
  const isToolbarVisible = appStore(
    (store) => store.state.toolbar.isToolbarVisible
  );
  const isToolbarDisabled = appStore(
    (store) => store.state.toolbar.isToolbarDisabled
  );
  const { setToolbarVisible } = appStore.getState().actions.toolbar;

  useEffect(() => {
    appStore.getState().actions.toolbar.setConfig(config);
  }, [config]);

  useMouseTracker(setToolbarVisible, 70, 100);

  if (!configState) {
    return createElement("div", {}, "Loading...");
  }

  return createElement(Fragment, {}, [
    createToolbarDisplay({
      isToolbarVisible,
      isToolbarDisabled,
    }),
    createElement(UpdateNotice),
    createElement(Alerts),
    createElement(VariableMapper),
  ]);
}

function useMouseTracker(
  setToolbarVisible: (isVisible: boolean) => void,
  detectionFromTop: number,
  throttleMS: number
) {
  useEffect(() => {
    const handleMouseMove = throttle((event: MouseEvent) => {
      const isNearTop = event.clientY <= detectionFromTop;
      if (isNearTop) {
        setToolbarVisible(true);
      }
    }, throttleMS);

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [setToolbarVisible]);
}
