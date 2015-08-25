#!/usr/bin/env python

import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(0, 4 * np.pi, 400)

plt.axvline(linewidth=1, color='#bbbbbb')
plt.axhline(linewidth=1, color='#bbbbbb')

plt.plot(x, np.sin(x), color='c')
plt.plot(x, np.sin(1.12 * x - 0.8 * np.pi), color='m')

plt.plot(x, np.sin(x) + np.sin(1.12 * x - 0.8 * np.pi), color='k')

plt.axis('tight')
plt.show()
