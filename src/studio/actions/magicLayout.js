export function magicLayoutScript(debug = false) {
  const version = "8";

  // baked frame: [name, x, y, w, h, r?]  (r omitted when 0)
  // override:    [hPos, hSize, vPos, vSize, r?]  (r omitted when 0)

  try {
    const layoutSizingData = "%DATA1%";
    const layoutFramesData = "%DATA2%";
    const muggleToVariableMagic = "%DATA3%";
    const dataVersion = "%DATA4%";
    const muggleAnchors = "%DATA5%";

    const stateVariableName = "AUTO_GEN_MAGIC_STATE";
    const stateFormat = "layout-2";
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
    //   overrides: { [layout]: { [value]: { [frameName]: [hPos, hSize, vPos, vSize, r?] } } }
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

    function anchorsFor(name) {
      const byLayout =
        (muggleAnchors && muggleAnchors[currentLayoutName]) || {};
      const a = byLayout[name] || {};
      return {
        h: a.h || "relative",
        v: a.v || "relative",
        track: a.track !== false,
        auto: a.auto === true,
      };
    }

    function enc(type, D, p, s) {
      if (type === "start") return [p, s];
      if (type === "end") return [D - p - s, s];
      if (type === "startAndEnd") return [p, D - p - s];
      if (type === "center") return [(p + s / 2) / D, s];
      return [p / D, s / D];
    }
    function dec(type, D, a, b) {
      if (type === "start") return [a, b];
      if (type === "end") return [D - a - b, b];
      if (type === "startAndEnd") return [a, D - b - a];
      if (type === "center") return [a * D - b / 2, b];
      return [a * D, b * D];
    }

    function bakedInvariant(value, bf) {
      const size = layoutSizingData[value];
      if (!size || !size.w || !size.h) return null;
      const an = anchorsFor(bf[0]);
      return {
        h: enc(an.h, size.w, bf[1], bf[3]),
        v: enc(an.v, size.h, bf[2], bf[4]),
        r: bf[5] || 0,
      };
    }

    function getOverride(layout, value, name) {
      const byLayout = state.overrides[layout];
      const byValue = byLayout && byLayout[value];
      const o = byValue && byValue[name];
      if (!o) return null;
      return { h: [o[0], o[1]], v: [o[2], o[3]], r: o[4] || 0 };
    }

    function expectedInvariant(value, bf) {
      return getOverride(currentLayoutName, value, bf[0]) ||
        bakedInvariant(value, bf);
    }

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
      layoutFramesData[prevValue].forEach(function (bf) {
        const an = anchorsFor(bf[0]);
        if (!an.track) return;
        const bInv = bakedInvariant(prevValue, bf);
        if (!bInv) return;
        const bh = dec(an.h, pageW, bInv.h[0], bInv.h[1]);
        const bv = dec(an.v, pageH, bInv.v[0], bInv.v[1]);
        let lx, ly, lw, lh, lr;
        try {
          lx = getFrameX(bf[0]);
          ly = getFrameY(bf[0]);
          lw = getFrameWidth(bf[0]);
          lh = getFrameHeight(bf[0]);
          lr = getFrameRotation(bf[0]);
        } catch (e) {
          return;
        }
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
            h[1] = bInv.h[1];
            v[1] = bInv.v[1];
          }
          const entry = [h[0], h[1], v[0], v[1]];
          if (lr) entry.push(lr);
          ov[bf[0]] = entry;
        }
      });
      if (!state.overrides[currentLayoutName])
        state.overrides[currentLayoutName] = {};
      if (Object.keys(ov).length > 0)
        state.overrides[currentLayoutName][prevValue] = ov;
      else delete state.overrides[currentLayoutName][prevValue];
    }

    const currentLayout = { width: pageW, height: pageH };

    setPageSize(magicLayoutSize.w, magicLayoutSize.h);

    const existing = {};
    studio.frames.all().forEach(function (frame) {
      existing[frame.name] = true;
      frame.setVisible(false);
    });

    targetBaked.forEach(function (bf) {
      if (!existing[bf[0]]) return;
      const an = anchorsFor(bf[0]);
      const exp = expectedInvariant(targetValue, bf);
      if (!exp) return;
      const hh = dec(an.h, magicLayoutSize.w, exp.h[0], exp.h[1]);
      const vv = dec(an.v, magicLayoutSize.h, exp.v[0], exp.v[1]);
      setFrameVisible(bf[0], true);
      setFrameX(bf[0], hh[0]);
      setFrameY(bf[0], vv[0]);
      setFrameWidth(bf[0], hh[1]);
      setFrameHeight(bf[0], vv[1]);
      setFrameRotation(bf[0], exp.r);
    });

    setPageSize(currentLayout.width, currentLayout.height);

    state.last[variableMagicName] = {
      value: targetValue,
      layout: currentLayoutName,
    };
    setVariableValue(stateVariableName, JSON.stringify(state));
  } catch (e) {
    console.log(e);
  }
}
