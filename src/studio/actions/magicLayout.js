export function magicLayoutScript(debug = false) {
  const version = "2";

/*   const variableName = getTriggeredVariableName();
  if (!variableName.startsWith("✨")) return; */

  try {
    const layoutSizingData = "%DATA1%";
    const layoutFramesData = "%DATA2%";
    const muggleToVariableMagic = "%DATA3%";

    const currentLayoutName = getSelectedLayoutName();
    const variableMagicName = muggleToVariableMagic[currentLayoutName];

    if (!variableMagicName) return;

    const magicLayoutName = getSelectedItemFromListVariable(variableMagicName);

    const magicLayoutSize = layoutSizingData[magicLayoutName];
    const magicLayoutFrames = layoutFramesData[magicLayoutName];

    if (!magicLayoutSize || !magicLayoutFrames) return;

    const currentLayout = {
      name: getSelectedLayoutName(),
      height: getPageHeight(),
      width: getPageWidth(),
    };

    setPageSize(magicLayoutSize.w, magicLayoutSize.h);

    studio.frames.all().forEach((frame) => {
      frame.setVisible(false);
    });

    // Iterate over each frame data object in the visibleFramesData array
    magicLayoutFrames.forEach((frameData) => {
      const name = frameData.name;

      setFrameVisible(name, true);
      setFrameX(name, frameData.x);
      setFrameY(name, frameData.y);
      setFrameWidth(name, frameData.width);
      setFrameHeight(name, frameData.height);
      setFrameRotation(name, frameData.rotationDegrees);
    });

    setPageSize(currentLayout.width, currentLayout.height);
  }
  catch(e) {
    console.log(e);
  }
}
