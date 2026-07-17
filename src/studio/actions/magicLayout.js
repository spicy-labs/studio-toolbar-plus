export function magicLayoutScript(debug = false) {
  const version = "5";

  try {
    const layoutSizingData = "%DATA1%";
    const layoutFramesData = "%DATA2%";
    const muggleToVariableMagic = "%DATA3%";
    const dataVersion = "%DATA4%";

    const stateVariableName = "AUTO_GEN_MAGIC_STATE";
    // Bump when the shape/meaning of stored state changes so old state (e.g.
    // absolute-coordinate overrides) is discarded rather than misread.
    const stateFormat = "norm-1";
    // Tolerances are in page-normalized units (fraction of page) for geometry
    // and degrees for rotation.
    const POS_TOL = 0.001;
    const ROT_TOL = 0.5;

    const currentLayoutName = getSelectedLayoutName();
    const variableMagicName = muggleToVariableMagic[currentLayoutName];
    if (!variableMagicName) return;

    const targetValue = getSelectedItemFromListVariable(variableMagicName);

    const magicLayoutSize = layoutSizingData[targetValue];
    const targetBaked = layoutFramesData[targetValue];
    if (!magicLayoutSize || !targetBaked) return;

    // Persistent per-document state:
    //   last:      { [magicVariableName]: lastAppliedValue }
    //   overrides: { [value]: { [frameName]: {x,y,width,height,rotationDegrees} } }
    //              geometry is stored NORMALIZED (fraction of page) so it stays
    //              correct across page resizes for relative-anchored frames.
    //   version:   the baked-data version this state was built against
    let state = {};
    try {
      state = JSON.parse(getTextVariableValue(stateVariableName) || "{}");
    } catch (e) {
      state = {};
    }
    if (!state || typeof state !== "object") state = {};
    if (!state.last) state.last = {};
    if (!state.overrides) state.overrides = {};

    // If the baked layout data was regenerated (modal re-run with real changes),
    // discard accumulated manual overrides so the new design wins, and skip the
    // capture step this run so we don't immediately re-record the old positions.
    const redesigned =
      state.version !== dataVersion || state.format !== stateFormat;
    if (redesigned) {
      state.overrides = {};
      state.version = dataVersion;
      state.format = stateFormat;
    }

    // Baked frames for a value, normalized to fractions of that value's page.
    function bakedNorm(value) {
      const baked = layoutFramesData[value];
      const size = layoutSizingData[value];
      const map = {};
      if (!baked || !size || !size.w || !size.h) return map;
      baked.forEach(function (f) {
        map[f.name] = {
          x: f.x / size.w,
          y: f.y / size.h,
          width: f.width / size.w,
          height: f.height / size.h,
          rotationDegrees: f.rotationDegrees,
        };
      });
      return map;
    }

    // Expected normalized geometry: baked with per-frame normalized overrides.
    function expectedNorm(value) {
      const map = bakedNorm(value);
      const ov = state.overrides[value] || {};
      Object.keys(ov).forEach(function (name) {
        if (map[name]) map[name] = ov[name];
      });
      return map;
    }

    // Live geometry of a value's frames, normalized to the CURRENT page size.
    function liveNorm(value) {
      const baked = layoutFramesData[value];
      const pw = getPageWidth();
      const ph = getPageHeight();
      if (!baked || !pw || !ph) return null;
      const map = {};
      baked.forEach(function (f) {
        try {
          map[f.name] = {
            x: getFrameX(f.name) / pw,
            y: getFrameY(f.name) / ph,
            width: getFrameWidth(f.name) / pw,
            height: getFrameHeight(f.name) / ph,
            rotationDegrees: getFrameRotation(f.name),
          };
        } catch (e) {
          // Frame not present — leave it out of the comparison.
        }
      });
      return map;
    }

    function geomDiffers(a, b) {
      return (
        Math.abs(a.x - b.x) > POS_TOL ||
        Math.abs(a.y - b.y) > POS_TOL ||
        Math.abs(a.width - b.width) > POS_TOL ||
        Math.abs(a.height - b.height) > POS_TOL ||
        Math.abs(a.rotationDegrees - b.rotationDegrees) > ROT_TOL
      );
    }

    // CAPTURE: did the user move frames while on the previous value? Compared in
    // normalized space, so an independent page resize (which scales relative
    // frames proportionally) doesn't register — only a real manual move does.
    // Runs before we apply anything, so the live frames still reflect whatever
    // the user left them at.
    const prevValue = state.last[variableMagicName];
    if (!redesigned && prevValue && layoutFramesData[prevValue]) {
      const expected = expectedNorm(prevValue);
      const live = liveNorm(prevValue);
      if (live) {
        const baked = bakedNorm(prevValue);
        let moved = false;
        for (const name in expected) {
          if (live[name] && geomDiffers(live[name], expected[name])) {
            moved = true;
            break;
          }
        }
        if (moved) {
          // Record a sparse override: only frames that differ from baked, so
          // untouched frames still track future baked/layout changes.
          const ov = {};
          for (const name in live) {
            if (baked[name] && geomDiffers(live[name], baked[name])) {
              ov[name] = live[name];
            }
          }
          if (Object.keys(ov).length > 0) {
            state.overrides[prevValue] = ov;
          } else {
            delete state.overrides[prevValue];
          }
        }
      }
    }

    // APPLY: place the target value's frames (baked + normalized overrides).
    // Positions are reconstructed at the value's page size; for non-overridden
    // frames this is exactly the baked absolute geometry (unchanged behavior).
    const expectedTarget = expectedNorm(targetValue);

    const currentLayout = {
      name: currentLayoutName,
      height: getPageHeight(),
      width: getPageWidth(),
    };

    setPageSize(magicLayoutSize.w, magicLayoutSize.h);

    studio.frames.all().forEach(function (frame) {
      frame.setVisible(false);
    });

    targetBaked.forEach(function (f) {
      const name = f.name;
      const e = expectedTarget[name];
      if (!e) return;
      setFrameVisible(name, true);
      setFrameX(name, e.x * magicLayoutSize.w);
      setFrameY(name, e.y * magicLayoutSize.h);
      setFrameWidth(name, e.width * magicLayoutSize.w);
      setFrameHeight(name, e.height * magicLayoutSize.h);
      setFrameRotation(name, e.rotationDegrees);
    });

    setPageSize(currentLayout.width, currentLayout.height);

    // Remember what we just applied so the next trigger can capture against it.
    state.last[variableMagicName] = targetValue;
    setVariableValue(stateVariableName, JSON.stringify(state));
  } catch (e) {
    console.log(e);
  }
}
