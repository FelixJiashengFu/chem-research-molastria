/* 能在浏览器里运行的 Python 练习（viewer/pyrun.js 运行），也是 tools/pyrun-test.mjs 用本机 python3 + numpy 核对的同一份源码。
   每项：packages 是 Pyodide 要先载入的包，name 是报错时显示的文件名，code 是程序本身；程序给全局变量 chart 赋值就会画图（格式见 pyrun.js）。
   h2：H₂ 的限制性 Hartree–Fock（STO-3G）。积分按 Szabo & Ostlund《Modern Quantum Chemistry》第 3 章和附录 A 的闭式公式；
       思路参照 psi4numpy（BSD-3-Clause，https://github.com/psi4/psi4numpy），代码是我们自己写的。
       R = 1.4 bohr 的总能量 −1.116714 hartree，和 PySCF 2.15（同样的 STO-3G）一致到 10⁻⁹；Szabo & Ostlund 给的是约 −1.1167。
   schrodinger：一维定态薛定谔方程的有限差分解。思路参照 qmsolve（BSD-3-Clause，https://github.com/quantum-visualizations/qmsolve），
       代码是我们自己写的；势能参数和量子物理展馆的演示 1（quantum/physics/qp-models.js）相同，可以互相核对。
   改了程序要跑 node --test tools/pyrun-test.mjs。 */
(function (root) {
  'use strict';
  const R = String.raw;

  const EXAMPLES = {
    h2: {
      name: 'h2_rhf.py',
      packages: ['numpy'],
      code: R`# Restricted Hartree-Fock for H2 in the STO-3G basis, from scratch with numpy.
# The integrals over 1s Gaussians are closed formulas (Szabo & Ostlund, Modern Quantum Chemistry, ch. 3 and app. A).
# Atomic units: lengths in bohr, energies in hartree.
import math
import numpy as np

R = 1.4           # bond length in bohr: change it and press Run again
MOLECULE = "H2"   # or "HeH+". In H2 symmetry fixes the orbitals, so the SCF is done after one step; HeH+ needs several.

# STO-3G hydrogen 1s: three Gaussians fitted to a Slater orbital with exponent zeta = 1.24 (Basis Set Exchange values).
# For another zeta the exponents scale as (zeta / 1.24)^2; Szabo & Ostlund use zeta = 2.0925 for He in HeH+.
ALPHA = [3.42525091, 0.62391373, 0.16885540]
COEF = [0.15432897, 0.53532814, 0.44463454]
ZETA = {"H": 1.24, "He": 2.0925}
CHARGE = {"H": 1.0, "He": 2.0}


def boys0(t):
    """Boys function F0(t): the integral of exp(-t u^2) for u from 0 to 1."""
    if t < 1e-10:
        return 1.0 - t / 3.0
    return 0.5 * math.sqrt(math.pi / t) * math.erf(math.sqrt(t))


def dist2(A, B):
    return sum((a - b) ** 2 for a, b in zip(A, B))


def primitives(symbol):
    """(exponent, coefficient x normalisation) for the three Gaussians of one STO-3G 1s function."""
    s = (ZETA[symbol] / 1.24) ** 2
    return [(a * s, c * (2 * a * s / math.pi) ** 0.75) for a, c in zip(ALPHA, COEF)]


def products(f, g):
    """Gaussian product theorem: two Gaussians on A and B make one Gaussian of exponent p = a + b on P."""
    (A, fa), (B, gb) = f, g
    out = []
    for a, ca in fa:
        for b, cb in gb:
            p = a + b
            P = [(a * x + b * y) / p for x, y in zip(A, B)]
            out.append((ca * cb, a * b / p, p, P, math.exp(-a * b / p * dist2(A, B)), dist2(A, B)))
    return out


def integrals(atoms):
    """Overlap S, kinetic energy T, nuclear attraction V and two-electron integrals (ij|kl), chemists' notation."""
    basis = [(xyz, primitives(symbol)) for symbol, xyz in atoms]
    n = len(basis)
    pairs = [[products(basis[i], basis[j]) for j in range(n)] for i in range(n)]
    S, T, V = np.zeros((n, n)), np.zeros((n, n)), np.zeros((n, n))
    for i in range(n):
        for j in range(n):
            for w, mu, p, P, K, AB2 in pairs[i][j]:
                s = w * K * (math.pi / p) ** 1.5
                S[i, j] += s
                T[i, j] += s * mu * (3 - 2 * mu * AB2)
                for symbol, C in atoms:
                    V[i, j] -= w * K * 2 * math.pi / p * CHARGE[symbol] * boys0(p * dist2(P, C))
    eri = np.zeros((n, n, n, n))
    for i in range(n):
        for j in range(n):
            for k in range(n):
                for l in range(n):
                    for w1, _, p, P, K1, _ in pairs[i][j]:
                        for w2, _, q, Q, K2, _ in pairs[k][l]:
                            eri[i, j, k, l] += (w1 * w2 * K1 * K2 * 2 * math.pi ** 2.5 / (p * q * math.sqrt(p + q))
                                                * boys0(p * q / (p + q) * dist2(P, Q)))
    return S, T, V, eri


def rhf(atoms, electrons=2, show=False):
    S, T, V, eri = integrals(atoms)
    H = T + V                                    # core Hamiltonian
    s, U = np.linalg.eigh(S)
    X = U @ np.diag(s ** -0.5) @ U.T             # symmetric orthogonalisation, X = S^(-1/2)
    occ = electrons // 2
    E_nuc = sum(CHARGE[a] * CHARGE[b] / math.sqrt(dist2(A, B))
                for i, (a, A) in enumerate(atoms) for b, B in atoms[i + 1:])

    def density(F):
        eps, C1 = np.linalg.eigh(X.T @ F @ X)    # solve F'C' = C'eps in the orthogonal basis
        C = X @ C1
        return 2 * C[:, :occ] @ C[:, :occ].T, eps

    P, eps = density(H)                          # first guess: leave out electron repulsion
    E_old = 0.0
    if show:
        print("iter   E(electronic)      E(total)          change")
    for it in range(1, 101):
        J = np.einsum("kl,ijkl->ij", P, eri)     # Coulomb
        K = np.einsum("kl,ikjl->ij", P, eri)     # exchange
        F = H + J - 0.5 * K                      # Fock matrix
        E_elec = 0.5 * np.sum(P * (H + F))
        if show:
            print(f"{it:3d}  {E_elec:15.10f}  {E_elec + E_nuc:15.10f}  {E_elec - E_old:10.2e}")
        P_new, eps = density(F)
        if abs(E_elec - E_old) < 1e-10 and np.max(np.abs(P_new - P)) < 1e-8:
            break
        P, E_old = P_new, E_elec
    return E_elec + E_nuc, E_elec, E_nuc, eps


def molecule(r):
    return [("He" if MOLECULE == "HeH+" else "H", (0.0, 0.0, 0.0)), ("H", (0.0, 0.0, r))]


E_total, E_elec, E_nuc, eps = rhf(molecule(R), show=True)
print()
print(f"{MOLECULE}, R = {R} bohr")
print("orbital energies:", np.round(eps, 4), "hartree")
print(f"electronic energy {E_elec:12.6f}")
print(f"nuclear repulsion {E_nuc:12.6f}")
print(f"total energy      {E_total:12.6f} hartree")
if MOLECULE == "H2":
    print("Szabo & Ostlund (ch. 3) at R = 1.4 bohr: about -1.1167 hartree")

# Scan the bond length for the chart
Rs = [round(0.5 + 0.1 * k, 2) for k in range(56)]
curve = [rhf(molecule(r))[0] for r in Rs]

# Equilibrium: fit a parabola through three points around the lowest one, move to its vertex, repeat closer in
r0 = Rs[int(np.argmin(curve))]
for h in (0.1, 0.02, 0.004):
    e_m, e_0, e_p = (rhf(molecule(r))[0] for r in (r0 - h, r0, r0 + h))
    r0 += h * (e_m - e_p) / (2 * (e_m - 2 * e_0 + e_p))
print(f"equilibrium: R = {r0:.3f} bohr ({r0 * 0.529177:.3f} angstrom), E = {rhf(molecule(r0))[0]:.6f} hartree")

# Far apart, H2 should become two H atoms and HeH+ should become He + H+
if MOLECULE == "H2":
    S1, T1, V1, _ = integrals([("H", (0.0, 0.0, 0.0))])
    limit, limit_name = 2 * (T1 + V1)[0, 0], "2 E(H)"
else:
    limit, limit_name = rhf([("He", (0.0, 0.0, 0.0))])[0], "E(He)"
print(f"{limit_name} = {limit:.6f} hartree; RHF at R = {Rs[-1]} gives {curve[-1]:.6f}")

chart = {
    "title": f"{MOLECULE}, RHF/STO-3G",
    "xlabel": "R / bohr",
    "ylabel": "E / hartree",
    "x": Rs,
    "series": [{"name": "E(R)", "y": curve}, {"name": limit_name, "y": [limit] * len(Rs), "dash": True}],
    "points": [{"x": R, "y": E_total, "label": f"R = {R}"}],
}
`,
    },

    schrodinger: {
      name: 'schrodinger_1d.py',
      packages: ['numpy'],
      code: R`# The 1D time-independent Schrodinger equation by finite differences, in units hbar = m = 1.
# H = -1/2 d^2/dx^2 + V(x) becomes a symmetric matrix on a grid; numpy.linalg.eigh gives its levels and states.
import numpy as np

POTENTIAL = "harmonic"   # change to "well", "double" or "morse"

L, N = 7.0, 700                      # grid from -L to L; psi = 0 at both ends (hard walls)
x = np.linspace(-L, L, N + 2)[1:-1]  # the N interior points
h = x[1] - x[0]

if POTENTIAL == "harmonic":          # 1/2 omega^2 x^2 with omega = 1
    V = 0.5 * x**2
elif POTENTIAL == "well":            # finite square well: width 2, depth 8
    V = np.where(np.abs(x) <= 1.0, 0.0, 8.0)
elif POTENTIAL == "double":          # double well 0.5 (x^2 - 1.6^2)^2: tunnelling splits the lowest pair
    V = 0.5 * (x**2 - 1.6**2) ** 2
elif POTENTIAL == "morse":           # Morse bond D (1 - exp(-a (x - x0)))^2
    D, a, x0 = 8.0, 0.7, -1.5
    V = D * (1 - np.exp(-a * (x - x0))) ** 2
else:
    raise ValueError("POTENTIAL must be harmonic, well, double or morse")

# Three-point second difference: psi'' at x[i] ~ (psi[i-1] - 2 psi[i] + psi[i+1]) / h^2
off = np.full(N - 1, -0.5 / h**2)
H = np.diag(1.0 / h**2 + V) + np.diag(off, 1) + np.diag(off, -1)

E, psi = np.linalg.eigh(H)           # eigenvalues in ascending order, eigenvectors in the columns
psi = psi / np.sqrt(h)               # normalise: sum |psi|^2 h = 1


def exact(n):
    """Closed-form levels where they exist."""
    if POTENTIAL == "harmonic":
        return n + 0.5                               # (n + 1/2) hbar omega
    if POTENTIAL == "morse":
        w = a * np.sqrt(2 * D)                       # harmonic frequency at the bottom of the well
        En = w * (n + 0.5) - (w * (n + 0.5)) ** 2 / (4 * D)
        return En if En < D else None                # bound levels only
    return None


print(f"{POTENTIAL}: {N} grid points, h = {h:.4f}")
print(" n    E (grid)     E (exact)     error")
for n in range(6):
    ex = exact(n)
    line = f"{n:2d}  {E[n]:10.6f}" + (f"  {ex:10.6f}  {E[n] - ex:10.2e}" if ex is not None else "")
    if POTENTIAL == "well" and E[n] > 8.0:
        line += "   above the well: a standing wave in the box"
    if POTENTIAL == "morse" and E[n] > 0.9 * D:
        line += "   near D the wall at x = L matters: try a larger L"
    print(line)
if POTENTIAL == "double":
    print(f"tunnelling splitting E1 - E0 = {E[1] - E[0]:.6f}")

# The chart: V(x) and the lowest four states, each drawn at the height of its energy
k = 4
for n in range(k):                   # sign convention: the first sizeable lobe from the left points up
    i = np.argmax(np.abs(psi[:, n]) > 0.2 * np.abs(psi[:, n]).max())
    psi[:, n] *= np.sign(psi[i, n])
scale = 0.45 * (E[1] - E[0]) / np.abs(psi[:, :k]).max()
top = E[k - 1] + 0.8 * (E[k - 1] - E[0]) / (k - 1)
chart = {
    "title": f"{POTENTIAL}: the lowest {k} states",
    "xlabel": "x",
    "ylabel": "energy",
    "x": x[::4],
    "series": [{"name": "V(x)", "y": np.minimum(V, 2 * top)[::4], "color": "ink"}]
    + [{"name": f"psi_{n}", "y": (E[n] + scale * psi[:, n])[::4]} for n in range(k)],
    "ylim": [min(V.min(), E[0] - 0.6 * (E[1] - E[0])), top],
}
`,
    },
  };

  if (typeof module === 'object' && module.exports) module.exports = EXAMPLES;
  else root.MOLASTRIA_PY_EXAMPLES = EXAMPLES;
})(typeof window !== 'undefined' ? window : globalThis);
