export function magicLayoutScript(debug = false) {
  const version = "7";

  try {
    const layoutSizingData = "%DATA1%";
    const layoutFramesData = "%DATA2%";
    const muggleToVariableMagic = "%DATA3%";
    const dataVersion = "%DATA4%";
    const muggleAnchors = "%DATA5%";

    const stateVariableName = "AUTO_GEN_MAGIC_STATE";
    // Bump when the shape/meaning of stored state changes so old state is
    // discarded rather than misread.
    const stateFormat = "layout-1";
    // Position/size tolerance in page units (px); rotation tolerance in degrees.
    const POS_TOL = 0.5;
    const ROT_TOL = 0.5;

    const currentLayoutName = getSelectedLayoutName();
    const variableMagicName = muggleToVariableMagic[currentLayoutName];
    if (!variableMagicName) return;

    const targetValue = getSelectedItemFromListVariable(variableMagicName);

    const magicLayoutSize = layoutSizingData[targetValue];
    const targetBaked = layoutFramesData[targetValue];
    if (!magicLayoutSize || !targetBaked) return;

    const pageW = getPageWidth();
    const pageH = getPageHeight();

    // Persistent per-document state:
    //   last:      { [magicVariableName]: { value, layout } }
    //   overrides: { [layout]: { [value]: { [frameName]: { h:[a,b], v:[a,b], r } } } }
    //              geometry stored as resize-invariant, per-anchor coordinates.
    //              Keyed by layout because frame geometry AND anchoring are
    //              per-layout, and one magic variable maps several layouts.
    //   version / format: guards for regenerated layouts / changed state shape.
    let state = {};
    try {
      state = JSON.parse(getTextVariableValue(stateVariableName) || "{}");
    } catch (e) {
      state = {};
    }
    if (!state || typeof state !== "object") state = {};
    if (!state.last) state.last = {};
    if (!state.overrides) state.overrides = {};

    const redesigned =
      state.version !== dataVersion || state.format !== stateFormat;
    if (redesigned) {
      state.overrides = {};
      state.version = dataVersion;
      state.format = stateFormat;
    }

    // Anchor info for a frame on the CURRENT (muggle) layout.
    function anchorsFor(name) {
      const byLayout =
        (muggleAnchors && muggleAnchors[currentLayoutName]) || {};
      const a = byLayout[name] || {};
      return {
        h: a.h || "relative",
        v: a.v || "relative",
        // track defaults true (page-anchored); auto defaults false.
        track: a.track !== false,
        auto: a.auto === true,
      };
    }

    // Absolute (position, size) at page dimension D  ->  resize-invariant pair.
    function enc(type, D, p, s) {
      if (type === "start") return [p, s];
      if (type === "end") return [D - p - s, s];
      if (type === "startAndEnd") return [p, D - p - s];
      if (type === "center") return [(p + s / 2) / D, s];
      return [p / D, s / D]; // relative (default)
    }
    // Resize-invariant pair at page dimension D  ->  absolute (position, size).
    function dec(type, D, a, b) {
      if (type === "start") return [a, b];
      if (type === "end") return [D - a - b, b];
      if (type === "startAndEnd") return [a, D - b - a];
      if (type === "center") return [a * D - b / 2, b];
      return [a * D, b * D]; // relative (default)
    }

    // The invariant coordinates baked into the layout for a frame/value.
    function bakedInvariant(value, frame) {
      const size = layoutSizingData[value];
      if (!size || !size.w || !size.h) return null;
      const an = anchorsFor(frame.name);
      return {
        h: enc(an.h, size.w, frame.x, frame.width),
        v: enc(an.v, size.h, frame.y, frame.height),
        r: frame.rotationDegrees,
      };
    }

    function getOverride(layout, value, name) {
      const byLayout = state.overrides[layout];
      const byValue = byLayout && byLayout[value];
      return (byValue && byValue[name]) || null;
    }

    // What we intend to show for a frame/value: a stored override or the baked.
    function expectedInvariant(value, frame) {
      return getOverride(currentLayoutName, value, frame.name) ||
        bakedInvariant(value, frame);
    }

    // CAPTURE: rebuild the override set for the previous (value, layout) from the
    // frames' current geometry. A frame is recorded only where it deviates from
    // what its anchor predicts at the current page size — a pure resize predicts
    // exactly (any anchor), so it never registers; only a real manual edit does.
    // Only runs when we're still on the layout we last applied to, so the live
    // geometry we read actually belongs to that (value, layout). Runs before any
    // programmatic move, so the frames still reflect the user's edit.
    const prev = state.last[variableMagicName];
    if (
      !redesigned &&
      prev &&
      prev.layout === currentLayoutName &&
      layoutFramesData[prev.value] &&
      pageW &&
      pageH
    ) {
      const prevValue = prev.value;
      const ov = {};
      layoutFramesData[prevValue].forEach(function (f) {
        const an = anchorsFor(f.name);
        if (!an.track) return; // frame-to-frame anchored — never remembered
        const bInv = bakedInvariant(prevValue, f);
        if (!bInv) return;
        const bh = dec(an.h, pageW, bInv.h[0], bInv.h[1]); // predicted [x, w]
        const bv = dec(an.v, pageH, bInv.v[0], bInv.v[1]); // predicted [y, h]
        let lx, ly, lw, lh, lr;
        try {
          lx = getFrameX(f.name);
          ly = getFrameY(f.name);
          lw = getFrameWidth(f.name);
          lh = getFrameHeight(f.name);
          lr = getFrameRotation(f.name);
        } catch (e) {
          return; // frame not present — skip it
        }
        // Size deviations on auto-sizing frames come from content/data, not the
        // user, so don't let them trigger (or get pinned into) an override.
        const sizeMoved =
          !an.auto &&
          (Math.abs(lw - bh[1]) > POS_TOL || Math.abs(lh - bv[1]) > POS_TOL);
        const posMoved =
          Math.abs(lx - bh[0]) > POS_TOL ||
          Math.abs(ly - bv[0]) > POS_TOL ||
          Math.abs(lr - bInv.r) > ROT_TOL;
        if (posMoved || sizeMoved) {
          const h = enc(an.h, pageW, lx, lw);
          const v = enc(an.v, pageH, ly, lh);
          if (an.auto) {
            // keep baked size, remember only position/rotation
            h[1] = bInv.h[1];
            v[1] = bInv.v[1];
          }
          ov[f.name] = { h: h, v: v, r: lr };
        }
      });
      if (!state.overrides[currentLayoutName])
        state.overrides[currentLayoutName] = {};
      if (Object.keys(ov).length > 0)
        state.overrides[currentLayoutName][prevValue] = ov;
      else delete state.overrides[currentLayoutName][prevValue];
    }

    // APPLY: place the target value's frames from baked + overrides. Geometry is
    // decoded at the value's page size; for a frame with no override this is the
    // exact baked geometry, so unchanged behavior is preserved.
    const currentLayout = { width: pageW, height: pageH };

    setPageSize(magicLayoutSize.w, magicLayoutSize.h);

    // Hide everything and record which frames actually exist, so a baked frame
    // that was renamed/deleted is skipped rather than aborting the apply loop
    // (which would leave the document with everything hidden).
    const existing = {};
    studio.frames.all().forEach(function (frame) {
      existing[frame.name] = true;
      frame.setVisible(false);
    });

    targetBaked.forEach(function (f) {
      if (!existing[f.name]) return;
      const an = anchorsFor(f.name);
      const exp = expectedInvariant(targetValue, f);
      if (!exp) return;
      const hh = dec(an.h, magicLayoutSize.w, exp.h[0], exp.h[1]); // [x, w]
      const vv = dec(an.v, magicLayoutSize.h, exp.v[0], exp.v[1]); // [y, h]
      setFrameVisible(f.name, true);
      setFrameX(f.name, hh[0]);
      setFrameY(f.name, vv[0]);
      setFrameWidth(f.name, hh[1]);
      setFrameHeight(f.name, vv[1]);
      setFrameRotation(f.name, exp.r);
    });

    setPageSize(currentLayout.width, currentLayout.height);

    // Remember what we just applied so the next trigger can capture against it.
    state.last[variableMagicName] = {
      value: targetValue,
      layout: currentLayoutName,
    };
    setVariableValue(stateVariableName, JSON.stringify(state));
  } catch (e) {
    console.log(e);
  }
}
