export async function waitFor(
  condition: () => boolean, 
  timeout = 1000,
  interval = 10
): Promise<boolean> {
  const start = Date.now();
  while (!condition() && Date.now() - start < timeout) {
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return condition();
}

export async function waitForAsync(
  condition: () => Promise<boolean>, 
  timeout = 1000,
  interval = 10
): Promise<boolean> {
  const start = Date.now();
  while (!(await condition()) && Date.now() - start < timeout) {
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return condition();
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}