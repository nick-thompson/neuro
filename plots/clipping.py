#!/usr/bin/env python

import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(-np.pi, np.pi, 201)
y = np.sin(x)

plt.axvline(linewidth=1, color='#bbbbbb')
plt.axhline(linewidth=1, color='#bbbbbb')

# Soft saturation
plt.plot(x, np.arctan(y), color='m')

# Soft saturation approximation
plt.plot(x, y - (y ** 3) / 3, color='c')

# Hard clipping
plt.plot(x, 0.5 * (abs(y + 0.85) - abs(y - 0.85)), color='b')

# Original
plt.plot(x, y, color='k')

# Chebyshev
plt.plot(x, 0.5 * y + 0.5 * (2 * y ** 2 - 1), color='y')

plt.axis('tight')
plt.show()
