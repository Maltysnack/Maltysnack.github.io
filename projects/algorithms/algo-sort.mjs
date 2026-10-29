// Sorting as a recorded step list, so the viz can replay it at a fixed time per step.
// Steps: ['c', i, j] compare, ['s', i, j] swap, ['w', i, v] write.
const SORTS = {
  bubble(a, out) {
    for (let end = a.length - 1; end > 0; end--) {
      let swapped = false;
      for (let i = 0; i < end; i++) {
        out.push(['c', i, i + 1]);
        if (a[i] > a[i + 1]) { [a[i], a[i + 1]] = [a[i + 1], a[i]]; out.push(['s', i, i + 1]); swapped = true; }
      }
      if (!swapped) return;
    }
  },
  insertion(a, out) {
    for (let i = 1; i < a.length; i++) {
      for (let j = i; j > 0; j--) {
        out.push(['c', j - 1, j]);
        if (a[j - 1] <= a[j]) break;
        [a[j - 1], a[j]] = [a[j], a[j - 1]]; out.push(['s', j - 1, j]);
      }
    }
  },
  quick(a, out) {
    const go = (lo, hi) => {
      if (lo >= hi) return;
      const p = a[hi]; let m = lo;
      for (let i = lo; i < hi; i++) {
        out.push(['c', i, hi]);
        if (a[i] < p) { if (i !== m) { [a[i], a[m]] = [a[m], a[i]]; out.push(['s', i, m]); } m++; }
      }
      if (m !== hi) { [a[m], a[hi]] = [a[hi], a[m]]; out.push(['s', m, hi]); }
      go(lo, m - 1); go(m + 1, hi);
    };
    go(0, a.length - 1);
  },
  merge(a, out) {
    const go = (lo, hi) => {
      if (lo >= hi) return;
      const mid = (lo + hi) >> 1; go(lo, mid); go(mid + 1, hi);
      const aux = a.slice(lo, hi + 1);
      let i = lo, j = mid + 1;
      for (let k = lo; k <= hi; k++) {
        let v;
        if (i > mid) v = aux[j++ - lo];
        else if (j > hi) v = aux[i++ - lo];
        else { out.push(['c', i, j]); v = aux[j - lo] < aux[i - lo] ? aux[j++ - lo] : aux[i++ - lo]; }
        a[k] = v; out.push(['w', k, v]);
      }
    };
    go(0, a.length - 1);
  },
};

export function sortSteps(name, values) {
  const out = [];
  SORTS[name](values.slice(), out);
  return out;
}
