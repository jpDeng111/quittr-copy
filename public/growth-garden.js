/* Original, deterministic tree illustrations driven by the account's daily check-ins. */
const GrowthGarden = (() => {
  const finalDay = 99;
  const soil = 194;
  const width = 256;
  const height = 213;
  const trees = [
    {
      id: "pine", name: "青松", seed: 122, accent: "#b4d996", bark: "#957a52",
      foliage: ["#234d3c", "#367050", "#538858", "#75a36a", "#a7c684"],
      // Each canopy starts at a point on the trunk and spreads toward the branch tip.
      branches: [
        [3, 95, -28, 104, 30, 8, 1], [3, 106, 25, 119, 30, 9, 4],
        [1, 71, 53, 86, 45, 10, 12], [0, 60, -52, 77, 48, 12, 17],
        [0, 91, -45, 108, 34, 9, 24], [5, 110, 7, 145, 20, 13, 29],
        [-3, 46, -59, 52, 48, 12, 39], [0, 43, 68, 60, 47, 12, 47],
        [0, 79, 41, 95, 32, 8, 56], [-1, 33, -33, 44, 37, 9, 64]
      ]
    },
    {
      id: "ginkgo", name: "银杏", seed: 467, accent: "#e5c573", bark: "#aa8359",
      foliage: ["#65552e", "#9b7936", "#b99645", "#dbb95a", "#f0d789"],
      branches: [
        [0, 60, -28, 101, 29, 21, 1], [0, 72, 19, 122, 27, 22, 6],
        [0, 65, 41, 103, 32, 20, 12], [0, 52, -52, 85, 33, 19, 18],
        [-2, 82, -35, 133, 26, 20, 27], [0, 99, 0, 152, 24, 17, 33],
        [1, 72, 64, 110, 32, 21, 43], [2, 88, 39, 142, 25, 19, 52],
        [1, 61, -66, 107, 27, 18, 60], [0, 83, 5, 111, 30, 18, 68]
      ]
    },
    {
      id: "cherry", name: "山樱", seed: 726, accent: "#ecc1cf", bark: "#9c7470",
      foliage: ["#513746", "#865569", "#b17d8f", "#dbaaba", "#f4d0d0"],
      branches: [
        [1, 43, -39, 81, 29, 16, 1], [2, 50, 34, 93, 33, 18, 5],
        [4, 66, 56, 109, 37, 19, 12], [1, 59, -52, 107, 37, 18, 18],
        [-2, 78, -24, 124, 35, 18, 25], [4, 80, 23, 134, 31, 18, 34],
        [2, 66, 65, 83, 30, 15, 44], [-3, 56, -70, 78, 24, 15, 53],
        [3, 76, 2, 106, 36, 15, 62], [1, 59, 29, 70, 29, 13, 70]
      ]
    }
  ];

  function getGrowth(count) {
    const day = Math.min(finalDay, count);
    const stage = day === 0 ? "待发芽" : day < 15 ? "新芽" : day < 36 ? "抽枝"
      : day < 70 ? "展冠" : day < finalDay ? "茂盛" : "成树";
    return { day, stage, size: 0.33 + 0.67 * Math.pow(day / finalDay, 0.63) };
  }

  function seededRandom(seed) {
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function ellipse(ctx, x, y, rx, ry, color, angle = 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
    ctx.fill();
  }

  function paintGround(ctx, tree) {
    const fleck = seededRandom(874);
    const glow = ctx.createRadialGradient(134, soil, 2, 134, soil, 112);
    glow.addColorStop(0, "#070e0bd9");
    glow.addColorStop(1, "#070e0b00");
    ellipse(ctx, 134, soil, 114, 15, glow);
    ctx.strokeStyle = tree.accent + "38";
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 66; i++) {
      const x = 15 + fleck() * 231;
      const y = soil + (fleck() - 0.35) * 19;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.7 + fleck() * 2.5, y - 0.6 - fleck() * 2.5);
      ctx.stroke();
    }
  }

  function paintTrunk(ctx, trunkTop, day, tree) {
    const base = 6 + day * 0.047;
    const bark = ctx.createLinearGradient(-base, 0, base, 0);
    bark.addColorStop(0, "#30291d");
    bark.addColorStop(0.51, tree.bark);
    bark.addColorStop(0.8, "#574833");
    bark.addColorStop(1, "#30291d");
    ctx.fillStyle = bark;
    ctx.beginPath();
    ctx.moveTo(-base * 2, 1);
    ctx.bezierCurveTo(-base * 0.5, -5, -base, -trunkTop * 0.55, 0, -trunkTop);
    ctx.bezierCurveTo(7, -trunkTop * 0.67, 3, -18, base * 2, 1);
    ctx.quadraticCurveTo(2, -3, -base * 2, 1);
    ctx.fill();
    ctx.strokeStyle = "#e7c89940";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-base * 0.6, -3);
    ctx.bezierCurveTo(1, -16, -3, -trunkTop * 0.64, 1, -trunkTop * 0.9);
    ctx.stroke();
  }

  function paintBranch(ctx, branch, x, y, bud, tree) {
    const [startX, startY] = branch;
    ctx.lineCap = "round";
    ctx.strokeStyle = tree.bark;
    ctx.lineWidth = 1.1 + bud * 2.2;
    ctx.beginPath();
    ctx.moveTo(startX, -startY);
    ctx.quadraticCurveTo(startX + (x - startX) * 0.5, -startY - 2, x, y);
    ctx.stroke();
  }

  function paintCanopy(ctx, tree, cluster, day) {
    const [branchX, branchY, endX, endY, spreadX, spreadY, born] = cluster;
    const bud = Math.max(0, Math.min(1, (day - born + 4) / 27));
    if (!bud) return;
    const x = branchX + (endX - branchX) * bud;
    const y = -branchY + (branchY - endY) * bud;
    paintBranch(ctx, cluster, x, y, bud, tree);
    const fleck = seededRandom(tree.seed + born * 1031);
    const color = tree.foliage;
    const radius = 0.23 + bud * 0.77;
    const leaves = 14 + Math.floor(bud * 84 + day * 0.42);
    // Paint successive leaves from the shaded underside up to the illuminated crown.
    for (let i = 0; i < leaves; i++) {
      const angle = fleck() * Math.PI * 2;
      const distance = Math.sqrt(fleck());
      const offsetX = Math.cos(angle) * distance * spreadX * radius;
      const offsetY = Math.sin(angle) * distance * spreadY * radius;
      const shade = Math.min(4, Math.floor(fleck() * 3 + (offsetY < 0 ? 1.6 : 0)));
      const leaf = (1.2 + fleck() * 4.8) * (0.60 + bud * 0.4);
      const elongated = tree.id === "pine" ? 0.33 : tree.id === "ginkgo" ? 0.69 : 0.82;
      ellipse(ctx, x + offsetX, y + offsetY, leaf, leaf * elongated, color[shade], angle * 0.7);
    }
    if (tree.id === "cherry" && day > 28) {
      for (let i = 0; i < Math.floor((day - 28) * bud / 6); i++) {
        const petalX = x + (fleck() - 0.5) * spreadX * radius * 1.55;
        const petalY = y + (fleck() - 0.6) * spreadY * radius * 1.8;
        ellipse(ctx, petalX, petalY, 2, 1.7, "#f9e1da");
        ellipse(ctx, petalX + 1, petalY - 1, 0.65, 0.65, "#d5987d");
      }
    }
  }

  function paintTree(ctx, tree, count) {
    const { day, size } = getGrowth(count);
    ctx.clearRect(0, 0, width, height);
    paintGround(ctx, tree);
    ctx.save();
    ctx.translate(133, soil);
    ctx.scale(size, size);
    if (day === 0) {
      ellipse(ctx, 0, -19, 40, 16, "#705137", -0.22);
      ellipse(ctx, -4, -23, 35, 12, "#a17c55", -0.22);
      ellipse(ctx, -9, -28, 24, 3, tree.accent, -0.22);
    } else {
      paintTrunk(ctx, 112 + day * 0.34, day, tree);
      for (const branch of tree.branches) paintCanopy(ctx, tree, branch, day);
    }
    ctx.restore();
  }

  function TreeArt({ tree, count, previewing }) {
    const canvas = useRef(null);
    const previous = useRef(null);
    useEffect(() => {
      const node = canvas.current;
      const ctx = node.getContext("2d");
      if (!ctx) return;
      const density = Math.min(window.devicePixelRatio || 1, 3);
      node.width = width * density;
      node.height = height * density;
      ctx.scale(density, density);
      const from = previous.current;
      previous.current = { tree, count, previewing };
      const grows = !previewing && from && !from.previewing && from.tree === tree
        && Math.min(from.count, finalDay) < Math.min(count, finalDay);
      if (!grows || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        paintTree(ctx, tree, count);
        return;
      }
      let pendingFrame;
      const start = performance.now();
      const frame = (now) => {
        const progress = Math.min(1, (now - start) / 760);
        const eased = 1 - Math.pow(1 - progress, 3);
        paintTree(ctx, tree, from.count + (count - from.count) * eased);
        if (progress < 1) pendingFrame = requestAnimationFrame(frame);
      };
      pendingFrame = requestAnimationFrame(frame);
      return () => cancelAnimationFrame(pendingFrame);
    }, [tree, count, previewing]);
    return h("canvas", { ref: canvas, className: "growth-art", width, height, "aria-hidden": "true" });
  }

  function storedTree(key) {
    try {
      return trees.find((tree) => tree.id === localStorage.getItem(key)) || trees[0];
    } catch {
      return trees[0];
    }
  }

  return function GrowthGarden({ totalDays, accountId }) {
    const storageKey = `quittr-growth-tree:${accountId || "local"}`;
    const [tree, setTree] = useState(() => storedTree(storageKey));
    const [preview, setPreview] = useState(null);
    const loaded = Number.isInteger(totalDays);
    const realDays = loaded ? totalDays : 0;
    const dayShown = preview ?? realDays;
    const { stage } = getGrowth(dayShown);
    const sliderDay = Math.max(1, Math.min(finalDay, dayShown));

    // A freshly recorded day takes precedence over any older preview.
    useEffect(() => setPreview(null), [realDays]);

    function chooseTree(next) {
      setTree(next);
      try { localStorage.setItem(storageKey, next.id); } catch { /* Choice still works for this visit. */ }
    }

    return h("section", { className: "growth-garden", "aria-label": "我的成长树", style: { "--growth-accent": tree.accent } },
      h("div", { className: "growth-stage" },
        h("div", { className: "growth-story" },
          h("h2", null, "我的成长树"),
          h("div", { className: "growth-counter", role: preview === null ? "status" : undefined },
            h("span", null, preview === null ? "累计打卡" : "生长预览"),
            h("strong", null, loaded || preview !== null ? dayShown : "–", h("small", null, " 天"))
          ),
          h("span", { className: "growth-phase" }, stage)
        ),
        h(TreeArt, { tree, count: dayShown, previewing: preview !== null })
      ),
      h("div", { className: "growth-controls" },
        h("div", { className: "growth-species", role: "group", "aria-label": "选择树种" },
          trees.map((option) => h("button", { key: option.id, type: "button", "aria-pressed": option === tree, onClick: () => chooseTree(option) },
            h("span", { style: { backgroundColor: option.accent }, "aria-hidden": "true" }), option.name
          ))
        ),
        h("div", { className: "growth-preview" },
          h("label", { htmlFor: "growth-preview-day" }, "预览生长"),
          h("input", { id: "growth-preview-day", type: "range", min: 1, max: finalDay, value: sliderDay,
            "aria-valuetext": `第 ${sliderDay} 天`, onChange: (event) => setPreview(event.currentTarget.valueAsNumber) }),
          preview === null ? h("span", null, "99 天")
            : h("button", { type: "button", onClick: () => setPreview(null) }, "回到今天")
        )
      )
    );
  };
})();
