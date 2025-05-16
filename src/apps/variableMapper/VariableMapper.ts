import { createElement } from "react";
import { IconMapBolt } from "@tabler/icons-react";
import { appStore } from "../../core/appStore/store";
import { Modal } from "@mantine/core";
export function getIcon() {
  return createElement(IconMapBolt, { size: 20 });
}

export function VariableMapper() {
  const isModalOpen = appStore(
    (store) => store.state.variableMapper.isModalOpen,
  );
  const { setToolbarDisabled } = appStore.getState().actions.toolbar;

  const { setIsVariableMapperModalOpen } =
    appStore.getState().actions.variableMapper;

  if (isModalOpen) {
    setToolbarDisabled(true);
  }

  return createElement(Modal, {
    opened: isModalOpen,
    onClose: () => {
      setIsVariableMapperModalOpen(false);
      setToolbarDisabled(false);
    },
    fullScreen: true,
    title: "Variable Mapper",
    children: createElement("div", null, "Variable Mapper Content"),
  });
}
