/**
 * A function to calculate the value of pi using the Monte Carlo method.
 */
export function piWithMonteCarlo(trials: number) {
  let inside = 0;
  for (let i = 0; i < trials; i++) {
    const x = Math.random();
    const y = Math.random();
    if (x * x + y * y < 1) {
      inside++;
    }
  }
  return (inside / trials) * 4;
}
