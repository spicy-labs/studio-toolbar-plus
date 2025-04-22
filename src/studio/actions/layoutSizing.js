export function layoutSizingScript(debug = false) {
    const version = 1;
    let debugObj = {};

    const selectedLayoutName = getSelectedLayoutName();

    const data = JSON.parse(getTextVariableValue("AUTO_GEN_TOOLBAR_LAYOUTS"));

    if (selectedLayoutName == null) {
        return;
    }

    const {width, height, aspectRatio:layoutRatio} = data[selectedLayoutName];

    if (debug) {
      debugObj = JSON.parse(
        JSON.stringify({
          selectedLayoutName,
          data,
          layoutRatio,
          width,
          height,
        }),
      );
    }

    if (layoutRatio != null && width != null && height != null) {
      // Calculate the original width/height ratio
      const originalAspectRatio = layoutRatio;

      // Determine allowable ratio range with a 20% flexibility
      const minAllowedRatio = originalAspectRatio * 0.8;
      const maxAllowedRatio = originalAspectRatio * 1.2;

      // Get current page size
      const pageWidth = getPageWidth();
      const pageHeight = getPageHeight();

      // Calculate the current page width/height ratio
      const currentAspectRatio = pageWidth / pageHeight;

      if (debug) {
        debugObj = {
          currentAspectRatio,
          minAllowedRatio,
          maxAllowedRatio,
          pageWidth,
          pageHeight,
          ...debugObj,
        };
      }

      // Check if the current ratio is outside the allowable range
      if (
        currentAspectRatio < minAllowedRatio ||
        currentAspectRatio > maxAllowedRatio
      ) {
        if (Math.round(width) == Math.round(pageWidth)) {
          //debugObj.outsideRange = "width same";
          let newHeight;

          // Compare current ratio to original ratio
          if (currentAspectRatio <= minAllowedRatio) {
            // Page is too tall for the ratio - use minAllowedRatio
            newHeight = pageWidth / minAllowedRatio;
          } else if (currentAspectRatio >= maxAllowedRatio) {
            // Page is too short for the ratio - use maxAllowedRatio
            newHeight = pageWidth / maxAllowedRatio;
          } else {
            // Should be within range, but if we got here use original ratio
            newHeight = pageWidth / layoutRatio;
          }

          //debugObj.newHeight = newHeight;

          data[selectedLayoutName].height = newHeight;
          data[selectedLayoutName].width = pageWidth;
          setPageSize(pageWidth, newHeight);
        }

        // If height is the same and width needs adjustment
        if (Math.round(height) == Math.round(pageHeight)) {
          //debugObj.outsideRange = "height same";
          let newWidth;

          // Compare current ratio to original ratio
          if (currentAspectRatio <= minAllowedRatio) {
            // Page is too tall for the ratio - use minAllowedRatio
            newWidth = pageHeight * minAllowedRatio;
          } else if (currentAspectRatio >= maxAllowedRatio) {
            // Page is too short for the ratio - use maxAllowedRatio
            newWidth = pageHeight * maxAllowedRatio;
          } else {
            // Should be within range, but if we got here use original ratio
            newWidth = pageHeight * layoutRatio;
          }

          //debugObj.newWidth = newWidth;

          data[selectedLayoutName].width = newWidth;
          data[selectedLayoutName].height = pageHeight;
        }

        // debugObj.setPageSize = [
        //   data.layoutSizeCache[selectedLayoutName].width,
        //   data.layoutSizeCache[selectedLayoutName].height,
        // ];

        setPageSize(
          data[selectedLayoutName].width,
          data[selectedLayoutName].height,
        );
      } else {
        //debugObj.outsideRange = "no";

        data[selectedLayoutName].height = pageHeight;
        data[selectedLayoutName].width = pageWidth;
      }

      setVariableValue("AUTO_GEN_TOOLBAR_LAYOUTS", JSON.stringify(data, null, 0));
    }
    if (debug) {
      console.log(debugObj);
    }
  }