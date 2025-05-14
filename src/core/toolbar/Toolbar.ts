import { useEffect, createElement, type ReactNode } from "react";
import type { Config } from "../configType";
import { Result } from "typescript-result";
import UpdateNotice from "../../apps/update/UpdateNotice";
import { appStore } from "../appStore/store";

type ToolarProps = {
  config: Config;
};

export function Toolbar({ config }: ToolarProps): ReactNode {

  const configState = appStore((store) => store.state.toolbar.config);

  useEffect(() => {
    appStore.getState().actions.toolbar.setConfig(config);
  }, []);

  if (!configState) {
    return createElement("div", {}, "Loading...");
  }
  else {
    return createElement(UpdateNotice);
  }
}
