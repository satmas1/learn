// Standard Bayesian Knowledge Tracing update
// params: { pL0, pT, pG, pS }
//   pL0: prior probability of mastery
//   pT : probability of transitioning from not-known -> known between attempts
//   pG : guess probability
//   pS : slip probability
// state: current p(L) (posterior from previous step)
// correct: boolean
// returns updated p(L) after Observation + Transit steps
export function bktUpdate(pL, correct, params) {
  const { pT = 0.15, pG = 0.2, pS = 0.1 } = params || {};
  let pLGivenObs;
  if (correct) {
    const num = pL * (1 - pS);
    const den = pL * (1 - pS) + (1 - pL) * pG;
    pLGivenObs = den === 0 ? pL : num / den;
  } else {
    const num = pL * pS;
    const den = pL * pS + (1 - pL) * (1 - pG);
    pLGivenObs = den === 0 ? pL : num / den;
  }
  const pLNext = pLGivenObs + (1 - pLGivenObs) * pT;
  return Math.min(0.9999, Math.max(0.0001, pLNext));
}

export const DEFAULT_MASTERY_THRESHOLD = 0.95;
