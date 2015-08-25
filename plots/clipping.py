#!/usr/bin/env python

import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(-np.pi, np.pi, 201)
y = np.sin(x)

plt.figure()
plt.subplot(121)

# Color in the axes
plt.axvline(linewidth=1, color='#bbbbbb')
plt.axhline(linewidth=1, color='#bbbbbb')

x_one_one = np.linspace(-1, 1, 201)

# Soft Saturation
plt.plot(x_one_one, np.arctan(x_one_one), color='m')

# Soft saturation approximation
plt.plot(x_one_one, np.arctan(x_one_one) - (np.arctan(x_one_one) ** 3) / 3, color='c')

# Hard clipping
plt.plot(x_one_one, 0.5 * (abs(x_one_one + 0.85) - abs(x_one_one - 0.85)), color='b')

# S-Curve
plt.plot(x_one_one, (1 + 4) * x_one_one / (1 + 4 * abs(x_one_one)), color='y')

# Identity
plt.plot(x_one_one, x_one_one, color='k')

plt.axis('tight')
plt.subplot(122)

# Color in the axes
plt.axvline(linewidth=1, color='#bbbbbb')
plt.axhline(linewidth=1, color='#bbbbbb')

# Soft saturation
plt.plot(x, np.arctan(y), color='m')

# Soft saturation approximation
plt.plot(x, y - (y ** 3) / 3, color='c')

# Hard clipping
plt.plot(x, 0.5 * (abs(y + 0.85) - abs(y - 0.85)), color='b')

# S-Curve
plt.plot(x, (1 + 4) * y / (1 + 4 * abs(y)), color='y')

# Original
plt.plot(x, y, color='k')

plt.axis('tight')
plt.show()
