export function compareBaseline(raw: number, rtk: number, utk: number): Record<string, number> {
  return {
    raw,
    rtk,
    utk,
    utkVsRtkDelta: rtk - utk
  };
}
