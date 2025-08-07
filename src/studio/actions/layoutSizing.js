export function layoutSizingScript(debug = false) {
  const version = "4";
  let debugObj = {};
  const selectedLayoutName = getSelectedLayoutName();
  try{
    const data = JSON.parse(getTextVariableValue("AUTO_GEN_TOOLBAR_LAYOUTS"));
      if (selectedLayoutName == null) {
        return;
      }
      const { width, height, aspectRatio: layoutRatio, sizing } = data[selectedLayoutName];
      if (debug) {
        debugObj = JSON.parse(JSON.stringify({
          selectedLayoutName,
          data,
          layoutRatio,
          width,
          height
        }));
      }
      if (layoutRatio != null && width != null && height != null) {
        const originalAspectRatio = layoutRatio;
        const minAllowedRatio = originalAspectRatio * 0.8;
        const maxAllowedRatio = originalAspectRatio * 1.2;
        let pageWidth = getPageWidth();
        let pageHeight = getPageHeight();
        const currentAspectRatio = pageWidth / pageHeight;
        if (debug) {
          debugObj = {
            currentAspectRatio,
            minAllowedRatio,
            maxAllowedRatio,
            pageWidth,
            pageHeight,
            ...debugObj
          };
        }

        if (currentAspectRatio < minAllowedRatio || currentAspectRatio > maxAllowedRatio) {
          // Determine which ratio boundary (min or max) is closer to the current ratio
          const distToMin = Math.abs(currentAspectRatio - minAllowedRatio);
          const distToMax = Math.abs(currentAspectRatio - maxAllowedRatio);
          const targetRatio = distToMin <= distToMax ? minAllowedRatio : maxAllowedRatio;

          if (Math.round(width) == Math.round(pageWidth)) {
            // Width was changed by user, so we adjust width to maintain ratio
            let newWidth = pageHeight * targetRatio;

            if (newWidth > sizing.maxWidth) {
              newWidth = sizing.maxWidth;
              pageHeight = newWidth / targetRatio;

            }

            if (newWidth < sizing.minWidth) {
              newWidth = sizing.minWidth;
              pageHeight = newWidth / targetRatio;
            }



            data[selectedLayoutName].width = newWidth;
            data[selectedLayoutName].height = pageHeight;
            setPageSize(newWidth, pageHeight);
          }
          else if (Math.round(height) == Math.round(pageHeight)) {
            // Height was changed by user, so we adjust height to maintain ratio
            let newHeight = pageWidth / targetRatio;

            if (newHeight > sizing.maxHeight) {
              newHeight = sizing.maxHeight;
              pageWidth = newHeight * targetRatio;
            }

            if (newHeight < sizing.minHeight) {
              newHeight = sizing.minHeight;
              pageWidth = newHeight * targetRatio;
            }

            data[selectedLayoutName].height = newHeight;
            data[selectedLayoutName].width = pageWidth;
            setPageSize(pageWidth, newHeight);
          }
          else {
            // Both dimensions changed, use the target ratio to adjust
            data[selectedLayoutName].height = pageHeight;
            data[selectedLayoutName].width = pageHeight * targetRatio;
            setPageSize(data[selectedLayoutName].width, pageHeight);
          }
        } else {
          // Within acceptable ratio range, store current dimensions
          data[selectedLayoutName].height = pageHeight;
          data[selectedLayoutName].width = pageWidth;
        }

        setVariableValue("AUTO_GEN_TOOLBAR_LAYOUTS", JSON.stringify(data, null, 0));
      }
      if (debug) {
        console.log(debugObj);
      }
  } catch (e) {
    console.log(e);
  }
}