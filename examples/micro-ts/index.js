function sieveOfEratosthenes(n) {
  const primes = [];
  const isPrime = Array(n + 1).fill(true);
  isPrime[0] = isPrime[1] = false;

  for (let i = 2; i <= n; i++) {
    if (isPrime[i]) {
      primes.push(i);
      for (let j = i * i; j <= n; j += i) {
        isPrime[j] = false;
      }
    }
  }

  return primes;
}

module.exports = [
  {
    name: "sieveOfEratosthenes",
    fn: () => {
      sieveOfEratosthenes(10);
    },
  },
];
