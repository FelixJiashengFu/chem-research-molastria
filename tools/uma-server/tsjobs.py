"""Transition states and reaction paths for the MolAstria online models, written once against an ASE calculator.

Two jobs, both on every model that has energies and forces (fairchem, ANI-2x, MACE, xTB, AIMNet2):
  ts   a guess of the transition state (XYZ) -> Sella saddle-point search (order 1, internal coordinates) -> harmonic
       frequencies by central differences of the same model's forces (chemjobs.vibrations) -> IRC both ways with
       Sella's IRC, each end relaxed to its minimum with LBFGS.
  neb  reactant and product (XYZ, same atoms in the same order) -> both relaxed -> IDPP interpolation -> NEB, then
       climbing-image NEB (ASE's NEB with FIRE) -> the highest image refined with Sella -> frequencies -> IRC.

Sella (zadorlab/sella, LGPL-3.0) is imported as an unmodified library (pip install sella) and called at run time;
none of its code is copied here (THIRD-PARTY-sella.md). geomeTRIC is not used.

Units as in chemjobs.py: eV, Angstrom, cm^-1 (imaginary frequencies negative), kcal/mol where the name says _kcal.
The reaction coordinate s of the profile is the mass-weighted path length in sqrt(amu)*Angstrom, 0 at the TS,
negative on the reverse side.
"""
import numpy as np

import chemjobs as cj

MAX_ATOMS = 50  # a Hessian takes 6N force calls, an IRC two more per step; 50 atoms keep a job within its limit
TS_FMAX = 0.01  # eV/Angstrom, the saddle point
TS_STEPS = 300  # Sella steps
IRC_STEPS = 60  # default steps per direction (dx = 0.1 sqrt(amu)*Angstrom each)
IRC_STEPS_MAX = 200
IRC_DX = 0.1
IRC_FMAX = 0.05
END_FMAX = cj.OPT_FMAX  # each end of the IRC relaxed to its minimum
END_STEPS = 300
NEB_IMAGES = 7  # interior images; the default
NEB_IMAGES_MIN = 3
NEB_IMAGES_MAX = 11
NEB_FMAX, CINEB_FMAX, NEB_STEPS = 0.1, 0.05, 200
IMAG_CUTOFF = 50.0  # cm^-1: imaginary modes smaller than this are numerical noise of the Hessian
MAX_FRAMES = 30  # frames kept per IRC direction in the path XYZ


def sella_version():
    try:
        from importlib.metadata import version

        return version("sella")
    except Exception:  # noqa: BLE001 - not installed: the TS jobs are off
        return ""


def _saddle(atoms, budget, fmax=TS_FMAX, steps=TS_STEPS):
    """Sella first-order saddle point search in internal coordinates -> (energy, steps, converged)."""
    from sella import Sella

    opt = Sella(atoms, order=1, internal=True, logfile=None)
    opt.attach(budget.check)
    converged = bool(opt.run(fmax=fmax, steps=steps))
    return float(atoms.get_potential_energy()), int(opt.nsteps), converged


def _mw_length(frames, masses):
    """Mass-weighted distances between consecutive frames, sqrt(amu)*Angstrom."""
    w = np.sqrt(np.asarray(masses))[:, None]
    return [float(np.linalg.norm((b - a) * w)) for a, b in zip(frames, frames[1:])]


def _irc_side(ts_symbols, ts_positions, charge, spin, calc, budget, direction, steps):
    """One direction of the IRC from the TS, then that end relaxed to its minimum. Returns positions along the way
    (TS first), their energies, the IRC steps, whether the IRC converged, and the relaxed end."""
    from sella import IRC

    atoms = cj.new_atoms(ts_symbols, ts_positions, charge, spin, calc)
    frames, energies = [atoms.get_positions().copy()], [float(atoms.get_potential_energy())]

    def keep():
        frames.append(atoms.get_positions().copy())
        energies.append(float(atoms.get_potential_energy()))
        budget.check()

    irc = IRC(atoms, logfile=None, dx=IRC_DX, keep_going=True)
    irc.attach(keep)
    converged, note = False, ""
    try:
        converged = bool(irc.run(fmax=IRC_FMAX, steps=int(steps), direction=direction))
    except cj.JobTimeout:
        raise
    except Exception as e:  # noqa: BLE001 - Sella gives up on a hard step: relax from where it got to
        note = f"{type(e).__name__}"
    irc_steps = int(irc.nsteps)
    if np.linalg.norm(atoms.get_positions() - frames[-1]) > 1e-8:
        keep()
    e_end, end_steps, end_ok = cj.relax(atoms, budget, END_FMAX, END_STEPS)
    if np.linalg.norm(atoms.get_positions() - frames[-1]) > 1e-6:
        frames.append(atoms.get_positions().copy())
        energies.append(e_end)
    return {"frames": frames, "energies": energies, "steps": irc_steps, "converged": converged, "note": note,
            "end_energy": e_end, "end_steps": end_steps, "end_converged": bool(end_ok),
            "end_fmax": cj.max_force(atoms)}


def _thin(k, keep):
    """Indices 0..k-1 thinned to at most keep, always with the first and the last."""
    if k <= keep:
        return list(range(k))
    return sorted(set(np.linspace(0, k - 1, keep).round().astype(int).tolist()))


def ts_analysis(symbols, positions, charge, spin, calc, budget, label, irc=True, irc_steps=IRC_STEPS):
    """From a converged saddle point: frequencies, the imaginary mode, the IRC both ways, the energy profile and a
    multi-frame XYZ of the whole path (reverse end -> TS -> forward end)."""
    atoms = cj.new_atoms(symbols, positions, charge, spin, calc)
    e_ts = float(atoms.get_potential_energy())
    vib = cj.vibrations(atoms, budget)
    cm1 = [round(float(x), 2) for x in vib["cm1"]]
    big = [x for x in cm1 if x < -IMAG_CUTOFF]
    out = {"ts_energy_ev": cj._r(e_ts), "frequencies_cm1": cm1, "n_imag": sum(1 for x in cm1 if x < 0),
           "n_imag_significant": len(big), "imag_cm1": cm1[0] if cm1 and cm1[0] < 0 else None,
           "is_first_order_saddle": len(big) == 1, "ts_xyz": cj.xyz_text(symbols, positions, f"{label} TS E = {e_ts:.6f} eV")}
    if cm1:  # the lowest mode (the reaction coordinate at a TS), as displacements per atom, largest 1 Angstrom
        mode = vib["modes"][:, 0].reshape(-1, 3)
        mode = mode / max(1e-12, float(np.linalg.norm(mode, axis=1).max()))
        out["imag_mode"] = [[cj._r(x, 4) for x in row] for row in mode]
    if not irc:
        return out
    masses = atoms.get_masses()
    sides = {}
    for n, direction in enumerate(("forward", "reverse")):
        sides[direction] = _irc_side(symbols, positions, charge, spin, calc, budget, direction, irc_steps)
        budget.progress(n + 1, 2, "IRC directions")
    profile, frames_out = [], []
    for direction, sign in (("reverse", -1), ("forward", 1)):
        side = sides[direction]
        s = np.concatenate([[0.0], np.cumsum(_mw_length(side["frames"], masses))]) * sign
        pts = [{"s": cj._r(x, 4), "energy_ev": cj._r(e), "rel_kcal": round((e - e_ts) * cj.EV_TO_KCAL, 3)}
               for x, e in zip(s, side["energies"])]
        idx = _thin(len(pts), MAX_FRAMES)
        if direction == "reverse":
            profile += pts[::-1]
            frames_out += [(side["frames"][i], pts[i]) for i in idx[::-1]]
        else:
            profile += pts[1:]  # the TS once
            frames_out += [(side["frames"][i], pts[i]) for i in idx if i]
    xyz = "".join(cj.xyz_text(symbols, p, f"{label} s = {pt['s']:.3f} E = {pt['energy_ev']:.6f} eV") for p, pt in frames_out)
    ends = {}
    for direction in ("forward", "reverse"):
        side = sides[direction]
        ends[direction] = {"irc_steps": side["steps"], "irc_converged": side["converged"], "irc_note": side["note"],
                           "energy_ev": cj._r(side["end_energy"]), "relax_steps": side["end_steps"],
                           "relax_converged": side["end_converged"], "fmax_ev_a": cj._r(side["end_fmax"]),
                           "barrier_kcal": round((e_ts - side["end_energy"]) * cj.EV_TO_KCAL, 3),
                           "xyz": cj.xyz_text(symbols, side["frames"][-1], f"{label} IRC {direction} end E = {side['end_energy']:.6f} eV")}
    out.update(irc=ends, profile=profile, path_xyz=xyz, n_path_frames=len(frames_out),
               reaction_energy_kcal=round((sides["forward"]["end_energy"] - sides["reverse"]["end_energy"]) * cj.EV_TO_KCAL, 3))
    return out


def run_ts(st, calc, budget, label, fmax=TS_FMAX, irc=True, irc_steps=IRC_STEPS):
    """TS guess -> Sella saddle point -> frequencies -> IRC."""
    atoms = cj.new_atoms(st.symbols, st.positions, st.charge, st.spin, calc)
    e, steps, converged = _saddle(atoms, budget, fmax)
    out = {"ts_steps": steps, "ts_converged": converged, "ts_fmax_ev_a": cj._r(cj.max_force(atoms)),
           "method": "Sella saddle point (order 1, internal coordinates); IRC: Sella"}
    out.update(ts_analysis(st.symbols, atoms.get_positions(), st.charge, st.spin, calc, budget, label, irc, irc_steps))
    out["xyz"] = out["ts_xyz"]
    return out


def same_atoms(symbols_a, symbols_b):
    return list(symbols_a) == list(symbols_b)


def run_neb(st, product_positions, make_calc, budget, label, images=NEB_IMAGES, fmax=TS_FMAX, irc=True,
            irc_steps=IRC_STEPS):
    """Reactant (st) and product (same atoms, same order) -> relaxed ends -> IDPP -> NEB -> CI-NEB -> Sella -> TS
    analysis. make_calc() gives a fresh calculator: every NEB image needs its own."""
    from ase.build import minimize_rotation_and_translation
    from ase.optimize import FIRE

    try:
        from ase.mep import NEB
    except ImportError:  # ASE before 3.23
        from ase.neb import NEB

    calc = make_calc()
    ends = []
    for pos in (st.positions, product_positions):
        a = cj.new_atoms(st.symbols, pos, st.charge, st.spin, make_calc())
        e, steps, ok = cj.relax(a, budget, END_FMAX, END_STEPS)
        ends.append((a, e, steps, ok))
    react, prod = ends[0][0], ends[1][0]
    minimize_rotation_and_translation(react, prod)  # the product turned onto the reactant before interpolating
    path = [react] + [cj.new_atoms(st.symbols, react.get_positions(), st.charge, st.spin, make_calc()) for _ in range(images)] + [prod]
    neb = NEB(path, climb=False, k=0.5, method="improvedtangent", remove_rotation_and_translation=True)
    neb.interpolate("idpp")
    opt = FIRE(neb, logfile=None)
    opt.attach(budget.check)
    neb_ok = bool(opt.run(fmax=NEB_FMAX, steps=NEB_STEPS))
    neb_steps = int(opt.nsteps)
    budget.progress(1, 3, "NEB stages")
    neb.climb = True
    opt = FIRE(neb, logfile=None)
    opt.attach(budget.check)
    ci_ok = bool(opt.run(fmax=CINEB_FMAX, steps=NEB_STEPS))
    ci_steps = int(opt.nsteps)
    budget.progress(2, 3, "NEB stages")
    e_band = [float(a.get_potential_energy()) for a in path]
    top = int(np.argmax(e_band[1:-1])) + 1
    band_xyz = "".join(cj.xyz_text(st.symbols, a.get_positions(), f"{label} NEB image {k} E = {e:.6f} eV")
                       for k, (a, e) in enumerate(zip(path, e_band)))
    ts = cj.new_atoms(st.symbols, path[top].get_positions(), st.charge, st.spin, calc)
    e, steps, converged = _saddle(ts, budget, fmax)
    budget.progress(3, 3, "NEB stages")
    e_r = ends[0][1]
    out = {"method": "IDPP -> NEB -> climbing-image NEB (ASE, FIRE) -> Sella saddle point; IRC: Sella",
           "neb": {"images": images, "neb_steps": neb_steps, "neb_converged": neb_ok, "ci_steps": ci_steps,
                   "ci_converged": ci_ok, "highest_image": top,
                   "energies_rel_kcal": [round((x - e_r) * cj.EV_TO_KCAL, 3) for x in e_band],
                   "reactant_energy_ev": cj._r(e_r), "product_energy_ev": cj._r(ends[1][1]),
                   "reactant_relaxed": bool(ends[0][3]), "product_relaxed": bool(ends[1][3]), "band_xyz": band_xyz},
           "ts_steps": steps, "ts_converged": converged, "ts_fmax_ev_a": cj._r(cj.max_force(ts))}
    out.update(ts_analysis(st.symbols, ts.get_positions(), st.charge, st.spin, calc, budget, label, irc, irc_steps))
    out["xyz"] = out["ts_xyz"]
    return out
