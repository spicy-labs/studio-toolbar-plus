export function imageSizingScript(debug) {
  const version = 0.4;
  const imageSizingData = "%DATA1%";
  const layoutSizingData = "%DATA2%";

  const errorCollection = [];

  const vars = studio.variables.all();
  const imageVars = vars.filter((f) => f.type == "image");

  const layoutName = getSelectedLayoutName();

  const layoutImageSizingData = imageSizingData[layoutName];
  const layoutSizeData = layoutSizingData[layoutName];

  if (layoutSizeData == null) {
    errorCollection.push(
      Error(`No layout sizing data found for ${layoutName}}`),
    );
    return;
  }

  if (layoutImageSizingData == null) {
    errorCollection.push(
      Error(`No layout image sizing data found for ${layoutName}}`),
    );
    return;
  }

  for (const imageVar of imageVars) {
    const imageSizeData = layoutImageSizingData[imageVar.value];

    if (imageSizeData == null) {
      errorCollection.push(
        Error(
          `No image size data found for ${imageVar.value} for variable ${imageVar.name}`,
        ),
      );
      continue;
    }

    console.log("HELLO");
    console.log(JSON.stringify(imageSizeData));

    const newFramePos = calculateUpdatedFrame(imageSizeData, layoutSizeData, {
      width: getPageWidth(),
      height: getPageHeight(),
    });

    const frameName = imageSizeData.frameName;

    setFrameX(frameName, newFramePos.x);
    setFrameY(frameName, newFramePos.y);
    setFrameWidth(frameName, newFramePos.width);
    setFrameHeight(frameName, newFramePos.height);
  }

  function calculateUpdatedFrame(initialFrame, initialPage, currentPage) {
    // Prevent division by zero
    if (initialPage.width <= 0 || initialPage.height <= 0) {
      return initialFrame; // Or throw an error, or return initialFrame
    }

    // Calculate the frame's initial position relative to the page's top-left corner
    const relativeInitialX = initialFrame.x;
    const relativeInitialY = initialFrame.y;

    // Calculate ratios based on initial states
    const widthRatio = initialFrame.width / initialPage.width;
    const heightRatio = initialFrame.height / initialPage.height;
    const xPosRatio = relativeInitialX / initialPage.width; // Frame's relative X start / Page Width
    const yPosRatio = relativeInitialY / initialPage.height; // Frame's relative Y start / Page Height

    // --- 2. Apply Ratios to New Page ---

    // Calculate new dimensions
    const updatedWidth = currentPage.width * widthRatio;
    const updatedHeight = currentPage.height * heightRatio;

    // Calculate new relative position based on the ratios and new page size
    const updatedRelativeX = currentPage.width * xPosRatio;
    const updatedRelativeY = currentPage.height * yPosRatio;

    // Calculate new absolute position by adding the current page's position
    const updatedX = updatedRelativeX;
    const updatedY = updatedRelativeY;

    // Return the updated frame object
    return {
      x: updatedX,
      y: updatedY,
      width: updatedWidth,
      height: updatedHeight,
    };
  }
}
