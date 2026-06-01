export async function mapConcurrent<T, U>(
  items: readonly T[],
  limit: number,
  run: (item: T, index: number) => Promise<U>
): Promise<U[]> {
  const results = new Array<U>(items.length);
  let next = 0;
  const workerCount = Math.min(Math.max(1, Math.floor(limit)), items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await run(items[index]!, index);
    }
  }));

  return results;
}
