/* 编程语言教学区（/programming/）：计算物理与化学要用的编程语言。由 pl.js 画出来；内容中英两版，标 translate="no"。
   每种语言有一段代码：大多是同一道题（三个原子的 Lennard-Jones 势能，答案 E = -3.000000）。
   tested: true 的代码 2026-11-10 在本机用对应的编译器或解释器跑过（tools/programming-test.mjs 会重新跑一遍：本机装了的就跑，没装的跳过）；
   tested: false 的（Julia、CUDA、Wolfram 语言）没有机器可跑，页面上如实标出“未在本机运行”。
   改了代码请跑 node --test tools/programming-test.mjs。 */
window.MOLASTRIA_PL = {
 "checked": "2026-11-10",
 "task": {
  "zh": "同一道题：三个氩原子放在等边三角形的顶点上，边长取 Lennard-Jones 势的极小点 2^(1/6)σ，用约化单位（ε = σ = 1）求总势能。每一对原子都在势阱底部，所以答案是 −3ε。每种语言都打印 E = -3.000000。",
  "en": "One task for every language: three argon atoms on the corners of an equilateral triangle whose side is the Lennard-Jones minimum 2^(1/6)σ, in reduced units (ε = σ = 1). Every pair sits at the bottom of the well, so the total is −3ε. Each program prints E = -3.000000."
 },
 "tiers": {
  "core": {
   "zh": "核心语言",
   "en": "Core languages",
   "hint": {
    "zh": "写计算程序本身",
    "en": "for the computing codes themselves"
   }
  },
  "parallel": {
   "zh": "并行与 GPU",
   "en": "Parallel and GPU",
   "hint": {
    "zh": "让程序用上整台机器和集群",
    "en": "use a whole machine or cluster"
   }
  },
  "math": {
   "zh": "数值与符号环境",
   "en": "Numerical and symbolic",
   "hint": {
    "zh": "推公式、做矩阵、教学",
    "en": "derivations, matrices, teaching"
   }
  },
  "data": {
   "zh": "数据与统计",
   "en": "Data and statistics",
   "hint": {
    "zh": "查数据库、做统计",
    "en": "databases and statistics"
   }
  },
  "glue": {
   "zh": "脚本与工作流",
   "en": "Scripting and workflows",
   "hint": {
    "zh": "把程序串起来",
    "en": "gluing programs together"
   }
  },
  "more": {
   "zh": "其他语言",
   "en": "Other languages",
   "hint": {
    "zh": "特定场合会遇到",
    "en": "met in particular places"
   }
  },
  "quantum": {
   "zh": "量子编程",
   "en": "Quantum programming",
   "hint": {
    "zh": "给量子计算机写线路",
    "en": "circuits for quantum computers"
   }
  }
 },
 "paths": [
  {
   "zh": "量子化学方法开发",
   "en": "Developing quantum chemistry methods",
   "langs": [
    "python",
    "cpp",
    "fortran",
    "symbolic"
   ],
   "note": {
    "zh": "先用 PySCF 在 Python 里试新方法，再把慢的部分写进 C++ 或 Fortran；推导交给 SymPy。",
    "en": "Prototype in Python with PySCF, move hot spots to C++ or Fortran, and let SymPy check the derivations."
   }
  },
  {
   "zh": "固体与材料的 DFT",
   "en": "DFT for solids and materials",
   "langs": [
    "bash",
    "python",
    "fortran",
    "mpi"
   ],
   "note": {
    "zh": "大部分时间在集群上跑 VASP、Quantum ESPRESSO 一类 Fortran 程序：Shell 交作业，Python（ASE、pymatgen）做前后处理。",
    "en": "Most time goes into running Fortran codes such as VASP or Quantum ESPRESSO on clusters: the shell submits jobs, Python (ASE, pymatgen) prepares and analyses."
   }
  },
  {
   "zh": "分子动力学与生物分子模拟",
   "en": "Molecular dynamics and biomolecules",
   "langs": [
    "python",
    "cpp",
    "cuda",
    "tcl"
   ],
   "note": {
    "zh": "GROMACS、OpenMM、LAMMPS 是 C++ 加 GPU；分析用 Python（MDAnalysis），看结构和出图用 VMD 的 Tcl 脚本。",
    "en": "GROMACS, OpenMM and LAMMPS are C++ with GPUs; analyse with Python (MDAnalysis) and script VMD in Tcl for structures and figures."
   }
  },
  {
   "zh": "化学信息学与药物发现",
   "en": "Cheminformatics and drug discovery",
   "langs": [
    "python",
    "sql",
    "java"
   ],
   "note": {
    "zh": "RDKit（Python）是主力，大库放进数据库用 SQL 查，CDK、KNIME 这类 Java 工具也会遇到。",
    "en": "RDKit in Python does most of it; big libraries live in databases queried with SQL, and Java tools such as CDK and KNIME turn up too."
   }
  },
  {
   "zh": "机器学习势与 AI for Science",
   "en": "ML potentials and AI for Science",
   "langs": [
    "python",
    "cuda",
    "julia"
   ],
   "note": {
    "zh": "PyTorch / JAX（Python）加 GPU；想要一种语言兼顾速度和可读性，可以看看 Julia。",
    "en": "PyTorch / JAX in Python plus GPUs; if you want one language for speed and readability, look at Julia."
   }
  },
  {
   "zh": "实验数据、光谱与化学计量学",
   "en": "Experimental data, spectra and chemometrics",
   "langs": [
    "python",
    "r",
    "matlab"
   ],
   "note": {
    "zh": "Python 或 R 做统计和画图，课程和老的工具箱里常是 MATLAB。",
    "en": "Python or R for statistics and plots; courses and older toolboxes often use MATLAB."
   }
  },
  {
   "zh": "量子计算与量子化学算法",
   "en": "Quantum computing and quantum chemistry algorithms",
   "langs": [
    "python",
    "qasm",
    "symbolic"
   ],
   "note": {
    "zh": "Qiskit 等 Python 框架搭线路，OpenQASM 交给设备，符号计算帮你推哈密顿量。",
    "en": "Build circuits in Python frameworks such as Qiskit, hand OpenQASM to devices, and derive Hamiltonians symbolically."
   }
  }
 ],
 "stages": [
  {
   "zh": "第 0 步 · 命令行与 Git",
   "en": "Step 0 · Command line and Git",
   "langs": [
    "bash"
   ],
   "note": {
    "zh": "在 Linux 上自如地移动、看文件、提交作业；用 Git 管理每一次改动。",
    "en": "Move around Linux, inspect files and submit jobs; track every change with Git."
   },
   "link": [
    "Pro Git 中文版",
    "Pro Git",
    "https://git-scm.com/book/zh/v2",
    "https://git-scm.com/book/en/v2"
   ]
  },
  {
   "zh": "第 1 步 · Python 与 NumPy",
   "en": "Step 1 · Python and NumPy",
   "langs": [
    "python"
   ],
   "note": {
    "zh": "能读写文件、画图、用数组思考；能用 ASE 或 PySCF 算一个分子。",
    "en": "Read and write files, plot, think in arrays; compute a molecule with ASE or PySCF."
   }
  },
  {
   "zh": "第 2 步 · 一门编译型语言",
   "en": "Step 2 · One compiled language",
   "langs": [
    "fortran",
    "cpp",
    "julia"
   ],
   "note": {
    "zh": "看你的领域：材料和老程序选 Fortran，分子动力学和新程序选 C++，想一门到底可以试 Julia。",
    "en": "Depends on your field: Fortran for materials and existing codes, C++ for MD and new codes, Julia if you want one language for everything."
   }
  },
  {
   "zh": "第 3 步 · 并行",
   "en": "Step 3 · Parallelism",
   "langs": [
    "openmp",
    "mpi"
   ],
   "note": {
    "zh": "先 OpenMP 用满一台机器，再 MPI 跨节点；学会测加速比。",
    "en": "OpenMP to fill one machine, then MPI across nodes; learn to measure speed-up."
   }
  },
  {
   "zh": "第 4 步 · GPU",
   "en": "Step 4 · GPUs",
   "langs": [
    "cuda"
   ],
   "note": {
    "zh": "先用 CuPy、JAX 这类库，确实需要时再写内核。",
    "en": "Start with libraries such as CuPy or JAX; write kernels only when you must."
   }
  }
 ],
 "exercises": [
  {
   "zh": "把三个原子换成 N 个随机放置的原子（N = 100、1000），量一下每种语言用了多少时间。",
   "en": "Replace the three atoms with N random atoms (N = 100, 1000) and time each language."
  },
  {
   "zh": "在同一个循环里算每个原子受的力（能量对坐标求导的负值），检查所有力加起来是零。",
   "en": "Compute the force on each atom (minus the energy gradient) in the same loop, and check that the forces sum to zero."
  },
  {
   "zh": "加上周期性边界条件和截断半径，然后用速度 Verlet 积分跑 1000 步，看总能量是否守恒。",
   "en": "Add periodic boundaries and a cut-off, then run 1000 velocity-Verlet steps and check that total energy is conserved."
  },
  {
   "zh": "把 OpenMP 版本的线程数从 1 加到 8，画出加速比；再用 MPI 版本在两台机器上试。",
   "en": "Raise the OpenMP thread count from 1 to 8 and plot the speed-up; then try the MPI version on two machines."
  }
 ],
 "langs": [
  {
   "id": "python",
   "name": "Python",
   "tier": "core",
   "year": 1991,
   "glyph": "py",
   "role": {
    "zh": "计算化学和计算物理今天的“通用语”：写分析脚本、调用程序、搭工作流，也直接做计算（NumPy、SciPy、PySCF）。大多数新工具先给 Python 接口。",
    "en": "Today's lingua franca of computational chemistry and physics: analysis scripts, driving programs, workflows, and real computation (NumPy, SciPy, PySCF). Most new tools ship a Python interface first."
   },
   "used": [
    "PySCF",
    {
     "zh": "Psi4（Python 前端）",
     "en": "Psi4 (Python front end)"
    },
    "ASE",
    "pymatgen",
    "RDKit",
    "MDAnalysis",
    "OpenMM",
    "Qiskit"
   ],
   "good": {
    "zh": "上手快、库最多、交互式（Jupyter）；NumPy 把循环交给编译好的代码，速度够大多数分析用。",
    "en": "Quick to learn, the largest set of libraries, interactive (Jupyter); NumPy hands loops to compiled code, fast enough for most analysis."
   },
   "watch": {
    "zh": "纯 Python 循环慢，要向量化或交给 Numba、C++、Fortran；环境要用 conda 或 venv 管好版本。",
    "en": "Plain Python loops are slow: vectorise, or hand them to Numba, C++ or Fortran; manage environments with conda or venv."
   },
   "start": {
    "zh": [
     "装 Miniforge（conda），新建一个环境",
     "学列表、函数、文件读写，然后学 NumPy 数组和广播",
     "用 ASE 或 PySCF 算一个小分子，再画一张图"
    ],
    "en": [
     "Install Miniforge (conda) and make an environment",
     "Learn lists, functions and files, then NumPy arrays and broadcasting",
     "Compute a small molecule with ASE or PySCF and plot something"
    ]
   },
   "links": [
    [
     "官方教程",
     "Official tutorial",
     "https://docs.python.org/3/tutorial/"
    ],
    [
     "NumPy 学习",
     "Learn NumPy",
     "https://numpy.org/learn/"
    ],
    [
     "Software Carpentry：Python",
     "Software Carpentry: Python",
     "https://swcarpentry.github.io/python-novice-inflammation/"
    ]
   ],
   "snippets": [
    {
     "file": "lj.py",
     "lang": null,
     "title": {
      "zh": "Python",
      "en": "Python"
     },
     "run": "python3 lj.py",
     "tested": true,
     "code": "# Lennard-Jones energy of three atoms (reduced units: epsilon = sigma = 1)\nimport math\n\nr = 2 ** (1 / 6)                       # distance of the LJ minimum\natoms = [(0.0, 0.0, 0.0), (r, 0.0, 0.0), (r / 2, r * math.sqrt(3) / 2, 0.0)]\n\ndef lj(d):\n    s6 = (1 / d) ** 6\n    return 4 * (s6 * s6 - s6)\n\nenergy = 0.0\nfor i in range(len(atoms)):\n    for j in range(i + 1, len(atoms)):\n        energy += lj(math.dist(atoms[i], atoms[j]))\n\nprint(f\"E = {energy:.6f}\")             # expected -3.000000"
    },
    {
     "file": "lj_numpy.py",
     "lang": null,
     "title": {
      "zh": "Python + NumPy",
      "en": "Python + NumPy"
     },
     "run": "python3 lj_numpy.py",
     "tested": true,
     "code": "# Same energy with NumPy: every pair at once, no Python loop\nimport numpy as np\n\nr = 2 ** (1 / 6)\nx = np.array([[0, 0, 0], [r, 0, 0], [r / 2, r * np.sqrt(3) / 2, 0]])\n\nd = np.linalg.norm(x[:, None, :] - x[None, :, :], axis=-1)   # distance matrix\ni, j = np.triu_indices(len(x), k=1)                            # each pair once\ns6 = d[i, j] ** -6\nprint(f\"E = {np.sum(4 * (s6**2 - s6)):.6f}\")"
    }
   ],
   "runnable": true
  },
  {
   "id": "fortran",
   "name": "Fortran",
   "tier": "core",
   "year": 1957,
   "glyph": "f90",
   "role": {
    "zh": "最早的高级语言，至今仍是平面波 DFT 和量子化学大程序的主力。现代 Fortran（2008/2018）有数组运算、模块和并行的 coarray。",
    "en": "The first high-level language and still the workhorse of plane-wave DFT and big quantum chemistry codes. Modern Fortran (2008/2018) has whole-array operations, modules and coarrays."
   },
   "used": [
    "VASP",
    "Quantum ESPRESSO",
    "CP2K",
    "GAMESS (US)",
    "Gaussian",
    "NWChem"
   ],
   "good": {
    "zh": "数组和数值运算写起来直接，编译器优化成熟，和 BLAS / LAPACK 天生配合；读懂老程序必备。",
    "en": "Arrays and numerics read naturally, compilers optimise well, and it pairs with BLAS / LAPACK by design; essential for reading existing codes."
   },
   "watch": {
    "zh": "老代码多是 FORTRAN 77 的固定格式和 COMMON 块，新代码请用 implicit none、模块和 kind 参数；生态里的通用库少。",
    "en": "Old code is often fixed-form FORTRAN 77 with COMMON blocks; new code should use implicit none, modules and kind parameters. Few general-purpose libraries."
   },
   "start": {
    "zh": [
     "装 gfortran（或 Intel ifx），编译运行右边的程序",
     "学模块、数组切片、intent 和 kind",
     "用 fpm（Fortran 包管理器）建一个小项目，再调用 LAPACK"
    ],
    "en": [
     "Install gfortran (or Intel ifx) and run the program on the right",
     "Learn modules, array slices, intent and kind",
     "Start a small project with fpm (the Fortran package manager), then call LAPACK"
    ]
   },
   "links": [
    [
     "fortran-lang 教程",
     "fortran-lang tutorials",
     "https://fortran-lang.org/learn/"
    ]
   ],
   "snippets": [
    {
     "file": "lj.f90",
     "lang": null,
     "title": null,
     "run": "gfortran -O2 lj.f90 -o lj && ./lj",
     "tested": true,
     "code": "! Lennard-Jones energy of three atoms (reduced units)\nprogram lj\n  implicit none\n  integer, parameter :: dp = kind(1.0d0)\n  real(dp) :: x(3, 3), r, d, s6, energy\n  integer :: i, j\n\n  r = 2.0_dp**(1.0_dp/6.0_dp)\n  x(:, 1) = [0.0_dp, 0.0_dp, 0.0_dp]\n  x(:, 2) = [r, 0.0_dp, 0.0_dp]\n  x(:, 3) = [r/2, r*sqrt(3.0_dp)/2, 0.0_dp]\n\n  energy = 0.0_dp\n  do i = 1, 3\n    do j = i + 1, 3\n      d = norm2(x(:, i) - x(:, j))\n      s6 = (1.0_dp/d)**6\n      energy = energy + 4.0_dp*(s6*s6 - s6)\n    end do\n  end do\n  print '(a, f0.6)', 'E = ', energy\nend program lj"
    }
   ]
  },
  {
   "id": "cpp",
   "name": "C++",
   "tier": "core",
   "year": 1985,
   "glyph": "c++",
   "role": {
    "zh": "性能和抽象兼得，是分子动力学引擎、新一代量子化学程序和积分库的首选；常配一层 Python 接口给用户。",
    "en": "Performance with abstraction: the usual choice for MD engines, newer quantum chemistry programs and integral libraries, often wrapped in Python for users."
   },
   "used": [
    "ORCA",
    {
     "zh": "Psi4（核心）",
     "en": "Psi4 (core)"
    },
    "LAMMPS",
    "GROMACS",
    "OpenMM",
    "libint",
    "Eigen"
   ],
   "good": {
    "zh": "模板和类让大程序好组织；标准库、Eigen、Kokkos 这样的库成熟；能直接写 GPU（CUDA、SYCL）。",
    "en": "Templates and classes organise big programs; mature libraries such as the standard library, Eigen and Kokkos; GPU code (CUDA, SYCL) in the same language."
   },
   "watch": {
    "zh": "语言庞大、坑多（内存、未定义行为）；先学现代 C++（C++17 起），用 CMake 构建，打开编译器警告和 sanitizer。",
    "en": "Large and full of traps (memory, undefined behaviour); learn modern C++ (C++17 on), build with CMake, and turn on warnings and sanitizers."
   },
   "start": {
    "zh": [
     "装 g++ 或 clang++，编译运行右边的程序",
     "学引用、std::vector、类和 RAII",
     "用 CMake 组织项目，用 pybind11 给它一个 Python 接口"
    ],
    "en": [
     "Install g++ or clang++ and run the program on the right",
     "Learn references, std::vector, classes and RAII",
     "Organise a project with CMake and give it a Python interface with pybind11"
    ]
   },
   "links": [
    [
     "LearnCpp",
     "LearnCpp",
     "https://www.learncpp.com/"
    ],
    [
     "cppreference",
     "cppreference",
     "https://en.cppreference.com/w/c"
    ]
   ],
   "snippets": [
    {
     "file": "lj.cpp",
     "lang": null,
     "title": null,
     "run": "g++ -std=c++17 -O2 lj.cpp -o lj && ./lj",
     "tested": true,
     "code": "// Lennard-Jones energy of three atoms (reduced units)\n#include <array>\n#include <cmath>\n#include <cstdio>\n#include <vector>\n\nusing Vec3 = std::array<double, 3>;\n\ndouble lj(double d) {\n    const double s6 = std::pow(1.0 / d, 6);\n    return 4.0 * (s6 * s6 - s6);\n}\n\nint main() {\n    const double r = std::pow(2.0, 1.0 / 6.0);\n    const std::vector<Vec3> atoms{{0, 0, 0}, {r, 0, 0}, {r / 2, r * std::sqrt(3.0) / 2, 0}};\n    double energy = 0.0;\n    for (std::size_t i = 0; i < atoms.size(); ++i)\n        for (std::size_t j = i + 1; j < atoms.size(); ++j) {\n            const auto& a = atoms[i];\n            const auto& b = atoms[j];\n            energy += lj(std::hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));\n        }\n    std::printf(\"E = %.6f\\n\", energy);\n}"
    }
   ]
  },
  {
   "id": "c",
   "name": "C",
   "tier": "core",
   "year": 1972,
   "glyph": "c",
   "role": {
    "zh": "系统和底层库的语言：数值库、文件格式库和 Python 本身都用 C 写；很多程序用 C 接口互相调用。",
    "en": "The language of systems and low-level libraries: numerical libraries, file-format libraries and Python itself are written in C, and programs talk to each other through C interfaces."
   },
   "used": [
    "libxc",
    "spglib",
    "FFTW",
    "HDF5",
    "CPython"
   ],
   "good": {
    "zh": "简单、可移植、和任何语言都能互调（C ABI）；读懂它就看得懂大多数库的接口。",
    "en": "Small, portable, callable from any language (the C ABI); knowing it lets you read most libraries' interfaces."
   },
   "watch": {
    "zh": "手动管理内存，没有数组边界检查；做大程序时比 C++ 啰嗦。",
    "en": "Manual memory management and no bounds checks; verbose for large programs compared with C++."
   },
   "start": {
    "zh": [
     "编译运行右边的程序（注意 -lm 链接数学库）",
     "学指针、数组和 malloc / free",
     "用 valgrind 或 -fsanitize=address 查内存错误"
    ],
    "en": [
     "Run the program on the right (note -lm for the maths library)",
     "Learn pointers, arrays and malloc / free",
     "Find memory bugs with valgrind or -fsanitize=address"
    ]
   },
   "links": [
    [
     "cppreference（C 部分）",
     "cppreference (C)",
     "https://en.cppreference.com/w/c"
    ]
   ],
   "snippets": [
    {
     "file": "lj.c",
     "lang": null,
     "title": null,
     "run": "gcc -O2 lj.c -lm -o lj && ./lj",
     "tested": true,
     "code": "/* Lennard-Jones energy of three atoms (reduced units) */\n#include <math.h>\n#include <stdio.h>\n\nint main(void) {\n    const double r = pow(2.0, 1.0 / 6.0);\n    const double x[3][3] = {{0, 0, 0}, {r, 0, 0}, {r / 2, r * sqrt(3.0) / 2, 0}};\n    double energy = 0.0;\n    for (int i = 0; i < 3; i++)\n        for (int j = i + 1; j < 3; j++) {\n            double dx = x[i][0] - x[j][0], dy = x[i][1] - x[j][1], dz = x[i][2] - x[j][2];\n            double s6 = pow(1.0 / sqrt(dx * dx + dy * dy + dz * dz), 6);\n            energy += 4.0 * (s6 * s6 - s6);\n        }\n    printf(\"E = %.6f\\n\", energy);\n    return 0;\n}"
    }
   ]
  },
  {
   "id": "julia",
   "name": "Julia",
   "tier": "core",
   "year": 2012,
   "glyph": "jl",
   "role": {
    "zh": "为科学计算设计的语言：写起来像 Python，即时编译后接近 C 的速度，多重派发让数学代码很自然。",
    "en": "Designed for scientific computing: reads like Python, runs near C speed after just-in-time compilation, and multiple dispatch makes mathematical code natural."
   },
   "used": [
    "DFTK.jl",
    "Molly.jl",
    "ITensors.jl",
    "QuantumOptics.jl",
    "DifferentialEquations.jl"
   ],
   "good": {
    "zh": "一种语言里既能原型又能写高性能代码，不用“两种语言”；自动微分和 GPU 包好用。",
    "en": "Prototype and high-performance code in one language, no two-language split; good automatic differentiation and GPU packages."
   },
   "watch": {
    "zh": "第一次运行要编译，启动慢；化学生态比 Python 小，很多程序还是要调用 Python 或 C。",
    "en": "First runs compile, so start-up is slow; the chemistry ecosystem is smaller than Python's, and you will still call Python or C."
   },
   "start": {
    "zh": [
     "用 juliaup 安装，在 REPL 里试右边的程序",
     "学类型、多重派发和广播（点运算）",
     "用 DFTK.jl 算一个硅晶体的能带"
    ],
    "en": [
     "Install with juliaup and try the program in the REPL",
     "Learn types, multiple dispatch and broadcasting (dot syntax)",
     "Compute silicon's band structure with DFTK.jl"
    ]
   },
   "links": [
    [
     "Julia 文档",
     "Julia documentation",
     "https://docs.julialang.org/en/v1/"
    ],
    [
     "学习资源",
     "Learning resources",
     "https://julialang.org/learning/"
    ]
   ],
   "snippets": [
    {
     "file": "lj.jl",
     "lang": null,
     "title": null,
     "run": "julia lj.jl",
     "tested": false,
     "code": "# Lennard-Jones energy of three atoms (reduced units)\nusing LinearAlgebra\n\nlj(d) = 4 * (d^-12 - d^-6)\n\nr = 2^(1/6)\natoms = [[0.0, 0.0, 0.0], [r, 0.0, 0.0], [r/2, r*sqrt(3)/2, 0.0]]\n\nenergy = sum(lj(norm(atoms[i] - atoms[j])) for i in 1:3 for j in i+1:3)\nprintln(\"E = \", round(energy, digits=6))"
    }
   ]
  },
  {
   "id": "openmp",
   "name": "OpenMP",
   "tier": "parallel",
   "year": 1997,
   "glyph": "omp",
   "role": {
    "zh": "共享内存并行：在 C、C++、Fortran 的循环前加一行指令，让一台机器的多个核一起算。",
    "en": "Shared-memory parallelism: one directive before a C, C++ or Fortran loop and the cores of one machine work on it together."
   },
   "used": [
    "CP2K",
    "Quantum ESPRESSO",
    "GROMACS",
    {
     "zh": "几乎所有大程序的“MPI + OpenMP”混合模式",
     "en": "the hybrid MPI + OpenMP mode of most large codes"
    }
   ],
   "good": {
    "zh": "改动小、渐进式；不改算法就能先用上多核。",
    "en": "Small, incremental changes; use all cores before touching the algorithm."
   },
   "watch": {
    "zh": "只在一个节点内有效；共享变量要小心数据竞争（reduction、private）。",
    "en": "Only within one node; watch shared variables for data races (reduction, private)."
   },
   "start": {
    "zh": [
     "用 -fopenmp 编译右边的程序，改 OMP_NUM_THREADS 看结果不变",
     "学 parallel for、reduction、private、schedule",
     "用一个大一点的体系（几千个原子）测加速比"
    ],
    "en": [
     "Compile the program with -fopenmp and change OMP_NUM_THREADS: the result stays the same",
     "Learn parallel for, reduction, private and schedule",
     "Measure the speed-up on a bigger system (thousands of atoms)"
    ]
   },
   "links": [
    [
     "OpenMP 教程汇总",
     "OpenMP tutorials",
     "https://www.openmp.org/resources/tutorials-articles/"
    ]
   ],
   "snippets": [
    {
     "file": "lj_omp.c",
     "lang": "c",
     "title": null,
     "run": "gcc -fopenmp -O2 lj_omp.c -lm -o lj && OMP_NUM_THREADS=4 ./lj",
     "tested": true,
     "code": "/* The pair loop in parallel with OpenMP: each thread sums part of the pairs, reduction adds them up */\n#include <math.h>\n#include <stdio.h>\n\n#define N 3\n\nint main(void) {\n    const double r = pow(2.0, 1.0 / 6.0);\n    const double x[N][3] = {{0, 0, 0}, {r, 0, 0}, {r / 2, r * sqrt(3.0) / 2, 0}};\n    double energy = 0.0;\n    #pragma omp parallel for reduction(+:energy) schedule(dynamic)\n    for (int i = 0; i < N; i++)\n        for (int j = i + 1; j < N; j++) {\n            double dx = x[i][0] - x[j][0], dy = x[i][1] - x[j][1], dz = x[i][2] - x[j][2];\n            double s6 = pow(dx * dx + dy * dy + dz * dz, -3.0);\n            energy += 4.0 * (s6 * s6 - s6);\n        }\n    printf(\"E = %.6f\\n\", energy);\n    return 0;\n}"
    }
   ]
  },
  {
   "id": "mpi",
   "name": "MPI",
   "tier": "parallel",
   "year": 1994,
   "glyph": "mpi",
   "role": {
    "zh": "分布式内存并行的标准：很多进程各算一部分，通过消息交换数据，从笔记本跑到超算的上万个核。",
    "en": "The standard for distributed-memory parallelism: many processes each compute a part and exchange messages, from a laptop to tens of thousands of supercomputer cores."
   },
   "used": [
    "VASP",
    "Quantum ESPRESSO",
    "CP2K",
    "LAMMPS",
    "GROMACS",
    "NWChem"
   ],
   "good": {
    "zh": "可扩展到整台超算；有 C、Fortran 接口，Python 里有 mpi4py。",
    "en": "Scales to whole supercomputers; C and Fortran interfaces, and mpi4py in Python."
   },
   "watch": {
    "zh": "要自己想清楚数据怎么分、什么时候通信；调试比串行难。",
    "en": "You decide how data is split and when to communicate; debugging is harder than serial code."
   },
   "start": {
    "zh": [
     "装 Open MPI 或 MPICH，用 mpicc 编译、mpirun -np 2 运行右边的程序",
     "学 rank、size、Send / Recv、Reduce、Bcast",
     "在集群上用 Slurm 提交一个多节点作业"
    ],
    "en": [
     "Install Open MPI or MPICH; build with mpicc and run with mpirun -np 2",
     "Learn rank, size, Send / Recv, Reduce and Bcast",
     "Submit a multi-node job with Slurm on a cluster"
    ]
   },
   "links": [
    [
     "MPI 教程",
     "MPI tutorial",
     "https://mpitutorial.com/"
    ],
    [
     "MPI 标准文档",
     "MPI standard",
     "https://www.mpi-forum.org/docs/"
    ]
   ],
   "snippets": [
    {
     "file": "lj_mpi.c",
     "lang": "c",
     "title": null,
     "run": "mpicc -O2 lj_mpi.c -lm -o lj && mpirun -np 2 ./lj",
     "tested": true,
     "code": "/* The pair loop split over MPI ranks: each process takes every size-th pair, MPI_Reduce adds the parts on rank 0 */\n#include <math.h>\n#include <mpi.h>\n#include <stdio.h>\n\n#define N 3\n\nint main(int argc, char **argv) {\n    MPI_Init(&argc, &argv);\n    int rank, size;\n    MPI_Comm_rank(MPI_COMM_WORLD, &rank);\n    MPI_Comm_size(MPI_COMM_WORLD, &size);\n\n    const double r = pow(2.0, 1.0 / 6.0);\n    const double x[N][3] = {{0, 0, 0}, {r, 0, 0}, {r / 2, r * sqrt(3.0) / 2, 0}};\n    double mine = 0.0, energy = 0.0;\n    int pair = 0;\n    for (int i = 0; i < N; i++)\n        for (int j = i + 1; j < N; j++, pair++) {\n            if (pair % size != rank) continue;\n            double dx = x[i][0] - x[j][0], dy = x[i][1] - x[j][1], dz = x[i][2] - x[j][2];\n            double s6 = pow(dx * dx + dy * dy + dz * dz, -3.0);\n            mine += 4.0 * (s6 * s6 - s6);\n        }\n    MPI_Reduce(&mine, &energy, 1, MPI_DOUBLE, MPI_SUM, 0, MPI_COMM_WORLD);\n    if (rank == 0) printf(\"E = %.6f\\n\", energy);\n    MPI_Finalize();\n    return 0;\n}"
    }
   ]
  },
  {
   "id": "cuda",
   "name": "CUDA · HIP · SYCL",
   "tier": "parallel",
   "year": 2007,
   "glyph": "gpu",
   "role": {
    "zh": "GPU 编程：成千上万个线程同时算。CUDA 只用于 NVIDIA；HIP 写法几乎一样、用于 AMD；SYCL 和 OpenACC 跨厂商。",
    "en": "GPU programming: thousands of threads at once. CUDA is NVIDIA-only; HIP is nearly identical and targets AMD; SYCL and OpenACC work across vendors."
   },
   "used": [
    "GROMACS",
    {
     "zh": "AMBER（pmemd.cuda）",
     "en": "AMBER (pmemd.cuda)"
    },
    "OpenMM",
    "TeraChem",
    {
     "zh": "gpu4pyscf（经 CuPy）",
     "en": "gpu4pyscf (via CuPy)"
    },
    "cuEquivariance"
   ],
   "good": {
    "zh": "分子动力学、积分和神经网络势在 GPU 上快几十倍；Python 里可以先用 CuPy、Numba、JAX 不写内核。",
    "en": "MD, integrals and neural network potentials run tens of times faster; from Python, CuPy, Numba and JAX avoid writing kernels at first."
   },
   "watch": {
    "zh": "内存要在 CPU 和 GPU 之间搬，搬运常常比计算还慢；双精度性能各卡差别很大。",
    "en": "Data moves between CPU and GPU memory, often slower than the maths; double-precision speed varies a lot between cards."
   },
   "start": {
    "zh": [
     "先在 Python 里用 CuPy 把 NumPy 程序搬上 GPU",
     "再读 CUDA 编程指南的线程、块、共享内存",
     "用 Nsight 或 rocprof 看程序时间花在哪"
    ],
    "en": [
     "Start by moving a NumPy program to the GPU with CuPy",
     "Then read the CUDA guide on threads, blocks and shared memory",
     "Profile with Nsight or rocprof to see where time goes"
    ]
   },
   "links": [
    [
     "CUDA 编程指南",
     "CUDA programming guide",
     "https://docs.nvidia.com/cuda/cuda-c-programming-guide/"
    ],
    [
     "HIP 文档",
     "HIP documentation",
     "https://rocm.docs.amd.com/projects/HIP/en/latest/"
    ],
    [
     "SYCL",
     "SYCL",
     "https://www.khronos.org/sycl/"
    ],
    [
     "OpenACC",
     "OpenACC",
     "https://www.openacc.org/"
    ]
   ],
   "snippets": [
    {
     "file": "cuda_lj.cu",
     "lang": "cuda",
     "title": null,
     "run": "nvcc -O2 cuda_lj.cu -o lj && ./lj",
     "tested": false,
     "code": "// One GPU thread per pair: the same Lennard-Jones sum on an NVIDIA GPU (CUDA C++)\n#include <cmath>\n#include <cstdio>\n\n__global__ void pair_energy(const double3* x, int n, double* energy) {\n    int rest = blockIdx.x * blockDim.x + threadIdx.x, i = 0;   // this thread's pair number\n    while (i < n - 1 && rest >= n - 1 - i) { rest -= n - 1 - i; ++i; }\n    if (i >= n - 1) return;                                      // more threads than pairs\n    int j = i + 1 + rest;\n    double dx = x[i].x - x[j].x, dy = x[i].y - x[j].y, dz = x[i].z - x[j].z;\n    double s6 = pow(dx * dx + dy * dy + dz * dz, -3.0);\n    atomicAdd(energy, 4.0 * (s6 * s6 - s6));   // double-precision atomicAdd needs compute capability 6.0+\n}\n\nint main() {\n    const int n = 3;\n    const double r = pow(2.0, 1.0 / 6.0);\n    double3 h[n] = {{0, 0, 0}, {r, 0, 0}, {r / 2, r * sqrt(3.0) / 2, 0}};\n    double3* d_x;\n    double* d_e;\n    double e = 0.0;\n    cudaMalloc(&d_x, sizeof h);\n    cudaMalloc(&d_e, sizeof e);\n    cudaMemcpy(d_x, h, sizeof h, cudaMemcpyHostToDevice);\n    cudaMemcpy(d_e, &e, sizeof e, cudaMemcpyHostToDevice);\n    pair_energy<<<1, 32>>>(d_x, n, d_e);\n    cudaMemcpy(&e, d_e, sizeof e, cudaMemcpyDeviceToHost);\n    std::printf(\"E = %.6f\\n\", e);\n    cudaFree(d_x);\n    cudaFree(d_e);\n}"
    }
   ]
  },
  {
   "id": "matlab",
   "name": "MATLAB · GNU Octave",
   "tier": "math",
   "year": 1984,
   "glyph": "m",
   "role": {
    "zh": "矩阵语言和交互环境，教学、光谱和信号处理、化学计量学里常见。GNU Octave 是开源、语法基本兼容的替代。",
    "en": "A matrix language and interactive environment, common in teaching, spectra and signal processing, and chemometrics. GNU Octave is an open, largely compatible alternative."
   },
   "used": [
    {
     "zh": "化学计量学工具箱（PLS 等）",
     "en": "chemometrics toolboxes (PLS and others)"
    },
    {
     "zh": "课程作业和数值方法教学",
     "en": "coursework and numerical-methods teaching"
    },
    {
     "zh": "实验数据处理",
     "en": "experimental data processing"
    }
   ],
   "good": {
    "zh": "矩阵运算一行写完，画图方便，工具箱齐全。",
    "en": "Matrix maths in one line, easy plotting, many toolboxes."
   },
   "watch": {
    "zh": "MATLAB 需要许可证；大型模拟程序很少用它写。Octave 免费但部分工具箱没有。",
    "en": "MATLAB needs a licence and is rarely used for large simulation codes; Octave is free but lacks some toolboxes."
   },
   "start": {
    "zh": [
     "装 Octave（或学校的 MATLAB），运行右边的程序",
     "学矩阵切片、向量化和 plot",
     "用它拟合一条实验曲线或做一次 PCA"
    ],
    "en": [
     "Install Octave (or your university's MATLAB) and run the program",
     "Learn matrix slicing, vectorisation and plot",
     "Fit an experimental curve or run a PCA"
    ]
   },
   "links": [
    [
     "Octave 文档",
     "Octave documentation",
     "https://docs.octave.org/latest/"
    ],
    [
     "MATLAB Academy",
     "MATLAB Academy",
     "https://matlabacademy.mathworks.com/"
    ]
   ],
   "snippets": [
    {
     "file": "lj.m",
     "lang": null,
     "title": null,
     "run": "octave-cli lj.m",
     "tested": true,
     "code": "% Lennard-Jones energy of three atoms (runs in MATLAB and GNU Octave)\nr = 2^(1/6);\nx = [0 0 0; r 0 0; r/2 r*sqrt(3)/2 0];\nenergy = 0;\nfor i = 1:3\n  for j = i+1:3\n    s6 = norm(x(i,:) - x(j,:))^-6;\n    energy = energy + 4*(s6^2 - s6);\n  end\nend\nfprintf('E = %.6f\\n', energy);"
    }
   ]
  },
  {
   "id": "symbolic",
   "name": "Mathematica · SymPy",
   "tier": "math",
   "year": 1988,
   "glyph": "∂",
   "role": {
    "zh": "符号计算：推导公式、求导和积分、化简矩阵元。Mathematica（Wolfram 语言）和 Maple 是商业软件，SymPy 是免费的 Python 库。",
    "en": "Symbolic computing: derive formulas, differentiate and integrate, simplify matrix elements. Mathematica (the Wolfram Language) and Maple are commercial; SymPy is a free Python library."
   },
   "used": [
    {
     "zh": "理论推导和检查",
     "en": "deriving and checking theory"
    },
    {
     "zh": "高斯积分、角动量代数",
     "en": "Gaussian integrals, angular-momentum algebra"
    },
    {
     "zh": "生成数值代码（SymPy 的 codegen）",
     "en": "generating numerical code (SymPy codegen)"
    }
   ],
   "good": {
    "zh": "把容易算错的代数交给计算机；结果可以直接转成数值代码。",
    "en": "Hands error-prone algebra to the computer; results can be turned into numerical code."
   },
   "watch": {
    "zh": "表达式大了会很慢；化简结果要自己判断物理意义（比如正负号和定义域的假设）。",
    "en": "Large expressions get slow; judge simplified results yourself (assumptions about signs and domains)."
   },
   "start": {
    "zh": [
     "在浏览器里运行右边的 SymPy 程序（不用安装）",
     "学 symbols、diff、integrate、solve、simplify 和假设",
     "推一遍谐振子或氢原子的一个矩阵元"
    ],
    "en": [
     "Run the SymPy program on the right in the browser (no install)",
     "Learn symbols, diff, integrate, solve, simplify and assumptions",
     "Work out a matrix element of the harmonic oscillator or hydrogen atom"
    ]
   },
   "links": [
    [
     "SymPy 入门",
     "SymPy tutorial",
     "https://docs.sympy.org/latest/tutorials/intro-tutorial/index.html"
    ],
    [
     "Wolfram 语言快速入门",
     "Fast intro to the Wolfram Language",
     "https://www.wolfram.com/language/fast-introduction-for-programmers/"
    ]
   ],
   "snippets": [
    {
     "file": "lj_sympy.py",
     "lang": "python",
     "title": {
      "zh": "SymPy",
      "en": "SymPy"
     },
     "run": "python3 lj_sympy.py",
     "tested": true,
     "code": "# Symbolic side: where is the Lennard-Jones minimum, and how deep is it? (SymPy; Mathematica does the same in one line)\nimport sympy as sp\n\nr, eps, sigma = sp.symbols('r epsilon sigma', positive=True)\nV = 4 * eps * ((sigma / r) ** 12 - (sigma / r) ** 6)\n\nr_min = sp.solve(sp.diff(V, r), r)[0]\nprint('r_min =', r_min)                      # 2**(1/6)*sigma\nprint('V(r_min) =', sp.simplify(V.subs(r, r_min)))   # -epsilon"
    },
    {
     "file": "symbolic.wl",
     "lang": "wolfram",
     "title": {
      "zh": "Wolfram 语言",
      "en": "Wolfram"
     },
     "run": "wolframscript -file symbolic.wl",
     "tested": false,
     "code": "(* Wolfram Language (Mathematica): the same two questions as the SymPy tab *)\nV[r_] := 4 ε ((σ/r)^12 - (σ/r)^6)\nrmin = r /. First @ Solve[D[V[r], r] == 0 && r > 0, r, Assumptions -> σ > 0]\nSimplify[V[rmin], σ > 0]"
    }
   ],
   "runnable": true,
   "task": "sym"
  },
  {
   "id": "r",
   "name": "R",
   "tier": "data",
   "year": 1993,
   "glyph": "R",
   "role": {
    "zh": "统计和数据分析的语言：化学计量学、实验设计、回归和可视化，生物信息学里尤其多。",
    "en": "The language of statistics and data analysis: chemometrics, design of experiments, regression and visualisation, especially common in bioinformatics."
   },
   "used": [
    {
     "zh": "化学计量学（pls 等包）",
     "en": "chemometrics (pls and other packages)"
    },
    {
     "zh": "Bioconductor 的 ChemmineR",
     "en": "ChemmineR on Bioconductor"
    },
    {
     "zh": "实验数据统计",
     "en": "statistics on experimental data"
    }
   ],
   "good": {
    "zh": "统计方法最全，ggplot2 画图漂亮，报告（R Markdown / Quarto）好写。",
    "en": "The widest range of statistical methods, beautiful plots with ggplot2, easy reports (R Markdown / Quarto)."
   },
   "watch": {
    "zh": "不适合写模拟程序；语法有不少历史包袱（向量下标从 1 开始、因子类型）。",
    "en": "Not for simulation codes; some historical quirks (1-based indexing, factors)."
   },
   "start": {
    "zh": [
     "装 R 和 RStudio（或 Positron），运行右边的程序",
     "学向量、数据框和 dplyr",
     "用 ggplot2 画一张光谱或回归图"
    ],
    "en": [
     "Install R and RStudio (or Positron) and run the program",
     "Learn vectors, data frames and dplyr",
     "Plot a spectrum or a regression with ggplot2"
    ]
   },
   "links": [
    [
     "R for Data Science",
     "R for Data Science",
     "https://r4ds.hadley.nz/"
    ]
   ],
   "snippets": [
    {
     "file": "lj.R",
     "lang": null,
     "title": null,
     "run": "Rscript lj.R",
     "tested": true,
     "code": "# Lennard-Jones energy of three atoms (reduced units)\nr <- 2^(1/6)\nx <- rbind(c(0, 0, 0), c(r, 0, 0), c(r/2, r*sqrt(3)/2, 0))\nd <- as.vector(dist(x))          # all pair distances\ns6 <- d^-6\ncat(sprintf(\"E = %.6f\\n\", sum(4 * (s6^2 - s6))))"
    }
   ]
  },
  {
   "id": "sql",
   "name": "SQL",
   "tier": "data",
   "year": 1974,
   "glyph": "sql",
   "role": {
    "zh": "查询数据库的语言。ChEMBL 等化学数据库提供 SQLite / PostgreSQL 下载，RDKit 的 PostgreSQL 扩展能在数据库里做子结构搜索。",
    "en": "The language of database queries. Chemistry databases such as ChEMBL ship SQLite / PostgreSQL downloads, and the RDKit PostgreSQL cartridge runs substructure searches inside the database."
   },
   "used": [
    {
     "zh": "ChEMBL 的数据库下载",
     "en": "ChEMBL database downloads"
    },
    {
     "zh": "RDKit PostgreSQL 扩展",
     "en": "the RDKit PostgreSQL cartridge"
    },
    {
     "zh": "自己的计算结果库",
     "en": "your own results database"
    }
   ],
   "good": {
    "zh": "几百万条记录的筛选、连接和统计几秒完成；结果可复现。",
    "en": "Filters, joins and statistics over millions of records in seconds, reproducibly."
   },
   "watch": {
    "zh": "不是拿来做数值计算的（右边只是为了对照）；各数据库的方言略有不同。",
    "en": "Not meant for numerics (the example is only for comparison); dialects differ slightly between databases."
   },
   "start": {
    "zh": [
     "用 SQLite 打开 ChEMBL 的数据库文件",
     "学 SELECT、WHERE、JOIN、GROUP BY",
     "试一次 RDKit 扩展的子结构查询"
    ],
    "en": [
     "Open ChEMBL's SQLite file",
     "Learn SELECT, WHERE, JOIN and GROUP BY",
     "Try a substructure query with the RDKit cartridge"
    ]
   },
   "links": [
    [
     "PostgreSQL 教程",
     "PostgreSQL tutorial",
     "https://www.postgresql.org/docs/current/tutorial.html"
    ],
    [
     "RDKit 数据库扩展",
     "RDKit cartridge",
     "https://www.rdkit.org/docs/Cartridge.html"
    ],
    [
     "SQLite 的 SQL",
     "SQL as understood by SQLite",
     "https://www.sqlite.org/lang.html"
    ]
   ],
   "snippets": [
    {
     "file": "lj.sql",
     "lang": null,
     "title": null,
     "run": "sqlite3 < lj.sql",
     "tested": true,
     "code": "-- Lennard-Jones energy of three atoms in plain SQL (SQLite; in PostgreSQL replace printf with round(..., 6))\nWITH atoms(id, x, y, z) AS (\n  VALUES (1, 0.0, 0.0, 0.0),\n         (2, 1.122462048309373, 0.0, 0.0),\n         (3, 0.5612310241546865, 0.9720806486198328, 0.0)\n),\npairs AS (\n  SELECT (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) + (a.z - b.z) * (a.z - b.z) AS d2\n  FROM atoms a JOIN atoms b ON a.id < b.id\n)\nSELECT printf('E = %.6f', SUM(4 * (1 / (d2 * d2 * d2 * d2 * d2 * d2) - 1 / (d2 * d2 * d2)))) AS energy FROM pairs;"
    }
   ]
  },
  {
   "id": "bash",
   "name": "Bash · Shell",
   "tier": "glue",
   "year": 1989,
   "glyph": "$_",
   "role": {
    "zh": "在 Linux 和集群上干活的第一门语言：组织文件、串起程序、写 Slurm 作业脚本。",
    "en": "The first language for working on Linux and clusters: organise files, chain programs, write Slurm job scripts."
   },
   "used": [
    {
     "zh": "集群作业脚本（Slurm、PBS）",
     "en": "cluster job scripts (Slurm, PBS)"
    },
    {
     "zh": "批量运行和整理输出",
     "en": "batch runs and collecting output"
    },
    {
     "zh": "和 awk、sed、grep 搭配",
     "en": "together with awk, sed and grep"
    }
   ],
   "good": {
    "zh": "到处都有；几行就能把一千个输入文件跑完。",
    "en": "Everywhere; a few lines run a thousand input files."
   },
   "watch": {
    "zh": "变量要加引号、出错默认不停（写 set -euo pipefail）；复杂逻辑交给 Python。",
    "en": "Quote your variables; errors do not stop scripts by default (use set -euo pipefail); move complex logic to Python."
   },
   "start": {
    "zh": [
     "学 cd、ls、管道、重定向和通配符",
     "跟 Software Carpentry 的 Shell 课走一遍",
     "写一个 Slurm 脚本提交一次计算"
    ],
    "en": [
     "Learn cd, ls, pipes, redirection and globs",
     "Follow the Software Carpentry shell lesson",
     "Write a Slurm script and submit a calculation"
    ]
   },
   "links": [
    [
     "Software Carpentry：Shell",
     "Software Carpentry: the shell",
     "https://swcarpentry.github.io/shell-novice/"
    ],
    [
     "Bash 手册",
     "Bash manual",
     "https://www.gnu.org/software/bash/manual/"
    ],
    [
     "Slurm 快速入门",
     "Slurm quick start",
     "https://slurm.schedmd.com/quickstart.html"
    ]
   ],
   "snippets": [
    {
     "file": "lj.sh",
     "lang": null,
     "title": null,
     "run": "bash lj.sh",
     "tested": true,
     "code": "#!/usr/bin/env bash\n# The shell's job is to glue programs together; here awk does the arithmetic.\ncat > trimer.xyz <<XYZ\n3\nargon trimer, reduced units\nAr 0.000000 0.000000 0.000000\nAr 1.122462 0.000000 0.000000\nAr 0.561231 0.972081 0.000000\nXYZ\n\nawk 'NR > 2 { x[n] = $2; y[n] = $3; z[n] = $4; n++ }\n     END {\n       for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {\n         s6 = ((x[i]-x[j])^2 + (y[i]-y[j])^2 + (z[i]-z[j])^2)^-3\n         e += 4 * (s6 * s6 - s6)\n       }\n       printf \"E = %.6f\\n\", e\n     }' trimer.xyz"
    }
   ]
  },
  {
   "id": "tcl",
   "name": "Tcl",
   "tier": "glue",
   "year": 1988,
   "glyph": "tcl",
   "role": {
    "zh": "VMD 的脚本语言（VMD 也支持 Python）：批量选原子、量距离、渲染图片、分析轨迹。",
    "en": "The scripting language of VMD (which also takes Python): select atoms, measure distances, render images and analyse trajectories in batches."
   },
   "used": [
    "VMD",
    {
     "zh": "NAMD 的配置文件",
     "en": "NAMD configuration files"
    }
   ],
   "good": {
    "zh": "VMD 里所有菜单操作都能写成脚本，复现图片和分析。",
    "en": "Every menu action in VMD can be scripted, so images and analyses are reproducible."
   },
   "watch": {
    "zh": "语法独特（一切都是字符串、算术要写 expr）；VMD 之外很少用到。",
    "en": "Unusual syntax (everything is a string, arithmetic needs expr); rarely used outside VMD."
   },
   "start": {
    "zh": [
     "在 VMD 的 Tk 控制台里运行右边的程序",
     "学 atomselect、measure 和 render",
     "写一个脚本给轨迹每一帧算 RMSD"
    ],
    "en": [
     "Run the program in VMD's Tk console",
     "Learn atomselect, measure and render",
     "Script an RMSD over every frame of a trajectory"
    ]
   },
   "links": [
    [
     "VMD 用户手册",
     "VMD user guide",
     "https://www.ks.uiuc.edu/Research/vmd/current/ug/"
    ],
    [
     "关于 Tcl",
     "About Tcl",
     "https://www.tcl-lang.org/about/"
    ]
   ],
   "snippets": [
    {
     "file": "lj.tcl",
     "lang": null,
     "title": null,
     "run": "tclsh lj.tcl",
     "tested": true,
     "code": "# Lennard-Jones energy of three atoms; the same Tcl runs inside VMD's console\nset r [expr {pow(2.0, 1.0/6.0)}]\nset atoms [list {0 0 0} [list $r 0 0] [list [expr {$r/2}] [expr {$r*sqrt(3)/2}] 0]]\nset energy 0.0\nfor {set i 0} {$i < 3} {incr i} {\n    for {set j [expr {$i + 1}]} {$j < 3} {incr j} {\n        lassign [lindex $atoms $i] x1 y1 z1\n        lassign [lindex $atoms $j] x2 y2 z2\n        set s6 [expr {pow(($x1-$x2)**2 + ($y1-$y2)**2 + ($z1-$z2)**2, -3)}]\n        set energy [expr {$energy + 4*($s6*$s6 - $s6)}]\n    }\n}\nputs [format \"E = %.6f\" $energy]"
    }
   ]
  },
  {
   "id": "perl",
   "name": "Perl",
   "tier": "glue",
   "year": 1987,
   "glyph": "pl",
   "role": {
    "zh": "文本处理语言，老一代分析脚本和工具链里还很常见，Open Babel 也有 Perl 接口。新脚本一般改用 Python。",
    "en": "A text-processing language still common in older analysis scripts and toolchains; Open Babel has Perl bindings. New scripts usually use Python."
   },
   "used": [
    {
     "zh": "老的输出解析脚本",
     "en": "older output-parsing scripts"
    },
    {
     "zh": "Open Babel 的 Perl 接口",
     "en": "Open Babel Perl bindings"
    }
   ],
   "good": {
    "zh": "正则表达式强大，处理文本快。",
    "en": "Powerful regular expressions, fast text processing."
   },
   "watch": {
    "zh": "可读性差，生态在萎缩；主要用来读懂和维护已有脚本。",
    "en": "Hard to read and a shrinking ecosystem; mainly for reading and maintaining existing scripts."
   },
   "start": {
    "zh": [
     "运行右边的程序",
     "学正则表达式和哈希",
     "把一个老 Perl 脚本改写成 Python 对照着读"
    ],
    "en": [
     "Run the program on the right",
     "Learn regular expressions and hashes",
     "Rewrite an old Perl script in Python, side by side"
    ]
   },
   "links": [
    [
     "Perl 文档",
     "Perl documentation",
     "https://perldoc.perl.org/"
    ]
   ],
   "snippets": [
    {
     "file": "lj.pl",
     "lang": null,
     "title": null,
     "run": "perl lj.pl",
     "tested": true,
     "code": "# Lennard-Jones energy of three atoms (Perl is still common in older analysis scripts)\nuse strict; use warnings;\nmy $r = 2 ** (1 / 6);\nmy @atoms = ([0, 0, 0], [$r, 0, 0], [$r / 2, $r * sqrt(3) / 2, 0]);\nmy $energy = 0;\nfor my $i (0 .. $#atoms) {\n    for my $j ($i + 1 .. $#atoms) {\n        my $d2 = 0;\n        $d2 += ($atoms[$i][$_] - $atoms[$j][$_]) ** 2 for 0 .. 2;\n        my $s6 = $d2 ** -3;\n        $energy += 4 * ($s6 * $s6 - $s6);\n    }\n}\nprintf \"E = %.6f\\n\", $energy;"
    }
   ]
  },
  {
   "id": "java",
   "name": "Java",
   "tier": "more",
   "year": 1995,
   "glyph": "jv",
   "role": {
    "zh": "化学信息学里有一批重要的 Java 程序：CDK 工具包、Jmol 分子查看器、OPSIN 名称转结构，KNIME 工作流平台也基于 Java。",
    "en": "A set of important cheminformatics programs are in Java: the CDK toolkit, the Jmol viewer, OPSIN for name-to-structure, and the KNIME workflow platform."
   },
   "used": [
    "CDK",
    "Jmol",
    "OPSIN",
    "KNIME"
   ],
   "good": {
    "zh": "跨平台、库稳定，适合写大型桌面和服务端程序。",
    "en": "Cross-platform with stable libraries, suited to large desktop and server programs."
   },
   "watch": {
    "zh": "数值计算的库不如 Python 和 C++；量子化学和分子动力学几乎不用它。",
    "en": "Weaker numerical libraries than Python and C++; almost unused in quantum chemistry and MD."
   },
   "start": {
    "zh": [
     "装 JDK（17 以上），运行右边的程序",
     "学类、接口和集合",
     "用 CDK 读一个 SMILES 并算分子量"
    ],
    "en": [
     "Install a JDK (17+) and run the program",
     "Learn classes, interfaces and collections",
     "Read a SMILES with CDK and compute a molecular weight"
    ]
   },
   "links": [
    [
     "dev.java 教程",
     "dev.java tutorials",
     "https://dev.java/learn/"
    ],
    [
     "CDK",
     "CDK",
     "https://cdk.github.io/"
    ]
   ],
   "snippets": [
    {
     "file": "LJ.java",
     "lang": null,
     "title": null,
     "run": "javac LJ.java && java LJ",
     "tested": true,
     "code": "// Lennard-Jones energy of three atoms (reduced units)\npublic class LJ {\n    static double lj(double d) {\n        double s6 = Math.pow(d, -6);\n        return 4 * (s6 * s6 - s6);\n    }\n\n    public static void main(String[] args) {\n        double r = Math.pow(2, 1.0 / 6);\n        double[][] x = {{0, 0, 0}, {r, 0, 0}, {r / 2, r * Math.sqrt(3) / 2, 0}};\n        double energy = 0;\n        for (int i = 0; i < x.length; i++)\n            for (int j = i + 1; j < x.length; j++)\n                energy += lj(Math.sqrt(Math.pow(x[i][0] - x[j][0], 2) + Math.pow(x[i][1] - x[j][1], 2) + Math.pow(x[i][2] - x[j][2], 2)));\n        System.out.printf(\"E = %.6f%n\", energy);\n    }\n}"
    }
   ]
  },
  {
   "id": "rust",
   "name": "Rust",
   "tier": "more",
   "year": 2015,
   "glyph": "rs",
   "role": {
    "zh": "有 C++ 的速度、但编译器保证内存安全的新语言。科学计算生态还年轻，开始用于新写的文件解析器、命令行工具和底层库。",
    "en": "C++ speed with memory safety checked by the compiler. Its scientific ecosystem is young; it is starting to appear in new file parsers, command-line tools and low-level libraries."
   },
   "used": [
    {
     "zh": "新写的工具和库（生态仍在早期）",
     "en": "new tools and libraries (an early ecosystem)"
    }
   ],
   "good": {
    "zh": "没有数据竞争和悬垂指针，包管理（cargo）好用。",
    "en": "No data races or dangling pointers; an excellent package manager (cargo)."
   },
   "watch": {
    "zh": "学习曲线陡（所有权和借用）；化学专用库很少，常要自己写或调用 C。",
    "en": "Steep learning curve (ownership and borrowing); few chemistry libraries, so you often write or bind your own."
   },
   "start": {
    "zh": [
     "用 rustup 安装，cargo new 建项目",
     "读 The Rust Book 的所有权一章",
     "用 ndarray 或 nalgebra 改写右边的程序"
    ],
    "en": [
     "Install with rustup and start with cargo new",
     "Read the ownership chapter of The Rust Book",
     "Rewrite the program with ndarray or nalgebra"
    ]
   },
   "links": [
    [
     "The Rust Book",
     "The Rust Book",
     "https://doc.rust-lang.org/book/"
    ]
   ],
   "snippets": [
    {
     "file": "lj.rs",
     "lang": null,
     "title": null,
     "run": "rustc -O lj.rs -o lj && ./lj",
     "tested": true,
     "code": "// Lennard-Jones energy of three atoms (reduced units)\nfn lj(d: f64) -> f64 {\n    let s6 = d.powi(-6);\n    4.0 * (s6 * s6 - s6)\n}\n\nfn main() {\n    let r = 2f64.powf(1.0 / 6.0);\n    let atoms = [[0.0, 0.0, 0.0], [r, 0.0, 0.0], [r / 2.0, r * 3f64.sqrt() / 2.0, 0.0]];\n    let mut energy = 0.0;\n    for i in 0..atoms.len() {\n        for j in i + 1..atoms.len() {\n            let d: f64 = (0..3).map(|k| (atoms[i][k] - atoms[j][k]).powi(2)).sum::<f64>().sqrt();\n            energy += lj(d);\n        }\n    }\n    println!(\"E = {:.6}\", energy);\n}"
    }
   ]
  },
  {
   "id": "go",
   "name": "Go",
   "tier": "more",
   "year": 2009,
   "glyph": "go",
   "role": {
    "zh": "简洁的编译型语言，擅长网络服务和命令行工具。很少用来写科学计算本身，偶尔用在计算平台的服务端。",
    "en": "A simple compiled language good at network services and command-line tools. Rarely used for the science itself; sometimes for the back end of computing platforms."
   },
   "used": [
    {
     "zh": "计算平台和作业调度的服务端（少见）",
     "en": "back ends of computing platforms and job schedulers (rare)"
    }
   ],
   "good": {
    "zh": "编译快、部署只有一个文件、并发（goroutine）好写。",
    "en": "Fast builds, single-file deployment, easy concurrency (goroutines)."
   },
   "watch": {
    "zh": "数值和科学库很少，不建议作为计算化学的主力语言。",
    "en": "Few numerical or scientific libraries; not recommended as a main language for computational chemistry."
   },
   "start": {
    "zh": [
     "走一遍 Go Tour",
     "运行右边的程序",
     "需要时再学 goroutine 和 channel"
    ],
    "en": [
     "Take the Go Tour",
     "Run the program on the right",
     "Learn goroutines and channels when you need them"
    ]
   },
   "links": [
    [
     "A Tour of Go",
     "A Tour of Go",
     "https://go.dev/tour/"
    ]
   ],
   "snippets": [
    {
     "file": "lj.go",
     "lang": null,
     "title": null,
     "run": "go run lj.go",
     "tested": true,
     "code": "// Lennard-Jones energy of three atoms (reduced units)\npackage main\n\nimport (\n\t\"fmt\"\n\t\"math\"\n)\n\nfunc main() {\n\tr := math.Pow(2, 1.0/6)\n\tatoms := [][3]float64{{0, 0, 0}, {r, 0, 0}, {r / 2, r * math.Sqrt(3) / 2, 0}}\n\tenergy := 0.0\n\tfor i := range atoms {\n\t\tfor j := i + 1; j < len(atoms); j++ {\n\t\t\td := math.Sqrt(math.Pow(atoms[i][0]-atoms[j][0], 2) + math.Pow(atoms[i][1]-atoms[j][1], 2) + math.Pow(atoms[i][2]-atoms[j][2], 2))\n\t\t\ts6 := math.Pow(d, -6)\n\t\t\tenergy += 4 * (s6*s6 - s6)\n\t\t}\n\t}\n\tfmt.Printf(\"E = %.6f\\n\", energy)\n}"
    }
   ]
  },
  {
   "id": "javascript",
   "name": "JavaScript · WebAssembly",
   "tier": "more",
   "year": 1995,
   "glyph": "js",
   "role": {
    "zh": "浏览器的语言。WebAssembly 让 C++ 和 Python 也能在网页里跑：RDKit.js、Pyodide 都是这样来的，这个网站的分子查看器、画结构和 Python 代码框就用它们。",
    "en": "The language of the browser. WebAssembly lets C++ and Python run in web pages too: that is how RDKit.js and Pyodide work, and this site's molecule viewer, structure drawing and Python boxes use them."
   },
   "used": [
    "RDKit.js",
    "3Dmol.js",
    "Kekule.js",
    "Pyodide",
    {
     "zh": "本站的交互演示",
     "en": "this site's interactive demos"
    }
   ],
   "good": {
    "zh": "不用安装，任何人打开网页就能用；做教学演示和可视化最方便。",
    "en": "No installation: anyone with a browser can use it; ideal for teaching demos and visualisation."
   },
   "watch": {
    "zh": "只有双精度浮点（没有整数类型的数组要用 TypedArray）；重计算放到 Web Worker 里，不要卡住页面。",
    "en": "Numbers are doubles (use TypedArrays for arrays); put heavy work in a Web Worker so the page stays responsive."
   },
   "start": {
    "zh": [
     "在浏览器的开发者工具控制台里粘贴运行右边的程序",
     "学数组方法、模块和 async / await",
     "用 3Dmol.js 在网页里显示一个分子"
    ],
    "en": [
     "Paste the program into your browser's developer console",
     "Learn array methods, modules and async / await",
     "Show a molecule in a page with 3Dmol.js"
    ]
   },
   "links": [
    [
     "MDN 学习区",
     "MDN learning area",
     "https://developer.mozilla.org/en-US/docs/Learn_web_development"
    ],
    [
     "WebAssembly",
     "WebAssembly",
     "https://webassembly.org/"
    ]
   ],
   "snippets": [
    {
     "file": "lj.js",
     "lang": null,
     "title": null,
     "run": "node lj.js",
     "tested": true,
     "code": "// Lennard-Jones energy of three atoms (reduced units); runs in a browser or Node.js\nconst r = 2 ** (1 / 6);\nconst atoms = [[0, 0, 0], [r, 0, 0], [r / 2, (r * Math.sqrt(3)) / 2, 0]];\nconst lj = (d) => { const s6 = d ** -6; return 4 * (s6 * s6 - s6); };\n\nlet energy = 0;\nfor (let i = 0; i < atoms.length; i++)\n  for (let j = i + 1; j < atoms.length; j++)\n    energy += lj(Math.hypot(...atoms[i].map((v, k) => v - atoms[j][k])));\n\nconsole.log(`E = ${energy.toFixed(6)}`);"
    }
   ],
   "runnable": "js"
  },
  {
   "id": "qasm",
   "name": "OpenQASM · Qiskit · Q#",
   "tier": "quantum",
   "year": 2017,
   "glyph": "|ψ⟩",
   "role": {
    "zh": "量子计算机的编程：OpenQASM 是线路的通用描述语言（IBM Quantum、Amazon Braket 都支持 3.0 版），Qiskit 用 Python 搭线路，Q# 是微软的量子语言。",
    "en": "Programming quantum computers: OpenQASM is the common circuit language (version 3 is accepted by IBM Quantum and Amazon Braket), Qiskit builds circuits from Python, and Q# is Microsoft's quantum language."
   },
   "used": [
    "IBM Quantum",
    "Amazon Braket",
    "Azure Quantum",
    {
     "zh": "VQE 等量子化学算法研究",
     "en": "research on VQE and other quantum chemistry algorithms"
    }
   ],
   "good": {
    "zh": "小线路可以在笔记本上模拟，再提交到真实设备。",
    "en": "Small circuits simulate on a laptop before running on real hardware."
   },
   "watch": {
    "zh": "今天的设备有噪声，化学上有用的规模还要等纠错；先读量子嘉年华里“量子算法”和“量子计算机”两馆。",
    "en": "Today's devices are noisy and chemically useful sizes await error correction; read the Quantum Algorithms and Quantum Computers pavilions first."
   },
   "start": {
    "zh": [
     "在游乐场里玩量子线路的小游戏",
     "pip install qiskit，用 qiskit.qasm3 读右边的线路并模拟",
     "读量子算法展馆的 VQE 一节"
    ],
    "en": [
     "Play the circuit games in the Playground",
     "pip install qiskit, load the circuit with qiskit.qasm3 and simulate it",
     "Read the VQE section of the Quantum Algorithms pavilion"
    ]
   },
   "links": [
    [
     "OpenQASM",
     "OpenQASM",
     "https://openqasm.com/"
    ],
    [
     "IBM Quantum 文档",
     "IBM Quantum documentation",
     "https://quantum.cloud.ibm.com/docs/en/guides"
    ],
    [
     "Azure Quantum（Q#）",
     "Azure Quantum (Q#)",
     "https://learn.microsoft.com/en-us/azure/quantum/"
    ]
   ],
   "snippets": [
    {
     "file": "bell.qasm",
     "lang": "qasm",
     "title": null,
     "run": "python -c \"import qiskit.qasm3 as q; print(q.load('bell.qasm'))\"",
     "tested": true,
     "code": "// A Bell pair, the \"hello world\" of quantum programs (OpenQASM 3)\nOPENQASM 3.0;\ninclude \"stdgates.inc\";\n\nqubit[2] q;\nbit[2] c;\n\nh q[0];          // superposition on the first qubit\ncx q[0], q[1];   // entangle it with the second\nc = measure q;   // 00 or 11, each half of the time"
    }
   ],
   "task": "bell"
  }
 ]
};
