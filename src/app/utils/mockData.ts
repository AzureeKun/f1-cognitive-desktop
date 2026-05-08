export const generateSpeedData = () => {
  const data = [];
  for (let i = 0; i <= 200; i += 2) {
    // Oscillate between ~50 and ~250
    const base = 150 + Math.sin(i / 15) * 100;
    const noise = Math.random() * 10 - 5;
    data.push({ distance: i, speed: Math.max(0, base + noise) });
  }
  return data;
};

export const generateSteeringData = () => {
  const data = [];
  for (let i = 0; i <= 200; i += 2) {
    // Oscillate between -45 and 45
    const base = Math.sin(i / 8) * 40;
    const noise = Math.random() * 4 - 2;
    data.push({ distance: i, angle: base + noise });
  }
  return data;
};

export const generatePedalData = () => {
  const data = [];
  for (let i = 0; i <= 200; i += 2) {
    const throttleBase = Math.max(0, Math.sin(i / 20) * 100);
    const brakeBase = Math.max(0, -Math.sin(i / 20) * 100);
    data.push({ distance: i, throttle: throttleBase, brake: brakeBase });
  }
  return data;
};
