#!/usr/bin/env node

const { performance } = require('node:perf_hooks');

const createRandomRect = (index, width, height) => {
  const top = (index * 37) % (height - 40) + 20;
  const left = (index * 53) % (width / 2 - 80) + 20;
  return {
    top,
    left,
    right: left + 60 + (index % 40),
    bottom: top + 30 + (index % 20),
    width: 60 + (index % 40),
    height: 30 + (index % 20),
    midY: top + (30 + (index % 20)) / 2,
  };
};

const buildConnectors = (count) => {
  const container = { left: 0, top: 0, width: 1200, height: 800 };
  const links = new Array(count).fill(null).map((_, idx) => ({
    id: `link-${idx}`,
    source: createRandomRect(idx * 3, container.width, container.height),
    target: createRandomRect(idx * 5 + 1, container.width, container.height),
  }));

  const paths = [];
  for (const link of links) {
    const startX = link.source.right;
    const endX = link.target.left + container.width / 2;
    const startY = link.source.midY;
    const endY = link.target.midY;
    const deltaX = Math.max(endX - startX, 1);
    const curvature = Math.max(deltaX * 0.35, 24);
    const path = `M ${startX} ${startY} C ${startX + curvature} ${startY}, ${endX - curvature} ${endY}, ${endX} ${endY}`;
    paths.push(path);
  }
  return paths;
};

const SAMPLE_SIZES = [100, 500, 1000, 2000];

console.log('--- Trace Connector Benchmark ---');
for (const size of SAMPLE_SIZES) {
  const start = performance.now();
  const paths = buildConnectors(size);
  const end = performance.now();
  console.log(`connectors=${size}\tpaths=${paths.length}\telapsed=${(end - start).toFixed(2)}ms`);
}
